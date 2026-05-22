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
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
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
  KOLKATA: { latitude: 22.6431, longitude: 88.4176 },
};

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
  { routes: any; timestamp: number; distance: string; duration: string }
>();
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL = 1000;
let preferredProvider: "google" | "locationiq" = "google";
let googleFailureCount = 0;
const MAX_GOOGLE_FAILURES = 3;
let lastDirectionsRequestTime = 0;

const geocodeWithLocationIQ = async (
  address: string,
): Promise<Coordinate | null> => {
  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0)
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    return null;
  } catch {
    return null;
  }
};

const geocodeWithGoogle = async (
  address: string,
  retry = 0,
): Promise<Coordinate | null> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OVER_QUERY_LIMIT") {
      googleFailureCount++;
      if (googleFailureCount >= MAX_GOOGLE_FAILURES)
        preferredProvider = "locationiq";
      if (retry < 2) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, retry)));
        return geocodeWithGoogle(address, retry + 1);
      }
      return null;
    }
    if (data.status === "OK" && data.results?.[0]) {
      googleFailureCount = 0;
      const l = data.results[0].geometry.location;
      return { latitude: l.lat, longitude: l.lng };
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
  if (cached && cached.latitude && Date.now() - cached.timestamp < CACHE_EXPIRY)
    return cached;
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

const decodePolyline = (encoded: string): Coordinate[] => {
  const pts: Coordinate[] = [];
  let i = 0,
    lat = 0,
    lng = 0;
  while (i < encoded.length) {
    let b,
      sh = 0,
      r = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << sh;
      sh += 5;
    } while (b >= 0x20);
    lat += r & 1 ? ~(r >> 1) : r >> 1;
    sh = 0;
    r = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << sh;
      sh += 5;
    } while (b >= 0x20);
    lng += r & 1 ? ~(r >> 1) : r >> 1;
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
};

// ── Valid status flows (matches backend validTransitions exactly) ────────────
//
// LEG 1 (pickup): accepted → in_progress → pickup_completed
//                 → en_route_to_dropoff → arrived_at_dropoff → dropped_at_center
//
// LEG 2 (return delivery): ready_for_delivery → accepted → in_progress
//                 → pickup_completed → en_route_to_dropoff → arrived_at_dropoff
//                 → completed   ← NOTE: backend must allow arrived_at_dropoff→completed
//
// Backend validTransitions:
//   pending            → accepted | rejected | cancelled
//   accepted           → in_progress | cancelled
//   in_progress        → pickup_completed | cancelled
//   pickup_completed   → en_route_to_dropoff | cancelled
//   en_route_to_dropoff→ arrived_at_dropoff | cancelled
//   arrived_at_dropoff → dropped_at_center | cancelled   ← LEG1 end
//   dropped_at_center  → ready_for_delivery | cancelled
//   ready_for_delivery → accepted | cancelled             ← LEG2 start

const STATUS_FLOW_LEG1 = [
  "accepted",
  "in_progress",
  "pickup_completed",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
] as const;

// LEG 2: driver accepts the return delivery, then drives to customer.
// We reuse the same intermediate statuses (accepted → ... → arrived_at_dropoff)
// and finally call 'completed' — the backend must support arrived_at_dropoff→completed.
// If it doesn't yet, we patch it (see backend fix note below).
const STATUS_FLOW_LEG2 = [
  "accepted",
  "in_progress",
  "pickup_completed",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
] as const;

const updateStatusOnServer = async (
  status: string,
  bookingId: string,
  token: string,
  driverId: string,
  driverName: string,
): Promise<void> => {
  const payload: any = { bookingId, status, driverId, driverName };
  const now = new Date().toISOString();
  if (status === "in_progress") payload.startedAt = now;
  if (status === "pickup_completed") payload.pickupCompletedAt = now;
  if (status === "arrived_at_dropoff") payload.arrivedAt = now;
  const res = await axiosInstance.put("/users/update-status", payload, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
  if (!res.data.success)
    throw new Error(res.data.message || `Failed to update to ${status}`);
  await new Promise((r) => setTimeout(r, 300));
};

const progressLeg1ToDropoff = async (
  currentStatus: string,
  bookingId: string,
  token: string,
  driverId: string,
  driverName: string,
): Promise<void> => {
  const flow = [...STATUS_FLOW_LEG1];
  const currentIdx = flow.indexOf(currentStatus as any);
  const targetIdx = flow.indexOf("arrived_at_dropoff");
  if (currentIdx >= targetIdx) return;
  for (let i = Math.max(0, currentIdx + 1); i <= targetIdx; i++) {
    await updateStatusOnServer(flow[i], bookingId, token, driverId, driverName);
  }
};

// LEG 2: Progress from ready_for_delivery through intermediate statuses
// Step 1: ready_for_delivery → accepted  (driver claims the return delivery)
// Step 2: accepted → ... → arrived_at_dropoff  (same intermediate flow)
// Step 3: arrived_at_dropoff → completed  (final call — requires backend fix below)
const progressLeg2ToComplete = async (
  currentStatus: string,
  bookingId: string,
  token: string,
  driverId: string,
  driverName: string,
): Promise<void> => {
  // Step 1: If still at ready_for_delivery, first accept it
  if (currentStatus === "ready_for_delivery") {
    await updateStatusOnServer(
      "accepted",
      bookingId,
      token,
      driverId,
      driverName,
    );
    currentStatus = "accepted";
    await new Promise((r) => setTimeout(r, 400));
  }
  // Step 2: Progress through intermediate statuses up to arrived_at_dropoff
  const flow = [...STATUS_FLOW_LEG2];
  const currentIdx = flow.indexOf(currentStatus as any);
  const targetIdx = flow.indexOf("arrived_at_dropoff");
  if (currentIdx < targetIdx) {
    for (let i = Math.max(0, currentIdx + 1); i <= targetIdx; i++) {
      await updateStatusOnServer(
        flow[i],
        bookingId,
        token,
        driverId,
        driverName,
      );
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  // Step 3 is handled by the caller: arrived_at_dropoff → completed
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// LEG 1 (isReturnDelivery=false): customer → dry cleaner → status: dropped_at_center → receipt
// LEG 2 (isReturnDelivery=true) : dry cleaner → customer → status: completed → receipt
// ════════════════════════════════════════════════════════════════════════════
const DryCleaningDropoff = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);
  const hasFetchedRoute = useRef(false);
  const { user, token, isAuthenticated } = useSelector(
    (state: any) => state.auth,
  );

  const [bookingData, setBookingData] = useState<any>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  useEffect(() => {
    try {
      if (params.bookingData && typeof params.bookingData === "string") {
        setBookingData(JSON.parse(params.bookingData));
      } else if (params.bookingData && typeof params.bookingData === "object") {
        setBookingData(params.bookingData);
      }
    } catch {
      Alert.alert("Error", "Failed to parse booking data");
    }
  }, [params.bookingData]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!bookingData?.id && !bookingData?._id) {
        setBookingDetails(bookingData);
        return;
      }
      try {
        setLoadingBooking(true);
        const id = bookingData.id || bookingData._id;
        const res = await axiosInstance.get(`/users/bookings/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBookingDetails(res.data.success ? res.data.data : bookingData);
      } catch {
        setBookingDetails(bookingData);
      } finally {
        setLoadingBooking(false);
      }
    };
    if (bookingData) fetchDetails();
  }, [bookingData, token]);

  // isLeg2 determined from bookingData (passed from locator) — NOT from fetched bookingDetails
  const isLeg2 = !!bookingData?.isReturnDelivery;

  const [isCompleting, setIsCompleting] = useState(false);
  const [currLoc, setCurrLoc] = useState<Coordinate | null>(null);
  const [destinationLocation, setDestinationLocation] =
    useState<Coordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [isGeocodingDest, setIsGeocodingDest] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert("Authentication Required", "Please log in to continue", [
        { text: "OK", onPress: () => router.push("/login") },
      ]);
    }
  }, [isAuthenticated, token]);

  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please enable location.", [
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

  useEffect(() => {
    if (!bookingDetails) return;
    const address = bookingDetails.dropoffAddress || bookingDetails.dropOff;
    if (
      bookingDetails.dropoffCoords?.latitude &&
      bookingDetails.dropoffCoords?.longitude
    ) {
      setDestinationLocation(bookingDetails.dropoffCoords);
      return;
    }
    if (address) {
      (async () => {
        setIsGeocodingDest(true);
        const coords = await geocodeAddress(address);
        if (coords) setDestinationLocation(coords);
        else
          Alert.alert(
            "Location Not Found",
            "Unable to resolve destination address.",
          );
        setIsGeocodingDest(false);
      })();
    }
  }, [bookingDetails]);

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
    if (
      !currLoc ||
      !destinationLocation ||
      !mapReady ||
      hasFetchedRoute.current
    )
      return;
    hasFetchedRoute.current = true;
    fetchRoute(currLoc, destinationLocation);
  }, [currLoc, destinationLocation, mapReady, fetchRoute]);

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
    setRouteDistance(
      km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`,
    );
    const mins = Math.round((km / 40) * 60);
    setRouteDuration(
      mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`,
    );
  };

  const getDeliveryCharge = () =>
    parseFloat(
      String(
        bookingDetails?.pricing?.deliveryCharge ??
          bookingDetails?.deliveryCharge ??
          bookingDetails?.price ??
          0,
      ),
    ).toFixed(2);
  const getEstimatedTip = () =>
    parseFloat(
      String(
        bookingDetails?.pricing?.estimatedTip ??
          bookingDetails?.estimatedTip ??
          5,
      ),
    ).toFixed(2);
  const getTotalEarnings = () =>
    (parseFloat(getDeliveryCharge()) + parseFloat(getEstimatedTip())).toFixed(
      2,
    );

  // ── Build receipt data (shared by both legs) ──────────────────────────────
  const buildReceiptData = (
    bookingId: string,
    finalStatus: string,
    driverName: string,
  ) => ({
    ...bookingDetails,
    ...bookingData,
    id: bookingId,
    _id: bookingId,
    status: finalStatus,
    completedAt: new Date().toISOString(),
    deliveryCharge: getDeliveryCharge(),
    estimatedTip: getEstimatedTip(),
    totalEarnings: getTotalEarnings(),
    calculatedDistance: routeDistance || bookingData?.distance || "N/A",
    calculatedDuration: routeDuration || bookingData?.time || "N/A",
    driver: {
      id: user._id,
      name: driverName,
      phone: user.phoneNumber || user.phone || "N/A",
      email: user.email || "N/A",
    },
    pricing: {
      deliveryCharge: getDeliveryCharge(),
      estimatedTip: getEstimatedTip(),
      total: getTotalEarnings(),
    },
  });

  // ── Complete LEG 1 ────────────────────────────────────────────────────────
  // After drop off at dry cleaner → navigate to receipt
  const handleCompleteLeg1 = async () => {
    if (!bookingDetails?.id && !bookingDetails?._id) {
      Alert.alert("Error", "Missing booking ID.");
      return;
    }
    if (!isAuthenticated || !user?._id) {
      Alert.alert("Error", "Authentication required.");
      return;
    }
    Alert.alert(
      "Confirm Dropoff",
      "Have you successfully dropped off the items at the dry cleaning center?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setIsCompleting(true);
              const bookingId = bookingDetails.id || bookingDetails._id;
              const currentStatus = bookingDetails.status || "accepted";
              const driverName =
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.fullName ||
                "Driver";

              // Progress through LEG 1 intermediate statuses first
              if (
                !["arrived_at_dropoff", "dropped_at_center"].includes(
                  currentStatus,
                )
              ) {
                await progressLeg1ToDropoff(
                  currentStatus,
                  bookingId,
                  token,
                  user._id,
                  driverName,
                );
              }

              // Final LEG 1 status: dropped_at_center
              const res = await axiosInstance.put(
                "/users/update-status",
                {
                  bookingId,
                  status: "dropped_at_center",
                  dropoffCompletedAt: new Date().toISOString(),
                  driverId: user._id,
                  driverName,
                  routeDistance: routeDistance || "N/A",
                  routeDuration: routeDuration || "N/A",
                },
                {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 15000,
                },
              );

              if (!res.data.success)
                throw new Error(
                  res.data.message || "Failed to complete dropoff",
                );

              // Fire-and-forget notification
              axiosInstance
                .post(
                  "/users/notifications/send",
                  {
                    userId: bookingDetails?.user?._id || bookingDetails?.userId,
                    bookingId,
                    type: "dropoff_completed",
                    title: "Items Delivered to Dry Cleaner",
                    message:
                      "Your items have been dropped off at the dry cleaning center.",
                    driverName,
                  },
                  { headers: { Authorization: `Bearer ${token}` } },
                )
                .catch(() => {});

              // ── Navigate to receipt (same as LEG 2) ──
              const receiptData = buildReceiptData(
                bookingId,
                "dropped_at_center",
                driverName,
              );
              setTimeout(() => {
                router.replace({
                  pathname: "/dryCleanerDriver/recipet",
                  params: {
                    bookingData: JSON.stringify(receiptData),
                    success: "true",
                  },
                });
              }, 300);
            } catch (err: any) {
              const msg =
                err.response?.data?.message ||
                err.message ||
                "Failed to complete dropoff";
              Alert.alert("Error", msg, [
                { text: "Retry", onPress: handleCompleteLeg1 },
                {
                  text: "Go Back",
                  style: "cancel",
                  onPress: () => router.back(),
                },
              ]);
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ],
    );
  };

  // ── Complete LEG 2 ────────────────────────────────────────────────────────
  // FULL LEG 2 FLOW (matches backend validTransitions exactly):
  //   ready_for_delivery → accepted → in_progress → pickup_completed
  //   → en_route_to_dropoff → arrived_at_dropoff → completed
  //
  // REQUIRED backend fix (one line in updateBookingStatus validTransitions):
  //   arrived_at_dropoff: ["dropped_at_center", "completed", "cancelled"]
  //   (add "completed" so LEG 2 return delivery can finish properly)
  const handleCompleteLeg2 = async () => {
    if (!bookingDetails?.id && !bookingDetails?._id) {
      Alert.alert("Error", "Missing booking ID.");
      return;
    }
    if (!isAuthenticated || !user?._id) {
      Alert.alert("Error", "Authentication required.");
      return;
    }
    Alert.alert(
      "Confirm Delivery",
      "Have you successfully delivered the cleaned items to the customer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setIsCompleting(true);
              const bookingId = bookingDetails.id || bookingDetails._id;
              const driverName =
                `${user.firstName || ""}  ${user.lastName || ""}`.trim() ||
                user.fullName ||
                "Driver";
              const currentStatus =
                bookingDetails.status || "ready_for_delivery";

              // Step 1 & 2: progress through all intermediate statuses:
              //   ready_for_delivery → accepted → in_progress → pickup_completed
              //   → en_route_to_dropoff → arrived_at_dropoff
              if (
                !["arrived_at_dropoff", "completed"].includes(currentStatus)
              ) {
                await progressLeg2ToComplete(
                  currentStatus,
                  bookingId,
                  token,
                  user._id,
                  driverName,
                );
              }

              // Step 3: Final transition arrived_at_dropoff → completed
              const res = await axiosInstance.put(
                "/users/update-status",
                {
                  bookingId,
                  status: "completed",
                  completedAt: new Date().toISOString(),
                  driverId: user._id,
                  driverName,
                  routeDistance: routeDistance || "N/A",
                  routeDuration: routeDuration || "N/A",
                },
                {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 15000,
                },
              );

              if (!res.data.success)
                throw new Error(
                  res.data.message || "Failed to complete delivery",
                );

              // Fire-and-forget notification to customer
              axiosInstance
                .post(
                  "/users/notifications/send",
                  {
                    userId: bookingDetails?.user?._id || bookingDetails?.userId,
                    bookingId,
                    type: "delivery_completed",
                    title: "Delivery Completed",
                    message: "Your cleaned items have been delivered!",
                    driverName,
                  },
                  { headers: { Authorization: `Bearer ${token}` } },
                )
                .catch(() => {});

              const receiptData = buildReceiptData(
                bookingId,
                "completed",
                driverName,
              );
              setTimeout(() => {
                router.replace({
                  pathname: "/dryCleanerDriver/recipet",
                  params: {
                    bookingData: JSON.stringify(receiptData),
                    success: "true",
                  },
                });
              }, 300);
            } catch (err: any) {
              const msg =
                err.response?.data?.message ||
                err.message ||
                "Failed to complete delivery";
              Alert.alert("Error", msg, [
                { text: "Retry", onPress: handleCompleteLeg2 },
                {
                  text: "Go Back",
                  style: "cancel",
                  onPress: () => router.back(),
                },
              ]);
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ],
    );
  };

  const renderMap = () => {
    if (Platform.OS === "web")
      return (
        <Image source={images.BookingConfirmationMap} style={styles.mapImage} />
      );
    const center = currLoc || MOCK_COORDINATES.KOLKATA;
    const routeColor = isLeg2 ? "#2196F3" : "#FF8C00";
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
            strokeColor={routeColor}
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
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title={isLeg2 ? "Customer" : "Dry Cleaner"}
            identifier="destination"
            zIndex={2}
          >
            <View style={styles.destMarker}>
              <MaterialIcons
                name={isLeg2 ? "person-pin" : "store"}
                size={40}
                color={routeColor}
              />
            </View>
          </Marker>
        )}
      </MapView>
    );
  };

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
          <Text style={styles.headerTitle}>
            {isLeg2 ? "Deliver to Customer" : "Drop Off Dry Cleaning"}
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Authentication required</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookingDetails && !loadingBooking) {
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
          <Text style={styles.headerTitle}>
            {isLeg2 ? "Deliver to Customer" : "Drop Off Dry Cleaning"}
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No booking details found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const themeColor = isLeg2 ? "#2196F3" : "#FF8C00";
  const screenTitle = isLeg2 ? "Deliver to Customer" : "Drop Off Dry Cleaning";
  const statusLabel = isLeg2
    ? "RETURN DELIVERY IN PROGRESS"
    : "IN TRANSIT TO DRY CLEANER";
  const originLabel = isLeg2
    ? "Pick up from dry cleaner"
    : "Your current location";
  const originAddress = isLeg2
    ? bookingDetails?.pickupAddress ||
      bookingData?.pickupAddress ||
      "Dry Cleaner"
    : "Current GPS position";
  const destLabel = isLeg2 ? "Deliver to customer" : "Drop off at dry cleaner";
  const destAddress =
    bookingDetails?.dropoffAddress ||
    bookingDetails?.dropOff ||
    bookingData?.dropoffAddress ||
    "Destination";
  const btnLabel = isLeg2 ? "Complete Delivery" : "Complete Dropoff";
  const btnColor = isLeg2 ? "#2196F3" : "#4CAF50";
  const onComplete = isLeg2 ? handleCompleteLeg2 : handleCompleteLeg1;

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
        <Text style={styles.headerTitle}>{screenTitle}</Text>
        <View style={[styles.legBadge, { backgroundColor: themeColor }]}>
          <Text style={styles.legBadgeText}>{isLeg2 ? "LEG 2" : "LEG 1"}</Text>
        </View>
      </View>

      {isGeocodingDest && (
        <View style={styles.geocodingOverlay}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.geocodingText}>Finding location...</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        {renderMap()}
        {routeDistance ? (
          <View style={styles.routeInfoContainer}>
            <View style={styles.routeInfoCard}>
              <MaterialIcons name="directions" size={20} color={themeColor} />
              <Text style={styles.routeInfoText}>{routeDistance}</Text>
              <Text style={styles.routeInfoSeparator}>•</Text>
              <Text style={styles.routeInfoText}>{routeDuration}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={themeColor} />
            ) : (
              <MaterialIcons name="my-location" size={24} color={themeColor} />
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
              <MaterialIcons name="zoom-out-map" size={24} color={themeColor} />
            </TouchableOpacity>
          )}
        </View>
        {(isRouteLoading || loadingBooking) && (
          <View style={styles.routeLoadingContainer}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={styles.routeLoadingText}>
              {loadingBooking ? "Loading booking..." : "Calculating route..."}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomCard}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.providerSection}>
            <View style={styles.providerInfoRow}>
              <View
                style={[
                  styles.providerIconContainer,
                  { backgroundColor: themeColor },
                ]}
              >
                <Image source={images.washing} style={styles.providerIcon} />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {bookingDetails?.dryCleaner?.shopname ||
                    bookingDetails?.dryCleaner?.name ||
                    bookingData?.dryCleaner?.name ||
                    bookingData?.name ||
                    "Dry Cleaning Service"}
                </Text>
                <Text style={styles.orderNumber}>
                  Order:{" "}
                  {bookingDetails?.orderNumber ||
                    bookingData?.orderNumber ||
                    "N/A"}
                </Text>
                <Text style={[styles.status, { color: themeColor }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: isLeg2 ? "#2196F3" : "#4285F4" },
                  ]}
                />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>{originLabel}</Text>
                <Text style={styles.locationAddress}>{originAddress}</Text>
              </View>
            </View>
            <View style={styles.locationLine} />
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={[styles.dot, { backgroundColor: themeColor }]} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>{destLabel}</Text>
                <Text style={styles.locationAddress}>{destAddress}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tripDetails}>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="directions" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDistance || "Calculating..."}
              </Text>
            </View>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDuration || "Calculating..."}
              </Text>
            </View>
            <Text style={[styles.priceText, { color: themeColor }]}>
              ${getDeliveryCharge()}
            </Text>
          </View>

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

          {!isLeg2 && (
            <View style={styles.infoBanner}>
              <MaterialIcons name="info-outline" size={18} color="#FF8C00" />
              <Text style={styles.infoBannerText}>
                After dropoff, you will be redirected to the receipt. A new
                return delivery job will appear when cleaning is done.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.completeButton,
              { backgroundColor: btnColor },
              isCompleting && styles.disabledButton,
            ]}
            onPress={onComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>{btnLabel}</Text>
              </>
            )}
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
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginLeft: 12,
    flex: 1,
  },
  legBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  legBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
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
  destMarker: { alignItems: "center", justifyContent: "center" },
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
  providerInfoRow: { flexDirection: "row", alignItems: "center" },
  providerIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  status: { fontSize: 12, fontWeight: "500" },
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
  dot: { width: 12, height: 12, borderRadius: 6 },
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
  priceText: { fontSize: 20, fontWeight: "700" },
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFF8EE",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#FF8C00",
    marginBottom: 10,
  },
  infoBannerText: { fontSize: 13, color: "#7A4F00", flex: 1, lineHeight: 18 },
  buttonContainer: { padding: 20, paddingTop: 0, backgroundColor: "#FFFFFF" },
  completeButton: {
    flexDirection: "row",
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  completeButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  disabledButton: { opacity: 0.6 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: { fontSize: 18, color: "#FF0000", textAlign: "center" },
});

export default DryCleaningDropoff;
