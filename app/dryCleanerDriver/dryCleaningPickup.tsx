import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Region,
  Polyline,
} from "react-native-maps";
import * as Location from "expo-location";
import { images } from "../../assets/images/images";
import colors from "../../assets/color";
import axiosInstance from "../../api/axios";

const { width, height } = Dimensions.get("window");

interface Coordinate {
  latitude: number;
  longitude: number;
}

const GOOGLE_MAPS_API_KEY = "AIzaSyBn5c5hk6ko6gEwZ3IyWK6AkU4_U_tp_4g";
const LOCATIONIQ_KEY = "pk.a58eb8dfee07578df85fe6719e6532ff";

const MOCK_COORDINATES = {
  MUMBAI: { latitude: 18.9344, longitude: 72.8309 },
  KOLKATA: { latitude: 22.6431, longitude: 88.4176 },
};

// ── Geocoding cache (module-level, persists across renders) ──────────────────
const geocodeCache = new Map<
  string,
  {
    latitude: number;
    longitude: number;
    provider: string;
    timestamp: number;
  } | null
>();

const directionsCache = new Map<
  string,
  {
    routes: any;
    timestamp: number;
    distance: string;
    duration: string;
  }
>();

const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;
const MIN_REQUEST_INTERVAL = 1000;

let preferredProvider: "google" | "locationiq" = "google";
let googleFailureCount = 0;
const MAX_GOOGLE_FAILURES = 3;
let lastDirectionsRequestTime = 0;

// ── Geocoding helpers ────────────────────────────────────────────────────────
const geocodeWithLocationIQ = async (
  address: string,
): Promise<Coordinate | null> => {
  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && Array.isArray(data) && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
};

const geocodeWithGoogle = async (
  address: string,
  retryCount = 0,
): Promise<Coordinate | null> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OVER_QUERY_LIMIT") {
      googleFailureCount++;
      if (googleFailureCount >= MAX_GOOGLE_FAILURES)
        preferredProvider = "locationiq";
      if (retryCount < MAX_RETRIES) {
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY * Math.pow(2, retryCount)),
        );
        return geocodeWithGoogle(address, retryCount + 1);
      }
      return null;
    }

    if (data.status === "OK" && data.results?.[0]) {
      googleFailureCount = 0;
      const loc = data.results[0].geometry.location;
      return { latitude: loc.lat, longitude: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
};

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
  if (cached === null) return null;

  let result: Coordinate | null = null;
  let provider = "";

  if (preferredProvider === "google") {
    result = await geocodeWithGoogle(address);
    provider = result ? "Google" : "";
    if (!result) {
      result = await geocodeWithLocationIQ(address);
      provider = result ? "LocationIQ" : "";
    }
  } else {
    result = await geocodeWithLocationIQ(address);
    provider = result ? "LocationIQ" : "";
    if (!result) {
      result = await geocodeWithGoogle(address);
      provider = result ? "Google" : "";
    }
  }

  geocodeCache.set(
    key,
    result ? { ...result, provider, timestamp: Date.now() } : null,
  );
  return result;
};

// ── Polyline decoder ─────────────────────────────────────────────────────────
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

// ── Status colour helper (local, only pending/requested needed here) ─────────
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "accepted":
      return "#4CAF50";
    case "pending":
    case "requested":
      return "#FF8C00";
    default:
      return "#666666";
  }
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// Screen purpose: driver reviews a NEW (pending/requested) booking and either
// accepts → routed to dryCleanerDropup (leg 1: customer → dry cleaner)
//            OR rejects.
// ════════════════════════════════════════════════════════════════════════════
const DryCleaningPickup = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);
  const hasFetchedRoute = useRef(false);

  const { user, token, isAuthenticated } = useSelector(
    (state: any) => state.auth,
  );

  const [providerData, setProviderData] = useState<any>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const [currLoc, setCurrLoc] = useState<Coordinate | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Coordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [isGeocodingPickup, setIsGeocodingPickup] = useState(false);

  // ── Parse params ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (params.providerData && typeof params.providerData === "string") {
        const parsed = JSON.parse(params.providerData);
        if (!parsed.id && !parsed._id) throw new Error("Missing booking ID");
        setProviderData(parsed);
      } else if (
        params.providerData &&
        typeof params.providerData === "object"
      ) {
        setProviderData(params.providerData);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to parse booking data");
    }
  }, [params.providerData]);

  useEffect(() => {
    if (providerData) setBookingDetails(providerData);
  }, [providerData]);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert("Authentication Required", "Please log in to continue", [
        { text: "OK", onPress: () => router.push("/login") },
      ]);
    }
  }, [isAuthenticated, token]);

  // ── Driver location ──────────────────────────────────────────────────────
  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please enable location permission.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
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

  // ── Resolve pickup coordinates ───────────────────────────────────────────
  useEffect(() => {
    if (!bookingDetails) return;

    if (
      bookingDetails.pickupCoords?.latitude &&
      bookingDetails.pickupCoords?.longitude
    ) {
      setPickupLocation(bookingDetails.pickupCoords);
      return;
    }

    if (bookingDetails.pickupAddress) {
      (async () => {
        setIsGeocodingPickup(true);
        const coords = await geocodeAddress(bookingDetails.pickupAddress);
        if (coords) setPickupLocation(coords);
        else
          Alert.alert(
            "Location Not Found",
            "Could not resolve pickup address.",
          );
        setIsGeocodingPickup(false);
      })();
    }
  }, [bookingDetails]);

  // ── Fetch route (once) ───────────────────────────────────────────────────
  const fetchRoute = useCallback(
    async (origin: Coordinate, dest: Coordinate) => {
      setIsRouteLoading(true);
      try {
        const key = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}->${dest.latitude.toFixed(4)},${dest.longitude.toFixed(4)}`;
        const cached = directionsCache.get(key);
        if (cached && Date.now() - cached.timestamp < 3_600_000) {
          const pts = decodePolyline(cached.routes.overview_polyline.points);
          setRouteCoordinates(pts);
          setRouteDistance(cached.distance);
          setRouteDuration(cached.duration);
          setTimeout(
            () =>
              mapRef.current?.fitToCoordinates(pts, {
                edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
                animated: true,
              }),
            1000,
          );
          return;
        }

        const wait =
          MIN_REQUEST_INTERVAL - (Date.now() - lastDirectionsRequestTime);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastDirectionsRequestTime = Date.now();

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === "OK" && data.routes?.length) {
          const route = data.routes[0];
          const leg = route.legs[0];
          directionsCache.set(key, {
            routes: route,
            timestamp: Date.now(),
            distance: leg.distance.text,
            duration: leg.duration.text,
          });
          const pts = decodePolyline(route.overview_polyline.points);
          setRouteCoordinates(pts);
          setRouteDistance(leg.distance.text);
          setRouteDuration(leg.duration.text);
          setBookingDetails((p: any) => ({
            ...p,
            calculatedDistance: leg.distance.text,
            calculatedDuration: leg.duration.text,
            distanceInKm: (leg.distance.value / 1000).toFixed(2),
          }));
          setTimeout(
            () =>
              mapRef.current?.fitToCoordinates(pts, {
                edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
                animated: true,
              }),
            1500,
          );
        } else {
          generateFallback(origin, dest);
        }
      } catch {
        generateFallback(origin, dest);
      } finally {
        setIsRouteLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!currLoc || !pickupLocation || !mapReady || hasFetchedRoute.current)
      return;
    hasFetchedRoute.current = true;
    fetchRoute(currLoc, pickupLocation);
  }, [currLoc, pickupLocation, mapReady, fetchRoute]);

  const generateFallback = (start: Coordinate, end: Coordinate) => {
    const route: Coordinate[] = [start];
    for (let i = 1; i < 49; i++) {
      const t = i / 49;
      route.push({
        latitude:
          start.latitude +
          (end.latitude - start.latitude) * t +
          (Math.random() - 0.5) * 0.002,
        longitude:
          start.longitude +
          (end.longitude - start.longitude) * t +
          (Math.random() - 0.5) * 0.002,
      });
    }
    route.push(end);
    setRouteCoordinates(route);
    const R = 6371;
    const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
    const dLon = ((end.longitude - start.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((start.latitude * Math.PI) / 180) *
        Math.cos((end.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    const mins = Math.round((km / 40) * 60);
    const dur =
      mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`;
    setRouteDistance(dist);
    setRouteDuration(dur);
  };

  // ── Pricing helpers ──────────────────────────────────────────────────────
  const getDeliveryCharge = () => {
    const raw =
      bookingDetails?.pricing?.deliveryCharge ??
      bookingDetails?.deliveryCharge ??
      bookingDetails?.price ??
      0;
    return parseFloat(String(raw)).toFixed(2);
  };
  const getEstimatedTip = () => {
    const raw =
      bookingDetails?.pricing?.estimatedTip ??
      bookingDetails?.estimatedTip ??
      bookingDetails?.tip ??
      5;
    return parseFloat(String(raw)).toFixed(2);
  };
  const getTotalEarnings = () =>
    (parseFloat(getDeliveryCharge()) + parseFloat(getEstimatedTip())).toFixed(
      2,
    );

  // ── Accept booking ───────────────────────────────────────────────────────
  /**
   * Calls PUT /users/driver/respond with response:'accept'
   * On success → navigates to dryCleanerDropup for LEG 1
   * (isReturnDelivery: false  →  customer pickup → dry cleaner dropoff)
   */
  const handleAcceptBooking = async () => {
    if (!bookingDetails?.id && !bookingDetails?._id) {
      Alert.alert("Error", "Invalid booking data.");
      return;
    }
    if (!isAuthenticated || !user?._id) {
      Alert.alert("Error", "Authentication required.");
      return;
    }

    try {
      setIsAccepting(true);
      const bookingId = bookingDetails.id || bookingDetails._id;

      const res = await axiosInstance.put(
        "/users/driver/respond",
        {
          bookingId,
          response: "accept",
          driverId: user._id,
          driverName:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            user.fullName ||
            "Driver",
          routeDistance: bookingDetails.distanceInKm || 0,
          routeDuration: bookingDetails.calculatedDuration || "N/A",
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.data.success) {
        Alert.alert("Success", "Booking accepted!", [
          {
            text: "OK",
            onPress: () => {
              /**
               * Navigate to dryCleanerDropup for LEG 1:
               * Pickup  = customer's pickup address
               * Dropoff = dry cleaner address (bookingDetails.dropoffAddress)
               * isReturnDelivery = false
               */
              router.replace({
                pathname: "/dryCleanerDriver/dryCleanerDropup",
                params: {
                  bookingData: JSON.stringify({
                    ...bookingDetails,
                    status: "accepted",
                    isReturnDelivery: false,
                    // Ensure dropoffAddress points to the dry cleaner for leg 1
                    dropoffAddress:
                      bookingDetails.dropoffAddress || bookingDetails.dropOff,
                    driverId: user._id,
                    driverName:
                      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                      user.fullName ||
                      "Driver",
                  }),
                },
              });
            },
          },
        ]);
      } else {
        throw new Error(res.data.message || "Failed to accept booking");
      }
    } catch (err: any) {
      Alert.alert("Error", `Failed to accept: ${err.message}`, [
        { text: "Retry", onPress: handleAcceptBooking },
        { text: "Cancel", style: "cancel" },
      ]);
    } finally {
      setIsAccepting(false);
    }
  };

  // ── Reject booking ───────────────────────────────────────────────────────
  const handleRejectBooking = () => {
    Alert.alert(
      "Reject Booking",
      "Are you sure you want to reject this booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () =>
            router.push({
              pathname: "/CancelBookingScreen",
              params: {
                bookingData: JSON.stringify(bookingDetails),
                rejectionType: "driver_reject",
              },
            }),
        },
      ],
    );
  };

  // ── Map render ───────────────────────────────────────────────────────────
  const renderMap = () => {
    if (Platform.OS === "web")
      return (
        <Image source={images.BookingConfirmationMap} style={styles.mapImage} />
      );
    const center = currLoc || MOCK_COORDINATES.KOLKATA;
    return (
      <MapView
        ref={mapRef}
        style={styles.mapImage}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onMapReady={() => setMapReady(true)}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        mapPadding={{ top: 50, right: 0, bottom: height * 0.5, left: 0 }}
      >
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        )}
        {currLoc && (
          <Marker
            coordinate={currLoc}
            title="Your Location"
            identifier="driver"
            zIndex={2}
          >
            <View style={styles.driverMarker}>
              <View style={styles.driverMarkerInner}>
                <MaterialIcons
                  name="directions-car"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </Marker>
        )}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Customer Pickup"
            description={bookingDetails?.pickupAddress}
            identifier="pickup"
            zIndex={2}
          >
            <View style={styles.pickupMarker}>
              <MaterialIcons name="location-pin" size={40} color="#FF8C00" />
            </View>
          </Marker>
        )}
      </MapView>
    );
  };

  // ── Auth / data guards ───────────────────────────────────────────────────
  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons
              name="arrow-back"
              size={35}
              color={colors.brandColor}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pick Up Dry Cleaning</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Authentication required</Text>
          <TouchableOpacity
            style={styles.backToLocatorButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.backToLocatorText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookingDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons
              name="arrow-back"
              size={35}
              color={colors.brandColor}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pick Up Dry Cleaning</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No booking details found</Text>
          <TouchableOpacity
            style={styles.backToLocatorButton}
            onPress={() => router.push("/dryCleanerDriver/orderRequest")}
          >
            <Text style={styles.backToLocatorText}>Back to Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons
            name="arrow-back"
            size={35}
            color={colors.brandColor}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick Up Dry Cleaning</Text>
      </View>

      {isGeocodingPickup && (
        <View style={styles.geocodingOverlay}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.geocodingText}>Finding location...</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        {renderMap()}
        {(routeDistance || bookingDetails?.calculatedDistance) && (
          <View style={styles.routeInfoContainer}>
            <View style={styles.routeInfoCard}>
              <MaterialIcons name="directions" size={20} color="#4285F4" />
              <Text style={styles.routeInfoText}>
                {routeDistance || bookingDetails.calculatedDistance}
              </Text>
              <Text style={styles.routeInfoSeparator}>•</Text>
              <Text style={styles.routeInfoText}>
                {routeDuration || bookingDetails.calculatedDuration}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <MaterialIcons name="my-location" size={24} color="#4A90E2" />
            )}
          </TouchableOpacity>
          {routeCoordinates.length > 1 && (
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={() =>
                mapRef.current?.fitToCoordinates(routeCoordinates, {
                  edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
                  animated: true,
                })
              }
            >
              <MaterialIcons name="zoom-out-map" size={24} color="#4A90E2" />
            </TouchableOpacity>
          )}
        </View>
        {isRouteLoading && (
          <View style={styles.routeLoadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.routeLoadingText}>Calculating route...</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomCard}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Provider info */}
          <View style={styles.providerSection}>
            <View style={styles.providerInfoRow}>
              <View style={styles.providerIconContainer}>
                <Image source={images.washing} style={styles.providerIcon} />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {bookingDetails?.dryCleaner?.shopname ||
                    bookingDetails?.name ||
                    "Dry Cleaning Service"}
                </Text>
                <Text style={styles.orderNumber}>
                  Order:{" "}
                  {bookingDetails?.orderNumber || bookingDetails?.id || "N/A"}
                </Text>
                <Text
                  style={[
                    styles.status,
                    { color: getStatusColor(bookingDetails?.status) },
                  ]}
                >
                  {bookingDetails?.status?.toUpperCase() || "PENDING"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.orderDetailsButton}
                onPress={() =>
                  router.push({
                    pathname: "/OrderDetailes",
                    params: { bookingData: JSON.stringify(bookingDetails) },
                  })
                }
              >
                <Text style={styles.orderDetailsText}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Route: driver → customer (pickup leg) ── */}
          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.blueDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Your Location (driver)</Text>
                <Text style={styles.locationAddress}>Current GPS position</Text>
              </View>
            </View>
            <View style={styles.locationLine} />
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.greenDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Customer Pickup</Text>
                <Text style={styles.locationAddress}>
                  {bookingDetails?.pickupAddress || "Pickup location"}
                </Text>
              </View>
            </View>
            <View style={styles.locationLine} />
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.orangeDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Drop Off at Dry Cleaner</Text>
                <Text style={styles.locationAddress}>
                  {bookingDetails?.dropoffAddress ||
                    bookingDetails?.dropOff ||
                    "Dry Cleaning Center"}
                </Text>
              </View>
            </View>
          </View>

          {/* Trip details */}
          <View style={styles.tripDetails}>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="directions" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDistance ||
                  bookingDetails?.calculatedDistance ||
                  "Calculating..."}
              </Text>
            </View>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDuration ||
                  bookingDetails?.calculatedDuration ||
                  "Calculating..."}
              </Text>
            </View>
            <View style={styles.tripDetailItem}>
              <Text style={styles.priceText}>${getDeliveryCharge()}</Text>
            </View>
          </View>

          {/* Cost breakdown */}
          <View style={styles.costContainer}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Delivery Charge</Text>
              <Text style={styles.costValue}>${getDeliveryCharge()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Estimated Tip</Text>
              <Text style={styles.costValue}>${getEstimatedTip()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={[styles.costRow, styles.totalCostRow]}>
              <Text style={styles.totalLabel}>Total Earnings</Text>
              <Text style={styles.totalValue}>${getTotalEarnings()}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.acceptButton, isAccepting && styles.disabledButton]}
            onPress={handleAcceptBooking}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept Booking</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleRejectBooking}
            disabled={isAccepting}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : StatusBar.currentHeight || 0,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    zIndex: 100,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: -60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginLeft: 12,
    flex: 1,
  },
  geocodingOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -75 }, { translateY: -50 }],
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    zIndex: 1000,
    width: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  geocodingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  mapContainer: { flex: 1, position: "relative" },
  mapImage: { width: "100%", height: "100%" },
  driverMarker: { alignItems: "center", justifyContent: "center" },
  driverMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupMarker: { alignItems: "center", justifyContent: "center" },
  routeInfoContainer: {
    position: "absolute",
    top: 20,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  routeInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },
  routeInfoText: { fontSize: 14, fontWeight: "600", color: "#000000" },
  routeInfoSeparator: { fontSize: 14, color: "#666666", marginHorizontal: 4 },
  mapControls: {
    position: "absolute",
    bottom: height * 0.5 + 20,
    right: 16,
    gap: 12,
    zIndex: 10,
  },
  mapControlButton: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeLoadingContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    zIndex: 10,
  },
  routeLoadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 100,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  providerSection: { marginBottom: 20 },
  providerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  providerIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  providerIcon: { width: 24, height: 24, tintColor: "#FFFFFF" },
  providerInfo: { flex: 1 },
  providerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  orderNumber: { fontSize: 14, color: "#666666", marginBottom: 2 },
  status: { fontSize: 12, fontWeight: "500", textTransform: "uppercase" },
  orderDetailsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
  },
  orderDetailsText: { fontSize: 14, color: "#666666", fontWeight: "500" },
  locationContainer: {
    marginBottom: 20,
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  locationIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  blueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4285F4",
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
  },
  orangeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF8C00",
  },
  locationLine: {
    width: 2,
    height: 30,
    backgroundColor: "#DDD",
    marginLeft: 11,
    marginTop: -10,
    marginBottom: -10,
  },
  locationInfo: { flex: 1 },
  locationType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  locationAddress: { fontSize: 14, color: "#666666", lineHeight: 20 },
  tripDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  tripDetailItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  tripDetailText: { fontSize: 14, color: "#666", fontWeight: "500" },
  priceText: { fontSize: 20, fontWeight: "700", color: "#FF8C00" },
  costContainer: {
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  costLabel: { fontSize: 16, color: "#666666" },
  costValue: { fontSize: 16, fontWeight: "500", color: "#000000" },
  totalCostRow: { marginTop: 4 },
  totalLabel: { fontSize: 18, fontWeight: "600", color: "#000000" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#4CAF50" },
  divider: { height: 1, backgroundColor: "#E0E0E0", marginVertical: 4 },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 20,
    paddingTop: 0,
    backgroundColor: "#FFFFFF",
  },
  acceptButton: {
    flex: 1,
    height: 56,
    backgroundColor: "#FF8C00",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  acceptButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  rejectButton: {
    flex: 1,
    height: 56,
    backgroundColor: "#FF4444",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  rejectButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  disabledButton: { opacity: 0.6 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#FF0000",
    textAlign: "center",
    marginBottom: 20,
  },
  backToLocatorButton: {
    backgroundColor: colors.brandColor || "#FF8C00",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  backToLocatorText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500" },
});

export default DryCleaningPickup;
