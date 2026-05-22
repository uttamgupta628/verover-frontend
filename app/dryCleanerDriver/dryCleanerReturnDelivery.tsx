import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Region,
  Polyline,
} from "react-native-maps";
import * as Location from "expo-location";
import colors from "../../assets/color";
import axiosInstance from "../../api/axios";

const { width, height } = Dimensions.get("window");

interface Coordinate {
  latitude: number;
  longitude: number;
}

const GOOGLE_MAPS_API_KEY = "AIzaSyBn5c5hk6ko6gEwZ3IyWK6AkU4_U_tp_4g";

const MOCK_COORDINATES = {
  KOLKATA: { latitude: 22.6431, longitude: 88.4176 },
};

// ─── Geocoding cache (module-level so it persists across renders) ───
const geocodeCache = new Map<
  string,
  { latitude: number; longitude: number; timestamp: number } | null
>();
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;

const geocodeAddress = async (address: string): Promise<Coordinate | null> => {
  if (!address?.trim()) return null;

  const key = address.toLowerCase().trim();
  const cached = geocodeCache.get(key);
  if (
    cached &&
    cached.latitude &&
    Date.now() - cached.timestamp < CACHE_EXPIRY
  ) {
    return { latitude: cached.latitude, longitude: cached.longitude };
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      const coords = {
        latitude: loc.lat,
        longitude: loc.lng,
        timestamp: Date.now(),
      };
      geocodeCache.set(key, coords);
      return { latitude: loc.lat, longitude: loc.lng };
    }
  } catch (e) {
    console.error("[Geocode] Error:", e);
  }

  // Fallback: LocationIQ
  try {
    const url =
      `https://us1.locationiq.com/v1/search.php?` +
      `key=pk.a58eb8dfee07578df85fe6719e6532ff` +
      `&q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const coords = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        timestamp: Date.now(),
      };
      geocodeCache.set(key, coords);
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
  } catch (e) {
    console.error("[LocationIQ] Error:", e);
  }

  geocodeCache.set(key, null);
  return null;
};

// ─── Decode Google Directions polyline ───────────────────────────────
const decodePolyline = (encoded: string): Coordinate[] => {
  const points: Coordinate[] = [];
  let index = 0,
    lat = 0,
    lng = 0;
  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

// ─── Two-phase trip: PICKUP (dry cleaner) then DELIVERY (customer) ───
type TripPhase = "pickup" | "delivery";

const DryCleanerReturnDelivery = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);
  const hasFetchedRoute = useRef(false);

  const { user, token, isAuthenticated } = useSelector(
    (state: any) => state.auth,
  );

  // ── Parse booking data ──────────────────────────────────────────────
  const [bookingData, setBookingData] = useState<any>(null);
  useEffect(() => {
    try {
      const raw = params.bookingData;
      if (typeof raw === "string") setBookingData(JSON.parse(raw));
      else if (typeof raw === "object") setBookingData(raw);
    } catch {
      Alert.alert("Error", "Failed to parse booking data");
    }
  }, [params.bookingData]);

  // ── State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<TripPhase>("pickup"); // pickup → delivery
  const [currLoc, setCurrLoc] = useState<Coordinate | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coordinate | null>(null); // dry cleaner
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinate | null>(null); // customer
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [geocodingPickup, setGeocodingPickup] = useState(false);
  const [geocodingDelivery, setGeocodingDelivery] = useState(false);

  // ── Geocode both addresses once booking is available ─────────────────
  useEffect(() => {
    if (!bookingData) return;

    const pickup = bookingData.pickupAddress || bookingData.dryCleaner?.address;
    const delivery =
      bookingData.dropoffAddress ||
      bookingData.dropOff ||
      bookingData.customerAddress;

    if (pickup && !pickupCoords) {
      setGeocodingPickup(true);
      geocodeAddress(
        typeof pickup === "object" ? formatAddress(pickup) : pickup,
      )
        .then((c) => {
          if (c) setPickupCoords(c);
        })
        .finally(() => setGeocodingPickup(false));
    }

    if (delivery && !deliveryCoords) {
      setGeocodingDelivery(true);
      geocodeAddress(
        typeof delivery === "object" ? formatAddress(delivery) : delivery,
      )
        .then((c) => {
          if (c) setDeliveryCoords(c);
        })
        .finally(() => setGeocodingDelivery(false));
    }
  }, [bookingData]);

  // ── Format address object → string ────────────────────────────────
  const formatAddress = (addr: any): string => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;
    return [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
      .filter(Boolean)
      .join(", ");
  };

  // ── Get current location ────────────────────────────────────────────
  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Enable location in settings.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: Linking.openSettings },
        ]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrLoc({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      setCurrLoc(MOCK_COORDINATES.KOLKATA);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // ── Fetch route whenever destination changes ────────────────────────
  const destination = phase === "pickup" ? pickupCoords : deliveryCoords;

  useEffect(() => {
    if (!currLoc || !destination || !mapReady) return;
    // Reset flag when phase changes so we re-fetch for new destination
    hasFetchedRoute.current = false;
  }, [phase, destination]);

  useEffect(() => {
    if (!currLoc || !destination || !mapReady || hasFetchedRoute.current)
      return;
    hasFetchedRoute.current = true;
    fetchRoute(currLoc, destination);
  }, [currLoc, destination, mapReady]);

  const fetchRoute = async (origin: Coordinate, dest: Coordinate) => {
    setRouteLoading(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origin.latitude},${origin.longitude}` +
        `&destination=${dest.latitude},${dest.longitude}` +
        `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.routes?.length > 0) {
        const leg = data.routes[0].legs[0];
        setRouteCoords(decodePolyline(data.routes[0].overview_polyline.points));
        setRouteDistance(leg.distance.text);
        setRouteDuration(leg.duration.text);
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            decodePolyline(data.routes[0].overview_polyline.points),
            {
              edgePadding: { top: 80, right: 40, bottom: 340, left: 40 },
              animated: true,
            },
          );
        }, 800);
      } else {
        generateFallbackRoute(origin, dest);
      }
    } catch {
      generateFallbackRoute(origin, dest);
    } finally {
      setRouteLoading(false);
    }
  };

  const generateFallbackRoute = (start: Coordinate, end: Coordinate) => {
    const pts: Coordinate[] = [start];
    for (let i = 1; i < 49; i++) {
      const p = i / 49;
      pts.push({
        latitude:
          start.latitude +
          (end.latitude - start.latitude) * p +
          (Math.random() - 0.5) * 0.002,
        longitude:
          start.longitude +
          (end.longitude - start.longitude) * p +
          (Math.random() - 0.5) * 0.002,
      });
    }
    pts.push(end);
    setRouteCoords(pts);
    const d = haversine(start, end);
    setRouteDistance(`${d.toFixed(1)} km`);
    setRouteDuration(`${Math.round((d / 40) * 60)} min`);
  };

  const haversine = (a: Coordinate, b: Coordinate) => {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  // ── Update booking status on backend ───────────────────────────────
  const updateStatus = async (
    status: string,
    extra: Record<string, any> = {},
  ) => {
    const bookingId = bookingData?.id || bookingData?._id;
    if (!bookingId) throw new Error("No booking ID");

    const res = await axiosInstance.put(
      "/users/update-status",
      {
        bookingId,
        status,
        driverId: user._id,
        driverName: `${user.firstName} ${user.lastName}`.trim(),
        ...extra,
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
    );

    if (!res.data.success)
      throw new Error(res.data.message || "Status update failed");
    return res.data;
  };

  // ── Phase 1: Driver arrived at dry cleaner, picked up items ─────────
  const handlePickedUpFromCleaner = async () => {
    Alert.alert(
      "Confirm Pickup",
      "Have you collected the cleaned items from the dry cleaner?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Collected",
          onPress: async () => {
            try {
              setIsUpdating(true);

              // Progress: accepted → in_progress → pickup_completed
              const currentStatus = bookingData?.status || "accepted";
              if (currentStatus === "accepted") {
                await updateStatus("in_progress");
              }
              await updateStatus("pickup_completed", {
                pickupCompletedAt: new Date().toISOString(),
              });

              // Switch to delivery phase
              setPhase("delivery");
              setRouteCoords([]);
              setRouteDistance("");
              setRouteDuration("");
              hasFetchedRoute.current = false;

              // Trigger route fetch for delivery leg
              if (currLoc && deliveryCoords) {
                fetchRoute(currLoc, deliveryCoords);
              }

              Alert.alert(
                "✅ Phase 1 Complete",
                "Now navigate to the customer to deliver the items.",
              );
            } catch (err: any) {
              Alert.alert("Error", `Failed to update status: ${err.message}`);
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ],
    );
  };

  // ── Phase 2: Driver delivered items to customer ──────────────────────
  const handleDeliveredToCustomer = async () => {
    Alert.alert(
      "Confirm Delivery",
      "Have you successfully delivered the items to the customer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delivered",
          onPress: async () => {
            try {
              setIsUpdating(true);

              await updateStatus("completed", {
                completedAt: new Date().toISOString(),
                dropoffCompletedAt: new Date().toISOString(),
                routeDistance: routeDistance,
                routeDuration: routeDuration,
              });

              // Navigate to receipt
              const receiptData = {
                ...bookingData,
                status: "completed",
                completedAt: new Date().toISOString(),
                isReturnDelivery: true,
              };

              router.replace({
                pathname: "/dryCleanerDriver/recipet",
                params: {
                  bookingData: JSON.stringify(receiptData),
                  success: "true",
                },
              });
            } catch (err: any) {
              Alert.alert(
                "Error",
                `Failed to complete delivery: ${err.message}`,
                [
                  { text: "Retry", onPress: handleDeliveredToCustomer },
                  { text: "Cancel", style: "cancel" },
                ],
              );
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleMapReady = useCallback(() => setMapReady(true), []);

  // ── Pricing helpers ──────────────────────────────────────────────────
  const getDeliveryCharge = () =>
    parseFloat(
      bookingData?.pricing?.deliveryCharge ||
        bookingData?.deliveryCharge ||
        bookingData?.price ||
        "0",
    ).toFixed(2);

  const getEstimatedTip = () =>
    parseFloat(
      bookingData?.pricing?.estimatedTip || bookingData?.estimatedTip || "5",
    ).toFixed(2);

  const getTotalEarnings = () =>
    (parseFloat(getDeliveryCharge()) + parseFloat(getEstimatedTip())).toFixed(
      2,
    );

  // ── Map render ────────────────────────────────────────────────────────
  const renderMap = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            Map not available on web
          </Text>
        </View>
      );
    }

    const center = currLoc || MOCK_COORDINATES.KOLKATA;

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onMapReady={handleMapReady}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        mapPadding={{ top: 50, right: 0, bottom: height * 0.45, left: 0 }}
      >
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={phase === "pickup" ? "#4285F4" : "#4CAF50"}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {currLoc && (
          <Marker
            coordinate={currLoc}
            title="Your Location"
            identifier="driver"
            zIndex={3}
          >
            <View style={styles.driverMarkerOuter}>
              <View style={styles.driverMarkerInner}>
                <MaterialIcons name="directions-car" size={18} color="#fff" />
              </View>
            </View>
          </Marker>
        )}

        {phase === "pickup" && pickupCoords && (
          <Marker
            coordinate={pickupCoords}
            title="Dry Cleaner"
            identifier="pickup"
            zIndex={2}
          >
            <View style={styles.storeMarker}>
              <MaterialIcons name="store" size={36} color="#4285F4" />
            </View>
          </Marker>
        )}

        {phase === "delivery" && deliveryCoords && (
          <Marker
            coordinate={deliveryCoords}
            title="Customer"
            identifier="delivery"
            zIndex={2}
          >
            <View style={styles.customerMarker}>
              <MaterialIcons name="home" size={36} color="#4CAF50" />
            </View>
          </Marker>
        )}
      </MapView>
    );
  };

  // ── Auth guard ───────────────────────────────────────────────────────
  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons
              name="arrow-back"
              size={30}
              color={colors.brandColor}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Return Delivery</Text>
        </View>
        <View style={styles.centeredMsg}>
          <Text style={styles.errorText}>Authentication required</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Phase indicator data ─────────────────────────────────────────────
  const phaseLabel =
    phase === "pickup" ? "Go to Dry Cleaner" : "Deliver to Customer";
  const phaseColor = phase === "pickup" ? "#4285F4" : "#4CAF50";
  const phaseIcon = phase === "pickup" ? "store" : "home";
  const destinationAddress =
    phase === "pickup"
      ? (() => {
          const a =
            bookingData?.pickupAddress || bookingData?.dryCleaner?.address;
          return typeof a === "object" ? formatAddress(a) : a || "Dry Cleaner";
        })()
      : bookingData?.dropoffAddress ||
        bookingData?.dropOff ||
        bookingData?.customerAddress ||
        "Customer Address";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons
            name="arrow-back"
            size={28}
            color={colors.brandColor}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Return Delivery</Text>
          <View
            style={[styles.phasePill, { backgroundColor: phaseColor + "20" }]}
          >
            <MaterialIcons
              name={phaseIcon as any}
              size={12}
              color={phaseColor}
            />
            <Text style={[styles.phasePillText, { color: phaseColor }]}>
              {phaseLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Phase Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressStep, styles.progressStepDone]}>
          <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
          <Text style={[styles.progressLabel, { color: "#4CAF50" }]}>
            Items Cleaned
          </Text>
        </View>
        <View
          style={[
            styles.progressLine,
            phase === "delivery" && styles.progressLineDone,
          ]}
        />
        <View
          style={[
            styles.progressStep,
            phase === "pickup" && styles.progressStepActive,
          ]}
        >
          <MaterialIcons
            name="store"
            size={20}
            color={
              phase === "pickup"
                ? "#4285F4"
                : phase === "delivery"
                  ? "#4CAF50"
                  : "#CCC"
            }
          />
          <Text
            style={[
              styles.progressLabel,
              {
                color:
                  phase === "pickup"
                    ? "#4285F4"
                    : phase === "delivery"
                      ? "#4CAF50"
                      : "#CCC",
              },
            ]}
          >
            Collect from Cleaner
          </Text>
        </View>
        <View
          style={[
            styles.progressLine,
            phase === "delivery" && styles.progressLineDone,
          ]}
        />
        <View
          style={[
            styles.progressStep,
            phase === "delivery" && styles.progressStepActive,
          ]}
        >
          <MaterialIcons
            name="home"
            size={20}
            color={phase === "delivery" ? "#4CAF50" : "#CCC"}
          />
          <Text
            style={[
              styles.progressLabel,
              { color: phase === "delivery" ? "#4CAF50" : "#CCC" },
            ]}
          >
            Deliver to Customer
          </Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {renderMap()}

        {/* Route info overlay */}
        {routeDistance ? (
          <View style={styles.routeInfoCard}>
            <MaterialIcons name="directions" size={18} color={phaseColor} />
            <Text style={styles.routeInfoText}>{routeDistance}</Text>
            <Text style={styles.routeInfoDot}>•</Text>
            <Text style={styles.routeInfoText}>{routeDuration}</Text>
          </View>
        ) : null}

        {/* Map controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={phaseColor} />
            ) : (
              <MaterialIcons name="my-location" size={22} color={phaseColor} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => {
              if (routeCoords.length > 1) {
                mapRef.current?.fitToCoordinates(routeCoords, {
                  edgePadding: { top: 80, right: 40, bottom: 340, left: 40 },
                  animated: true,
                });
              }
            }}
          >
            <MaterialIcons name="zoom-out-map" size={22} color={phaseColor} />
          </TouchableOpacity>
        </View>

        {/* Geocoding / route loading indicator */}
        {(geocodingPickup || geocodingDelivery || routeLoading) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.loadingOverlayText}>
              {routeLoading ? "Calculating route…" : "Finding location…"}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
        >
          {/* Order Info */}
          <View style={styles.orderRow}>
            <View
              style={[styles.orderIconWrap, { backgroundColor: phaseColor }]}
            >
              <MaterialIcons name="dry-cleaning" size={22} color="#fff" />
            </View>
            <View style={styles.orderInfo}>
              <Text style={styles.orderName}>
                {bookingData?.dryCleaner?.shopname ||
                  bookingData?.name ||
                  "Dry Cleaning Service"}
              </Text>
              <Text style={styles.orderNum}>
                Order: {bookingData?.orderNumber || bookingData?.id || "N/A"}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: phaseColor + "20" },
                ]}
              >
                <Text style={[styles.statusPillText, { color: phaseColor }]}>
                  {phase === "pickup"
                    ? "COLLECT ITEMS"
                    : "DELIVERING TO CUSTOMER"}
                </Text>
              </View>
            </View>
          </View>

          {/* Destination Card */}
          <View style={[styles.destCard, { borderLeftColor: phaseColor }]}>
            <MaterialIcons
              name={phaseIcon as any}
              size={20}
              color={phaseColor}
            />
            <View style={styles.destInfo}>
              <Text style={styles.destLabel}>
                {phase === "pickup"
                  ? "Pickup from Dry Cleaner"
                  : "Deliver to Customer"}
              </Text>
              <Text style={styles.destAddress}>{destinationAddress}</Text>
            </View>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                if (!destination) return;
                const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
                Linking.openURL(url);
              }}
            >
              <MaterialIcons name="navigation" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Customer info (visible in both phases) */}
          {bookingData?.user && (
            <View style={styles.customerCard}>
              <MaterialIcons name="account-circle" size={18} color="#666" />
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>
                  {bookingData.user.firstName || ""}{" "}
                  {bookingData.user.lastName || ""}
                  {!bookingData.user.firstName &&
                    (bookingData.user.name || "Customer")}
                </Text>
                {bookingData.user.phoneNumber && (
                  <Text style={styles.customerPhone}>
                    {bookingData.user.phoneNumber}
                  </Text>
                )}
              </View>
              {bookingData.user.phoneNumber && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${bookingData.user.phoneNumber}`)
                  }
                >
                  <MaterialIcons
                    name="phone"
                    size={20}
                    color={colors.brandColor}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Earnings */}
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Delivery Charge</Text>
              <Text style={styles.earningsValue}>${getDeliveryCharge()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Estimated Tip</Text>
              <Text style={styles.earningsValue}>${getEstimatedTip()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsLabel, styles.totalLabel]}>
                Total Earnings
              </Text>
              <Text style={[styles.earningsValue, styles.totalValue]}>
                ${getTotalEarnings()}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.btnContainer}>
          {phase === "pickup" ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: "#4285F4" },
                isUpdating && styles.btnDisabled,
              ]}
              onPress={handlePickedUpFromCleaner}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="inventory" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    Collected Items from Dry Cleaner
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: "#4CAF50" },
                isUpdating && styles.btnDisabled,
              ]}
              onPress={handleDeliveredToCustomer}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    Delivered to Customer
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    zIndex: 100,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginTop: Platform.OS === "android" ? -50 : -60,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  phasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  phasePillText: { fontSize: 11, fontWeight: "600" },

  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  progressStep: { alignItems: "center", flex: 1 },
  progressStepActive: {},
  progressStepDone: {},
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 12,
  },
  progressLineDone: { backgroundColor: "#4CAF50" },
  progressLabel: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 3,
    textAlign: "center",
  },

  mapContainer: { flex: 1, position: "relative" },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  mapPlaceholderText: { color: "#999", fontSize: 15 },

  routeInfoCard: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  routeInfoText: { fontSize: 14, fontWeight: "600", color: "#111" },
  routeInfoDot: { color: "#999", fontSize: 14 },

  mapControls: {
    position: "absolute",
    right: 12,
    bottom: height * 0.45 + 12,
    gap: 10,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  loadingOverlay: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: [{ translateX: -70 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loadingOverlayText: { color: "#fff", fontSize: 12, fontWeight: "500" },

  // Markers
  driverMarkerOuter: { alignItems: "center", justifyContent: "center" },
  driverMarkerInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  storeMarker: { alignItems: "center" },
  customerMarker: { alignItems: "center" },

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.45,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 100,
  },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 90 },

  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  orderIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  orderInfo: { flex: 1 },
  orderName: { fontSize: 16, fontWeight: "700", color: "#111" },
  orderNum: { fontSize: 12, color: "#666", marginTop: 2 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  statusPillText: { fontSize: 10, fontWeight: "700" },

  destCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8F9FA",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 10,
  },
  destInfo: { flex: 1 },
  destLabel: { fontSize: 12, fontWeight: "600", color: "#666" },
  destAddress: { fontSize: 13, color: "#111", marginTop: 2, lineHeight: 18 },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.brandColor,
    justifyContent: "center",
    alignItems: "center",
  },

  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 10,
  },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 14, fontWeight: "600", color: "#111" },
  customerPhone: { fontSize: 12, color: "#666", marginTop: 2 },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandColor + "15",
    justifyContent: "center",
    alignItems: "center",
  },

  earningsCard: {
    backgroundColor: "#F8F9FA",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  earningsLabel: { fontSize: 14, color: "#666" },
  earningsValue: { fontSize: 14, fontWeight: "600", color: "#111" },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#111" },
  totalValue: { fontSize: 16, fontWeight: "800", color: "#4CAF50" },
  divider: { height: 1, backgroundColor: "#E8E8E8", marginVertical: 2 },

  btnContainer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: "#fff",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    gap: 10,
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  actionBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },

  centeredMsg: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: "#FF0000" },
});

export default DryCleanerReturnDelivery;
