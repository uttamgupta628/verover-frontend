import Contact from "@/components/LiveSessions/Contact";
import LocationCard from "@/components/LiveSessions/LocationCard";
import SessionDetails from "@/components/LiveSessions/SessionDetails";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon, IconButton } from "react-native-paper";
import { useSelector } from "react-redux";
import axiosInstance from "../../api/axios";
import colors from "../../assets/color";
import { RootState } from "../../components/redux/store";
import {
  calculateDuration,
  getSpacDetailsFromID,
} from "../../utils/slotIdConverter";
import { useStripeWrapper } from "../stripWrapper";
import BookingReceipt from "./BookingReceipt";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";

// ── Daily Rate ─────────────────────────────────────────────────────────────────
import { useDailyRate, computeDailyRateCost, SlotBreakdown } from "./Usedailyrate";
import DailyRatePreview from "./Dailyratepreview";

type PaymentMethod = "CARD" | "UPI";

interface UpiApp {
  id: string;
  name: string;
  icon: string;
  scheme: string;
}

const UPI_APPS: UpiApp[] = [
  { id: "gpay",    name: "Google Pay",  icon: "🟢", scheme: "tez://"     },
  { id: "phonepe", name: "PhonePe",     icon: "🟣", scheme: "phonepe://" },
  { id: "paytm",   name: "Paytm",       icon: "🔵", scheme: "paytmmp://" },
  { id: "bhim",    name: "BHIM UPI",    icon: "🟠", scheme: "upi://"     },
  { id: "other",   name: "Other UPI",   icon: "📱", scheme: "upi://"     },
];

interface CheckOutData {
  bookingId: string;
  garageName: string;
  slot: string;
  bookingPeriod: { from: string; to: string };
  vehicleNumber?: string;
  pricing: {
    priceRate?: number;
    basePrice: number;
    discount: number;
    serviceFee: number;
    transactionFee: number;
    estimatedTaxes: number;
    couponApplied: boolean;
    couponDetails: null | string;
    totalAmount: number;
  };
  stripeDetails?: {
    paymentIntent: string | null;
    ephemeralKey?: string;
    customerId: string;
    paymentIntentId: string;
  };
  upiDetails?: { upiId?: string; transactionRef?: string };
  placeInfo: {
    name: string;
    phoneNo: string;
    owner: string;
    address: string;
    location: any;
  };
}

interface CheckoutResponse {
  statusCode: number;
  data: CheckOutData;
  message: string;
  success: boolean;
}

interface CardDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

type UpiStatus = "idle" | "pending" | "verifying" | "success" | "failed";

// ── Helper: map type → venue type for daily rate API ──────────────────────────
function venueTypeFromBookingType(type: "G" | "L" | "R" | undefined) {
  if (type === "G") return "garage";
  if (type === "L") return "parking";
  if (type === "R") return "residence";
  return null;
}

const Confirmation = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const lot = React.useMemo(() => {
    try {
      if (params.lot) {
        const lotStr = Array.isArray(params.lot) ? params.lot[0] : params.lot;
        return JSON.parse(lotStr);
      }
      return null;
    } catch (error) {
      console.error("Error parsing lot:", error);
      return null;
    }
  }, [params.lot]);

  const type         = params.type as "G" | "L" | "R" | undefined;
  const endTime      = params.endTime as string;
  const selectedSpot = params.selectedSpot as string | undefined;
  const isMonthly    = params.isMonthly === "true";
  const months       = parseInt((params.months as string) || "1", 10);
  const isDaily      = params.isDaily === "true";

  const dailyStartTimeParam = params.startTime as string | undefined;

  const authToken = useSelector((state: RootState) => state.auth.token);
  const [loading,         setLoading]         = useState(false);
  const [fetchingVehicle, setFetchingVehicle] = useState(false);
  const [paymentLoading,  setPaymentLoading]  = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [data,            setData]            = useState<CheckOutData | null>(null);
  const [vehicleNumber,   setVehicleNumber]   = useState<string>("");
  const Stripe = useStripeWrapper();

  const [isPopupVisible,             setPopupVisible]             = useState(false);
  const [carPlateNumber,             setCarPlateNumber]           = useState("");
  const [paymentMethod,              setPaymentMethod]            = useState<PaymentMethod>("CARD");
  const [showPaymentMethodSelector,  setShowPaymentMethodSelector] = useState(false);
  const [showCardDetailsModal,       setShowCardDetailsModal]     = useState(false);
  const [savedCard,                  setSavedCard]                = useState<CardDetails | null>(null);
  const [cardNumber,                 setCardNumber]               = useState("");
  const [expiryDate,                 setExpiryDate]               = useState("");
  const [cvv,                        setCvv]                      = useState("");
  const [cardholderName,             setCardholderName]           = useState("");
  const [showUpiModal,               setShowUpiModal]             = useState(false);
  const [upiId,                      setUpiId]                    = useState("");
  const [upiIdError,                 setUpiIdError]               = useState("");
  const [selectedUpiApp,             setSelectedUpiApp]           = useState<UpiApp | null>(null);
  const [upiStatus,                  setUpiStatus]                = useState<UpiStatus>("idle");
  const upiPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showReceipt,      setShowReceipt]      = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const hasInitiatedCheckout = useRef(false);
  const isMounted            = useRef(true);
  const stripeInitialized    = useRef(false);

  const [userLocation,    setUserLocation]    = useState<LocationCoordinates | null>(null);
  const [lotLocation,     setLotLocation]     = useState<LocationCoordinates | null>(null);
  const [mapRegion,       setMapRegion]       = useState<LocationCoordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // ── Daily Rate integration ─────────────────────────────────────────────────
  const venueType = venueTypeFromBookingType(type);
  const venueId: string | null = lot?._id ?? null;

  const {
    dailyRateEnabled,
    dailyRates,
    loading: dailyRateLoading,
    computeCost,
  } = useDailyRate(
    isDaily ? venueType : null,
    isDaily ? venueId  : null
  );

  const dailyRateCost = useMemo(() => {
    if (!isDaily || !dailyRateEnabled || !data?.bookingPeriod) return null;
    const from = new Date(data.bookingPeriod.from);
    const to   = new Date(data.bookingPeriod.to);
    return computeCost(from, to);
  }, [isDaily, dailyRateEnabled, data?.bookingPeriod, computeCost]);

  const effectivePricing = useMemo(() => {
    if (!data) return null;

    if (isDaily && dailyRateEnabled && dailyRateCost) {
      const base           = dailyRateCost.totalAmount;
      const serviceFee     = parseFloat((base * 0.05).toFixed(2));
      const transactionFee = 0.50;
      const estimatedTaxes = parseFloat(
        ((base + serviceFee + transactionFee) * 0.15).toFixed(2)
      );
      const discount    = data.pricing.discount ?? 0;
      const totalAmount = parseFloat(
        (base + serviceFee + transactionFee + estimatedTaxes - discount).toFixed(2)
      );
      return {
        ...data.pricing,
        basePrice: base,
        serviceFee,
        transactionFee,
        estimatedTaxes,
        totalAmount,
      };
    }

    return data.pricing;
  }, [isDaily, dailyRateEnabled, dailyRateCost, data]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, "");
    const chunks  = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(" ").substr(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 2) return cleaned.substr(0, 2) + "/" + cleaned.substr(2, 2);
    return cleaned;
  };

  const validateUpiId = (id: string): boolean =>
    /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(id.trim());

  // ── Location ──────────────────────────────────────────────────────────────

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude:      location.coords.latitude,
        longitude:     location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    } catch {
      return null;
    }
  };

  const initializeMap = async () => {
    setLocationLoading(true);
    try {
      const userLoc = await getUserLocation();
      if (userLoc) setUserLocation(userLoc);

      let lotCoords: LocationCoordinates | null = null;
      if (data?.placeInfo?.location) {
        const [longitude, latitude] = data.placeInfo.location.coordinates;
        lotCoords = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      } else if (lot?.location) {
        const [longitude, latitude] = lot.location.coordinates;
        lotCoords = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      } else if (lot?.latitude && lot?.longitude) {
        lotCoords = { latitude: lot.latitude, longitude: lot.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      }

      if (lotCoords) {
        setLotLocation(lotCoords);
        if (userLoc) {
          const minLat = Math.min(userLoc.latitude, lotCoords.latitude);
          const maxLat = Math.max(userLoc.latitude, lotCoords.latitude);
          const minLng = Math.min(userLoc.longitude, lotCoords.longitude);
          const maxLng = Math.max(userLoc.longitude, lotCoords.longitude);
          setMapRegion({
            latitude:      (minLat + maxLat) / 2,
            longitude:     (minLng + maxLng) / 2,
            latitudeDelta: (maxLat - minLat) * 1.5,
            longitudeDelta: (maxLng - minLng) * 1.5,
          });
        } else {
          setMapRegion(lotCoords);
        }
      } else if (userLoc) {
        setMapRegion(userLoc);
      } else {
        setMapRegion({ latitude: 22.5726, longitude: 88.3639, latitudeDelta: 0.1, longitudeDelta: 0.1 });
      }
    } catch {
      setMapRegion({ latitude: 22.5726, longitude: 88.3639, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Checkout ──────────────────────────────────────────────────────────────

  const initiateCheckout = useCallback(
    async (plateNumber: string) => {
      if (!lot || !type) { Alert.alert("Error", "Invalid parameters"); return; }
      if (hasInitiatedCheckout.current) return;
      hasInitiatedCheckout.current = true;
      setLoading(true);
      setError(null);

      try {
        const startTime = (() => {
          if (isDaily && dailyStartTimeParam) {
            const d = new Date(dailyStartTimeParam);
            return d > new Date() ? d : new Date();
          }
          return new Date();
        })();

        const endTimeDate = new Date(endTime);

        if (endTimeDate <= startTime) {
          Alert.alert("Invalid Time", "End time must be after the start time");
          setLoading(false);
          hasInitiatedCheckout.current = false;
          return;
        }

        const bookingPeriod = { from: startTime.toISOString(), to: endTimeDate.toISOString() };
        const monthlyFields = { isMonthly, months: isMonthly ? months : undefined };

        const backendPaymentMethod =
          paymentMethod === "CARD" ? "CREDIT" : "UPI";

        let requestBody: any;
        let endpoint: string;

        if (type === "G") {
          const slotDetails = getSpacDetailsFromID(selectedSpot || "");
          endpoint    = "garage";
          requestBody = {
            garageId:      lot._id,
            bookedSlot:    slotDetails || { zone: "A", slot: 1 },
            bookingPeriod,
            vehicleNumber: plateNumber.trim().toUpperCase(),
            paymentMethod: backendPaymentMethod,
            ...monthlyFields,
          };
        } else if (type === "L") {
          const slotDetails = getSpacDetailsFromID(selectedSpot || "");
          endpoint    = "parkinglot";
          requestBody = {
            lotId:         lot._id,
            bookedSlot:    slotDetails || { zone: "A", slot: 1 },
            bookingPeriod,
            vehicleNumber: plateNumber.trim().toUpperCase(),
            paymentMethod: backendPaymentMethod,
            ...monthlyFields,
          };
        } else if (type === "R") {
          endpoint    = "residence";
          requestBody = {
            residenceId:   lot._id,
            bookingPeriod,
            vehicleNumber: plateNumber.trim().toUpperCase(),
            couponCode:    "",
            paymentMethod: backendPaymentMethod,
            ...monthlyFields,
          };
        } else {
          throw new Error("Invalid booking type");
        }

        const response = await axiosInstance.post<CheckoutResponse>(
          `/merchants/${endpoint}/checkout`,
          requestBody,
          {
            headers: { "Content-Type": "application/json", Authorization: authToken },
            withCredentials: true,
          }
        );

        if (response.data.success) {
          setData(response.data.data);
          setVehicleNumber(plateNumber.trim().toUpperCase());
          stripeInitialized.current = false;
          initializeMap();

          if (paymentMethod === "CARD" && response.data.data.stripeDetails) {
            await initializeStripePaymentSheet(response.data.data.stripeDetails);
          }
        } else {
          throw new Error(response.data.message || "Checkout failed");
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message || err.message || "Failed to retrieve booking details";
        setError(errorMessage);
        Alert.alert("Error", `${errorMessage}. Please try again.`);
        hasInitiatedCheckout.current = false;
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [lot, type, endTime, selectedSpot, authToken, paymentMethod, isMonthly, months,
     isDaily, dailyStartTimeParam]
  );

  // ── Vehicle number: fetch from backend first ──────────────────────────────

  const fetchVehicleNumberAndProceed = async () => {
    setFetchingVehicle(true);
    try {
      const res = await axiosInstance.get("/users/get-profile", {
        headers: { Authorization: authToken },
      });

      const profile = res.data?.data || res.data;
      const savedVehicleNumber =
        profile?.vehicleNumber ||
        profile?.vehicle_number ||
        profile?.vehicle ||
        null;

      if (savedVehicleNumber && savedVehicleNumber.trim().length >= 5) {
        const plate = savedVehicleNumber.trim().toUpperCase();
        setCarPlateNumber(plate);
        initiateCheckout(plate);
      } else {
        setCarPlateNumber("");
        setPopupVisible(true);
      }
    } catch (err) {
      console.warn("Could not fetch profile for vehicle number:", err);
      setCarPlateNumber("");
      setPopupVisible(true);
    } finally {
      setFetchingVehicle(false);
    }
  };

  // ── Plate modal submit ────────────────────────────────────────────────────

  const handleOkPress = async () => {
    const plateNumber = carPlateNumber.trim().toUpperCase();
    if (plateNumber === "") {
      Alert.alert("Required", "Please enter your car plate number to continue.");
      return;
    }
    if (plateNumber.length < 5) {
      Alert.alert(
        "Invalid Vehicle Number",
        "Vehicle number must be at least 5 characters long. Example: WB 01 AB 1234"
      );
      return;
    }
    setPopupVisible(false);

    try {
      await axiosInstance.patch(
        "/users/update-profile",
        { vehicleNumber: plateNumber },
        { headers: { Authorization: authToken } }
      );
    } catch {
      console.warn("Could not save vehicle number to profile");
    }

    initiateCheckout(plateNumber);
  };

  const handleGoHome = () => { setPopupVisible(false); router.replace("/userHome"); };

  // ── Payment method selector ───────────────────────────────────────────────

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    const oldMethod = paymentMethod;
    setPaymentMethod(method);
    setShowPaymentMethodSelector(false);
    if (oldMethod !== method && vehicleNumber) {
      hasInitiatedCheckout.current = false;
      initiateCheckout(vehicleNumber);
    }
  };

  // ── Card helpers ──────────────────────────────────────────────────────────

  const handleSaveCard = () => {
    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      Alert.alert("Required", "Please fill in all card details");
      return;
    }
    setSavedCard({ cardNumber: cardNumber.replace(/\s/g, ""), expiryDate, cvv, cardholderName });
    setShowCardDetailsModal(false);
    setCardNumber(""); setExpiryDate(""); setCvv(""); setCardholderName("");
    Alert.alert("Success", "Card details saved successfully!");
  };

  // ── UPI handlers ──────────────────────────────────────────────────────────

  const handleOpenUpiModal = () => {
    setUpiId("");
    setUpiIdError("");
    setSelectedUpiApp(null);
    setUpiStatus("idle");
    setShowUpiModal(true);
  };

  const buildUpiDeepLink = (app: UpiApp, amount: number, txnRef: string, merchantVpa: string): string => {
    const upiParams = new URLSearchParams({
      pa: merchantVpa,
      pn: data?.placeInfo?.name || "ParkEase",
      tr: txnRef,
      tn: `Parking booking ${data?.bookingId || ""}`,
      am: amount.toFixed(2),
      cu: "INR",
      mc: "7011",
    });

    if (app.id === "gpay")    return `tez://upi/pay?${upiParams.toString()}`;
    if (app.id === "phonepe") return `phonepe://pay?${upiParams.toString()}`;
    if (app.id === "paytm")   return `paytmmp://pay?${upiParams.toString()}`;
    return `upi://pay?${upiParams.toString()}`;
  };

  const pollUpiPaymentStatus = (bookingId: string) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 40;

    setUpiStatus("verifying");

    upiPollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const endpoint = type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence";
        const res = await axiosInstance.get(
          `/merchants/${endpoint}/payment-status/${bookingId}`,
          { headers: { Authorization: authToken } }
        );

        const status: string = res.data?.data?.paymentStatus || res.data?.data?.status || "";

        if (status === "SUCCESS" || status === "COMPLETED") {
          clearInterval(upiPollingRef.current!);
          setUpiStatus("success");
          setShowUpiModal(false);
          setCreatedBookingId(bookingId);
          setShowReceipt(true);
          return;
        }

        if (status === "FAILED" || status === "EXPIRED") {
          clearInterval(upiPollingRef.current!);
          setUpiStatus("failed");
          Alert.alert(
            "Payment Failed",
            "UPI payment was not completed. Please try again or choose another payment method.",
            [
              { text: "Retry UPI",  onPress: () => setUpiStatus("idle") },
              { text: "Cancel",     style: "cancel", onPress: () => setShowUpiModal(false) },
            ]
          );
          return;
        }
      } catch (e) {
        console.warn("UPI status poll error:", e);
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(upiPollingRef.current!);
        setUpiStatus("failed");
        Alert.alert(
          "Payment Timeout",
          "We could not confirm your UPI payment within 2 minutes. If money was deducted it will be refunded within 5–7 business days.",
          [
            { text: "Check Again", onPress: () => pollUpiPaymentStatus(bookingId) },
            { text: "OK",          onPress: () => setShowUpiModal(false) },
          ]
        );
      }
    }, 3000);
  };

  const handleUpiPayment = async () => {
    if (!data?.bookingId) {
      Alert.alert("Error", "Booking details not ready. Please try again.");
      return;
    }

    if (!selectedUpiApp && upiId.trim() === "") {
      setUpiIdError("Please enter your UPI ID or select an app above.");
      return;
    }
    if (upiId.trim() !== "" && !validateUpiId(upiId)) {
      setUpiIdError("Invalid UPI ID. Example: yourname@upi or number@paytm");
      return;
    }
    setUpiIdError("");
    setPaymentLoading(true);
    setUpiStatus("pending");

    const payableAmount = effectivePricing?.totalAmount ?? data.pricing.totalAmount;

    try {
      const endpoint = type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence";

      const bookingResponse = await axiosInstance.post(
        `/merchants/${endpoint}/book`,
        {
          bookingId:            data.bookingId,
          carLicensePlateImage: vehicleNumber,
          paymentMethod:        "UPI",
          ...(upiId.trim() !== "" && { userUpiId: upiId.trim() }),
        },
        {
          headers: { Authorization: authToken, "Content-Type": "application/json" },
          timeout: 20000,
        }
      );

      if (!bookingResponse.data.success) {
        throw new Error(bookingResponse.data.message || "Failed to initiate UPI payment");
      }

      const merchantVpa: string =
        bookingResponse.data?.data?.upiDetails?.upiId ||
        bookingResponse.data?.data?.merchantUpiId ||
        "merchant@upi";

      const txnRef: string =
        bookingResponse.data?.data?.upiDetails?.transactionRef ||
        bookingResponse.data?.data?.transactionRef ||
        data.bookingId;

      if (selectedUpiApp) {
        const deepLink = buildUpiDeepLink(selectedUpiApp, payableAmount, txnRef, merchantVpa);
        const canOpen  = await Linking.canOpenURL(deepLink);
        if (canOpen) {
          await Linking.openURL(deepLink);
        } else {
          const fallback        = `upi://pay?pa=${merchantVpa}&pn=ParkEase&tr=${txnRef}&am=${payableAmount.toFixed(2)}&cu=INR`;
          const canOpenFallback = await Linking.canOpenURL(fallback);
          if (canOpenFallback) {
            await Linking.openURL(fallback);
          } else {
            Alert.alert(
              "App Not Found",
              `${selectedUpiApp.name} does not appear to be installed. Please enter your UPI ID manually.`
            );
            setUpiStatus("idle");
            setPaymentLoading(false);
            return;
          }
        }
      }

      pollUpiPaymentStatus(data.bookingId);
    } catch (err: any) {
      setUpiStatus("failed");
      Alert.alert(
        "UPI Payment Error",
        err.response?.data?.message || err.message || "Failed to initiate UPI payment.",
        [
          { text: "Retry",  onPress: () => setUpiStatus("idle") },
          { text: "Cancel", style: "cancel", onPress: () => setShowUpiModal(false) },
        ]
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;
    if (!authToken) { router.replace("/Login"); return; }
    if (!lot || !type) { router.back(); return; }

    const timer = setTimeout(() => {
      if (isMounted.current && !hasInitiatedCheckout.current) {
        fetchVehicleNumberAndProceed();
      }
    }, 1000);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
      if (upiPollingRef.current) clearInterval(upiPollingRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading && lot) initializeMap();
  }, [lot]);

  // ── Stripe ────────────────────────────────────────────────────────────────

  const initializeStripePaymentSheet = async (stripeDetails: any) => {
    try {
      if (!stripeDetails?.paymentIntent || !stripeDetails?.ephemeralKey) return false;
      let customerId = stripeDetails.customerId || stripeDetails.paymentIntentId || "temp_" + Date.now();
      const initSuccess = await Stripe.initializedPaymentSheet(
        stripeDetails.paymentIntent,
        stripeDetails.ephemeralKey || "",
        customerId,
        stripeDetails.paymentIntentId
      );
      if (initSuccess) { stripeInitialized.current = true; return true; }
      return false;
    } catch {
      stripeInitialized.current = false;
      return false;
    }
  };

  // ── Main confirm ──────────────────────────────────────────────────────────

  const handleConfirmBooking = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert("Required", "Please enter your car plate number to continue.");
      setPopupVisible(true);
      return;
    }
    if (!data?.bookingId) {
      Alert.alert("Error", "Booking ID not available. Please try again.");
      return;
    }
    if (!type) { Alert.alert("Error", "Invalid booking type"); return; }

    if (paymentMethod === "CARD")     handleCardPayment();
    else if (paymentMethod === "UPI") handleOpenUpiModal();
  };

  // ── Card payment ──────────────────────────────────────────────────────────

  const handleCardPayment = async () => {
    if (!data?.stripeDetails?.paymentIntentId) {
      Alert.alert("Payment Error", "Payment configuration incomplete. Please try again.");
      return;
    }
    setPaymentLoading(true);
    try {
      const paymentResult = await Stripe.openPayment();
      if (paymentResult === true) {
        const endpoint =
          type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence";

        try {
          const bookingResponse = await axiosInstance.post(
            `/merchants/${endpoint}/book`,
            {
              bookingId:            data.bookingId,
              carLicensePlateImage: vehicleNumber,
              paymentMethod:        "CREDIT",
              paymentIntentId:      data.stripeDetails.paymentIntentId,
            },
            {
              headers: { Authorization: authToken, "Content-Type": "application/json" },
              timeout: 15000,
            }
          );

          if (bookingResponse.data.success) {
            if (bookingResponse.data.data?.placeInfo) {
              setData((prev) =>
                prev ? { ...prev, placeInfo: bookingResponse.data.data.placeInfo } : prev
              );
            }
            setCreatedBookingId(data.bookingId);
            setShowReceipt(true);
          } else {
            throw new Error(bookingResponse.data.message || "Booking confirmation failed");
          }
        } catch (bookError: any) {
          let errorMessage =
            bookError.response?.data?.message || "Booking confirmation failed.";
          if (errorMessage.includes("PAYMENT_VERIFICATION_FAILED"))
            errorMessage = "Payment verification failed. Please check your payment method and try again.";
          if (errorMessage.includes("INVALID_PAYMENT_INTENT"))
            errorMessage = "Payment session expired. Please restart the payment process.";
          Alert.alert("Payment Error", errorMessage, [
            { text: "Try Again", onPress: () => handleCardPayment() },
            { text: "Cancel",    style: "cancel" },
          ]);
        }
      } else {
        Alert.alert("Payment Cancelled", "Payment was not completed.", [
          { text: "OK", style: "cancel" },
        ]);
      }
    } catch (err: any) {
      if (!err.message?.toLowerCase().includes("cancel"))
        Alert.alert("Payment Error", err.message || "An error occurred during payment.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Receipt close ─────────────────────────────────────────────────────────

  const handleReceiptClose = () => {
    setShowReceipt(false);
    if (createdBookingId && type) {
      router.push({
        pathname: "/parkingUser/LiveSessionScreen",
        params: { bookingId: createdBookingId, type, bookingData: JSON.stringify(data) },
      });
    } else {
      router.replace("/userHome");
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!lot || !type) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid booking details</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayTotal = effectivePricing?.totalAmount ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Vehicle plate modal ─────────────────────────────────────────── */}
      <Modal animationType="fade" transparent visible={isPopupVisible} onRequestClose={() => {}}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Enter Vehicle Number</Text>
            <Text style={styles.modalSubText}>
              Your vehicle number is needed to complete the booking.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., WB 01 AB 1234 (min. 5 characters)"
              placeholderTextColor="#888"
              value={carPlateNumber}
              onChangeText={(t) => setCarPlateNumber(t.toUpperCase())}
              autoCapitalize="characters"
              onSubmitEditing={handleOkPress}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonOk]}
              onPress={handleOkPress}
              disabled={loading}
            >
              <Text style={styles.textStyle}>{loading ? "Processing..." : "Continue"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonGoHome]}
              onPress={handleGoHome}
              disabled={loading}
            >
              <Text style={styles.textStyle}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Payment method selector ─────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={showPaymentMethodSelector}
        onRequestClose={() => setShowPaymentMethodSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentMethodModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Method</Text>
              <TouchableOpacity onPress={() => setShowPaymentMethodSelector(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(["CARD", "UPI"] as PaymentMethod[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.paymentMethodItem, paymentMethod === m && styles.selectedMethod]}
                  onPress={() => handleSelectPaymentMethod(m)}
                >
                  <Text style={styles.methodIcon}>
                    {m === "CARD" ? "💳" : "📱"}
                  </Text>
                  <View style={styles.methodTextGroup}>
                    <Text style={styles.methodName}>
                      {m === "CARD" ? "Credit/Debit Card" : "UPI Payment"}
                    </Text>
                    {m === "UPI" && (
                      <Text style={styles.methodSubtitle}>Google Pay, PhonePe, Paytm & more</Text>
                    )}
                  </View>
                  {paymentMethod === m && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Card details modal ──────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={showCardDetailsModal}
        onRequestClose={() => setShowCardDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cardModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Card Details</Text>
              <TouchableOpacity onPress={() => setShowCardDetailsModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.cardForm}>
              <View style={styles.cardPreview}>
                <View style={styles.cardChip} />
                <Text style={styles.cardNumberPreview}>{cardNumber || "•••• •••• •••• ••••"}</Text>
                <View style={styles.cardBottomRow}>
                  <View>
                    <Text style={styles.cardLabel}>CARDHOLDER NAME</Text>
                    <Text style={styles.cardValue}>{cardholderName || "YOUR NAME"}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardLabel}>EXPIRES</Text>
                    <Text style={styles.cardValue}>{expiryDate || "MM/YY"}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Card Number</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor="#999"
                  value={cardNumber}
                  onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cardholder Name</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="John Doe"
                  placeholderTextColor="#999"
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>Expiry Date</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="MM/YY"
                    placeholderTextColor="#999"
                    value={expiryDate}
                    onChangeText={(t) => setExpiryDate(formatExpiryDate(t))}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="123"
                    placeholderTextColor="#999"
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.saveCardButton} onPress={handleSaveCard}>
                <Text style={styles.saveCardButtonText}>Save Card Details</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── UPI Payment Modal ───────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={showUpiModal}
        onRequestClose={() => {
          if (upiStatus !== "pending" && upiStatus !== "verifying") {
            if (upiPollingRef.current) clearInterval(upiPollingRef.current);
            setShowUpiModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.upiModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay with UPI</Text>
              {upiStatus !== "pending" && upiStatus !== "verifying" && (
                <TouchableOpacity
                  onPress={() => {
                    if (upiPollingRef.current) clearInterval(upiPollingRef.current);
                    setShowUpiModal(false);
                  }}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.upiScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.upiAmountChip}>
                <Text style={styles.upiAmountLabel}>Amount to Pay</Text>
                <Text style={styles.upiAmountValue}>
                  ₹{(effectivePricing?.totalAmount ?? 0).toFixed(2)}
                </Text>
              </View>

              {upiStatus === "pending" && (
                <View style={styles.upiStatusBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.upiStatusText}>Opening UPI app…</Text>
                </View>
              )}
              {upiStatus === "verifying" && (
                <View style={styles.upiStatusBox}>
                  <ActivityIndicator size="small" color="#FF9800" />
                  <Text style={[styles.upiStatusText, { color: "#FF9800" }]}>
                    Waiting for payment confirmation…
                  </Text>
                  <Text style={styles.upiStatusSubtext}>
                    Complete the payment in your UPI app. This screen updates automatically.
                  </Text>
                </View>
              )}
              {upiStatus === "failed" && (
                <View style={[styles.upiStatusBox, { backgroundColor: "#FFF3F3" }]}>
                  <Text style={{ fontSize: 24 }}>❌</Text>
                  <Text style={[styles.upiStatusText, { color: "#D32F2F" }]}>Payment not completed</Text>
                  <TouchableOpacity onPress={() => setUpiStatus("idle")} style={styles.upiRetryButton}>
                    <Text style={styles.upiRetryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(upiStatus === "idle" || upiStatus === "failed") && (
                <>
                  <Text style={styles.upiSectionLabel}>Select UPI App</Text>
                  <View style={styles.upiAppsGrid}>
                    {UPI_APPS.map((app) => (
                      <TouchableOpacity
                        key={app.id}
                        style={[
                          styles.upiAppButton,
                          selectedUpiApp?.id === app.id && styles.upiAppButtonSelected,
                        ]}
                        onPress={() => { setSelectedUpiApp(app); setUpiIdError(""); }}
                      >
                        <Text style={styles.upiAppIcon}>{app.icon}</Text>
                        <Text style={styles.upiAppName}>{app.name}</Text>
                        {selectedUpiApp?.id === app.id && (
                          <View style={styles.upiAppCheckBadge}>
                            <Text style={styles.upiAppCheckText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.upiDividerRow}>
                    <View style={styles.upiDividerLine} />
                    <Text style={styles.upiDividerText}>OR</Text>
                    <View style={styles.upiDividerLine} />
                  </View>

                  <Text style={styles.upiSectionLabel}>Enter UPI ID manually</Text>
                  <TextInput
                    style={[styles.upiIdInput, upiIdError ? styles.upiIdInputError : null]}
                    placeholder="yourname@upi / 9876543210@paytm"
                    placeholderTextColor="#aaa"
                    value={upiId}
                    onChangeText={(t) => { setUpiId(t); setUpiIdError(""); setSelectedUpiApp(null); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {upiIdError !== "" && (
                    <Text style={styles.upiIdErrorText}>{upiIdError}</Text>
                  )}

                  <View style={styles.upiInfoBox}>
                    <Text style={styles.upiInfoText}>
                      💡 Selecting an app opens it directly. Entering a UPI ID sends a collect request to your registered UPI app.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.upiPayButton,
                      (!selectedUpiApp && upiId.trim() === "") && styles.disabledButton,
                    ]}
                    onPress={handleUpiPayment}
                    disabled={paymentLoading || (!selectedUpiApp && upiId.trim() === "")}
                  >
                    {paymentLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.upiPayButtonText}>
                          {selectedUpiApp ? `Pay with ${selectedUpiApp.name}` : "Send Payment Request"}
                        </Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Booking receipt ─────────────────────────────────────────────── */}
      {data && effectivePricing && (
        <BookingReceipt
          visible={showReceipt}
          onClose={handleReceiptClose}
          bookingData={{
            bookingId:          data.bookingId,
            garageName:         data.garageName,
            slot:               data.slot,
            bookingPeriod:      data.bookingPeriod,
            vehicleNumber,
            pricing:            effectivePricing,
            placeInfo:          data.placeInfo,
            paymentMethod:      paymentMethod,
            dailyRateEnabled:   isDaily && dailyRateEnabled,
            dailyRateBreakdown: dailyRateCost?.breakdown,
          }}
          type={type}
        />
      )}

      {/* ── Main body ───────────────────────────────────────────────────── */}
      {loading || fetchingVehicle ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {fetchingVehicle ? "Loading your details..." : "Finalizing Details..."}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.customHeader}>
            <TouchableOpacity onPress={() => router.back()}>
              <IconButton icon="arrow-left" size={30} iconColor={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking Confirmation</Text>
          </View>

          {isMonthly && (
            <View style={styles.monthlyBadge}>
              <Text style={styles.monthlyBadgeText}>
                📅 Monthly Booking · {months} {months === 1 ? "month" : "months"}
              </Text>
            </View>
          )}

          <View style={styles.mapContainer}>
            {locationLoading ? (
              <View style={styles.mapLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.mapLoadingText}>Loading map...</Text>
              </View>
            ) : mapRegion ? (
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={mapRegion}
                showsUserLocation
                showsMyLocationButton
                zoomEnabled
                scrollEnabled
                rotateEnabled
              >
                {lotLocation && (
                  <Marker
                    coordinate={lotLocation}
                    title={data?.placeInfo.name || lot?.garageName || lot?.parkingName || lot?.residenceName || "Parking Location"}
                    description={data?.placeInfo.address || lot?.address || ""}
                    pinColor={colors.primary}
                  />
                )}
                {userLocation && (
                  <Marker coordinate={userLocation} title="Your Location" description="You are here" pinColor="#4CAF50" />
                )}
              </MapView>
            ) : (
              <View style={styles.mapErrorContainer}>
                <Text style={styles.mapErrorText}>Unable to load map</Text>
              </View>
            )}
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.bottomSheet}>
              <LocationCard
                name={data?.placeInfo.name || lot?.garageName || lot?.parkingName || lot?.residenceName || "Loading..."}
                address={data?.placeInfo.address || lot?.address || "Loading..."}
                price={data?.pricing.priceRate}
              />

              <View style={styles.sectionContainer}>
                <SessionDetails
                  parkingSlotId={data?.slot}
                  startingFrom={data?.bookingPeriod.from ? new Date(data.bookingPeriod.from).toString() : "Loading..."}
                  duration={
                    data?.bookingPeriod
                      ? isMonthly
                        ? `${months} ${months === 1 ? "month" : "months"}`
                        : calculateDuration(data.bookingPeriod.from, data.bookingPeriod.to)
                      : "Loading..."
                  }
                />
              </View>

              <View style={styles.sectionContainer}>
                <Contact phoneNo={lot?.contactNumber || data?.placeInfo.phoneNo} name={data?.placeInfo.owner || "John Doe"} />
              </View>

              {vehicleNumber ? (
                <View style={styles.vehicleContainer}>
                  <Text style={styles.vehicleLabel}>Vehicle Number</Text>
                  <View style={styles.vehicleNumberRow}>
                    <Text style={styles.vehicleNumber}>{vehicleNumber}</Text>
                    <TouchableOpacity
                      style={styles.changeVehicleButton}
                      onPress={() => { setCarPlateNumber(vehicleNumber); setPopupVisible(true); }}
                    >
                      <Text style={styles.changeVehicleText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View style={styles.fareSection}>
                {/* Payment method selector button */}
                <TouchableOpacity style={styles.walletButton} onPress={() => setShowPaymentMethodSelector(true)}>
                  <Text style={styles.methodIcon}>
                    {paymentMethod === "CARD" ? "💳" : "📱"}
                  </Text>
                  <View style={styles.walletContent}>
                    <Text style={styles.walletText}>
                      {paymentMethod === "CARD" ? "Credit/Debit Card" : "UPI Payment"}
                    </Text>
                    {paymentMethod === "CARD" && savedCard && (
                      <Text style={styles.cardInfo}>•••• {savedCard.cardNumber.slice(-4)}</Text>
                    )}
                    {paymentMethod === "UPI" && (
                      <Text style={styles.cardInfo}>Google Pay, PhonePe, Paytm & more</Text>
                    )}
                  </View>
                  <Icon source="chevron-right" size={24} color="#000000" />
                </TouchableOpacity>

                {/* UPI app quick-pick strip */}
                {paymentMethod === "UPI" && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.upiQuickStrip}>
                    {UPI_APPS.map((app) => (
                      <TouchableOpacity key={app.id} style={styles.upiQuickChip} onPress={handleOpenUpiModal}>
                        <Text style={styles.upiQuickIcon}>{app.icon}</Text>
                        <Text style={styles.upiQuickLabel}>{app.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Daily rate preview card */}
                {isDaily && data && dailyRateEnabled && (
                  <DailyRatePreview
                    slots={dailyRates}
                    enabled={dailyRateEnabled}
                    loading={dailyRateLoading}
                    breakdown={dailyRateCost?.breakdown}
                    totalAmount={dailyRateCost?.totalAmount}
                  />
                )}

                {/* Price breakdown */}
                {data && effectivePricing && (
                  <View style={styles.priceBreakdownCard}>
                    <View style={styles.priceBreakdownHeader}>
                      <Text style={styles.priceBreakdownTitle}>Price Breakdown</Text>
                      {isDaily && dailyRateEnabled && (
                        <View style={styles.dailyRatePillSmall}>
                          <Text style={styles.dailyRatePillText}>⏱ Time-Based</Text>
                        </View>
                      )}
                    </View>

                    {isMonthly && (
                      <View style={styles.monthlyBreakdownBadge}>
                        <Text style={styles.monthlyBreakdownBadgeText}>
                          Monthly rate × {months} {months === 1 ? "month" : "months"}
                        </Text>
                      </View>
                    )}

                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>
                        {isDaily && dailyRateEnabled
                          ? "Time-Based Parking Fee"
                          : `Base Price${
                              isMonthly
                                ? ` (${months} month${months > 1 ? "s" : ""} × monthly rate)`
                                : effectivePricing.priceRate
                                  ? ` (₹${effectivePricing.priceRate}/hr)`
                                  : ""
                            }`}
                      </Text>
                      <Text style={styles.priceRowValue}>
                        ₹{effectivePricing.basePrice.toFixed(2)}
                      </Text>
                    </View>

                    {isDaily && dailyRateEnabled && dailyRateCost && dailyRateCost.breakdown.length > 0 && (
                      <View style={styles.dailyRateMiniBreakdown}>
                        {dailyRateCost.breakdown.map((entry, idx) => (
                          <View key={idx} style={styles.dailyRateMiniRow}>
                            <Text style={styles.dailyRateMiniLabel}>
                              · {entry.label}{entry.repetitions > 1 ? ` ×${entry.repetitions}` : ""}
                            </Text>
                            <Text style={styles.dailyRateMiniValue}>₹{entry.charged.toFixed(2)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Service Fee (5%)</Text>
                      <Text style={styles.priceRowValue}>₹{effectivePricing.serviceFee?.toFixed(2) ?? "0.00"}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Transaction Fee</Text>
                      <Text style={styles.priceRowValue}>₹{effectivePricing.transactionFee?.toFixed(2) ?? "0.50"}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Estimated Taxes (15%)</Text>
                      <Text style={styles.priceRowValue}>₹{effectivePricing.estimatedTaxes?.toFixed(2) ?? "0.00"}</Text>
                    </View>
                    {effectivePricing.discount > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceRowLabel, styles.discountLabel]}>
                          Discount{effectivePricing.couponApplied && effectivePricing.couponDetails
                            ? ` (${effectivePricing.couponDetails})` : ""}
                        </Text>
                        <Text style={[styles.priceRowValue, styles.discountValue]}>
                          - ₹{effectivePricing.discount.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.priceDivider} />
                    <View style={styles.priceRow}>
                      <Text style={styles.priceTotalLabel}>Total</Text>
                      <Text style={styles.priceTotalValue}>₹{displayTotal.toFixed(2)}</Text>
                    </View>
                    {isDaily && dailyRateEnabled && (
                      <Text style={styles.dailyRateTotalNote}>
                        * Total includes time-based parking fee + service charges & taxes
                      </Text>
                    )}
                    <Text style={styles.taxNote}>* Estimated taxes may vary</Text>
                  </View>
                )}

                {/* Confirm row */}
                <View style={styles.totalFareContainer}>
                  <View style={styles.fareDetails}>
                    <View>
                      <Text style={styles.totalFareLabel}>Total Fare (*approx)</Text>
                      <Text style={styles.totalFareAmount}>
                        {effectivePricing ? `₹${displayTotal.toFixed(2)}` : "..."}
                      </Text>
                      {isDaily && dailyRateEnabled && (
                        <Text style={styles.dailyRateFareHint}>⏱ Time-based pricing</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.confirmButton, (!data || paymentLoading) && styles.disabledButton]}
                      onPress={handleConfirmBooking}
                      disabled={!data || paymentLoading}
                    >
                      {paymentLoading ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={[styles.confirmButtonText, { marginLeft: 8 }]}>Processing...</Text>
                        </View>
                      ) : (
                        <Text style={styles.confirmButtonText}>
                          {paymentMethod === "CARD" ? "Pay Now" : "Pay via UPI"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — completely unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { flexGrow: 1 },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 60,
    backgroundColor: "transparent",
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "500", color: "#000000" },

  monthlyBadge: {
    position: "absolute",
    top: 66, left: 16, right: 16,
    zIndex: 2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
    alignItems: "center",
  },
  monthlyBadgeText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  monthlyBreakdownBadge: {
    backgroundColor: "#EEF4FF",
    borderRadius: 6,
    paddingVertical: 4, paddingHorizontal: 8,
    marginBottom: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.primary + "44",
  },
  monthlyBreakdownBadgeText: { fontSize: 12, color: colors.primary, fontWeight: "600" },

  mapContainer: { marginTop: 50, height: 280, width: "100%", overflow: "hidden" },
  map: { width: "100%", height: "100%" },
  mapLoadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  mapLoadingText: { marginTop: 10, fontSize: 14, color: colors.primary },
  mapErrorContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  mapErrorText: { fontSize: 16, color: "#666" },

  bottomSheet: {
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    marginTop: -20,
  },
  sectionContainer: { marginTop: 16 },

  vehicleContainer: {
    marginTop: 16, marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12, padding: 16,
  },
  vehicleLabel: { fontSize: 14, color: "#666666", marginBottom: 6 },
  vehicleNumberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vehicleNumber: { fontSize: 18, fontWeight: "600", color: colors.primary },
  changeVehicleButton: {
    backgroundColor: colors.primary + "15",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.primary + "44",
  },
  changeVehicleText: { fontSize: 13, color: colors.primary, fontWeight: "600" },

  fareSection: { marginTop: 16, paddingHorizontal: 16, paddingBottom: 20, backgroundColor: "#FFFFFF", borderRadius: 12 },

  walletButton: {
    flexDirection: "row", alignItems: "center",
    padding: 16, backgroundColor: "#FFFFFF",
    borderRadius: 12, marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  methodIcon: { fontSize: 28, marginRight: 12 },
  methodTextGroup: { flex: 1 },
  walletContent: { flex: 1 },
  walletText: { fontSize: 16, fontWeight: "600", color: "#333" },
  cardInfo: { fontSize: 12, color: "#888", marginTop: 2 },
  methodName: { fontSize: 16, fontWeight: "500", color: "#333", flex: 1 },
  methodSubtitle: { fontSize: 12, color: "#888", marginTop: 2 },

  upiQuickStrip: { marginBottom: 12 },
  upiQuickChip: {
    alignItems: "center", backgroundColor: "#F0F4FF",
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    marginRight: 10, borderWidth: 1, borderColor: colors.primary + "33",
  },
  upiQuickIcon: { fontSize: 22, marginBottom: 4 },
  upiQuickLabel: { fontSize: 11, color: colors.primary, fontWeight: "600" },

  priceBreakdownCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16,
    marginBottom: 16, shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  priceBreakdownHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  priceBreakdownTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  priceRowLabel: { fontSize: 14, color: "#666", flex: 1 },
  priceRowValue: { fontSize: 14, color: "#333", fontWeight: "500" },
  discountLabel: { color: "#2E7D32" },
  discountValue: { color: "#2E7D32", fontWeight: "600" },
  priceDivider: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 8 },
  priceTotalLabel: { fontSize: 16, fontWeight: "700", color: "#000" },
  priceTotalValue: { fontSize: 18, fontWeight: "700", color: colors.primary },
  taxNote: { fontSize: 11, color: "#999", marginTop: 8, fontStyle: "italic" },

  totalFareContainer: { marginTop: 16, paddingHorizontal: 16 },
  fareDetails: { flexDirection: "row", justifyContent: "space-between", alignItems: "stretch" },
  totalFareLabel: { fontSize: 14, color: "#666666" },
  totalFareAmount: { fontSize: 24, color: colors.primary, fontWeight: "600", marginTop: 4 },
  confirmButton: {
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
    borderRadius: 24, paddingHorizontal: 24,
    minWidth: 150, height: 48,
  },
  confirmButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500" },
  disabledButton: { backgroundColor: "#cccccc", opacity: 0.5 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: colors.primary },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  errorText: { fontSize: 18, color: colors.primary, marginBottom: 20 },
  backButton: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  centeredView: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalView: {
    width: "85%", margin: 20, backgroundColor: "white",
    borderRadius: 20, padding: 25, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  modalText: { marginBottom: 6, textAlign: "center", fontSize: 18, fontWeight: "bold", color: "#333" },
  modalSubText: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 16, lineHeight: 18 },
  input: {
    height: 45, borderColor: "#ddd", borderWidth: 1,
    borderRadius: 8, marginBottom: 20, width: "100%",
    paddingHorizontal: 15, fontSize: 16, color: "#000", letterSpacing: 1,
  },
  modalButton: {
    borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10,
    elevation: 2, width: "100%", marginBottom: 10,
    justifyContent: "center", alignItems: "center",
  },
  buttonOk: { backgroundColor: colors.primary },
  buttonGoHome: { backgroundColor: "#6c757d" },
  textStyle: { color: "white", fontWeight: "bold", textAlign: "center", fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  paymentMethodModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "50%", paddingBottom: 20 },
  cardModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", paddingBottom: 20 },

  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  closeButton: { fontSize: 24, color: "#999", fontWeight: "bold" },

  paymentMethodItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  selectedMethod: { backgroundColor: "#f0f8ff" },
  checkMark: { fontSize: 20, color: colors.primary, fontWeight: "bold" },

  cardForm: { padding: 20 },
  cardPreview: {
    backgroundColor: colors.primary, borderRadius: 16, padding: 24,
    marginBottom: 24, minHeight: 200, justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  cardChip: { width: 50, height: 40, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 8, marginBottom: 20 },
  cardNumberPreview: { fontSize: 22, fontWeight: "600", color: "#fff", letterSpacing: 2, marginBottom: 20 },
  cardBottomRow: { flexDirection: "row", justifyContent: "space-between" },
  cardLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginBottom: 4, letterSpacing: 1 },
  cardValue: { fontSize: 14, fontWeight: "600", color: "#fff", textTransform: "uppercase" },

  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  cardInput: { height: 50, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 16, fontSize: 16, color: "#333", backgroundColor: "#f9f9f9" },
  rowInputs: { flexDirection: "row" },
  saveCardButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
  saveCardButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  upiModal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingBottom: 30 },
  upiScrollContent: { padding: 20 },
  upiAmountChip: {
    backgroundColor: colors.primary + "15", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 20, alignItems: "center",
    marginBottom: 20, borderWidth: 1, borderColor: colors.primary + "33",
  },
  upiAmountLabel: { fontSize: 12, color: colors.primary, fontWeight: "600", marginBottom: 4, letterSpacing: 0.5 },
  upiAmountValue: { fontSize: 28, color: colors.primary, fontWeight: "700" },

  upiStatusBox: { backgroundColor: "#FFF8E1", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16, gap: 8 },
  upiStatusText: { fontSize: 15, color: colors.primary, fontWeight: "600", textAlign: "center" },
  upiStatusSubtext: { fontSize: 13, color: "#666", textAlign: "center", marginTop: 4 },

  upiRetryButton: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 24 },
  upiRetryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  upiSectionLabel: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 10, letterSpacing: 0.3 },

  upiAppsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  upiAppButton: {
    width: "30%", alignItems: "center", paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA", position: "relative",
  },
  upiAppButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
  upiAppIcon: { fontSize: 26, marginBottom: 6 },
  upiAppName: { fontSize: 11, color: "#444", fontWeight: "600", textAlign: "center" },
  upiAppCheckBadge: {
    position: "absolute", top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  upiAppCheckText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  upiDividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  upiDividerLine: { flex: 1, height: 1, backgroundColor: "#E0E0E0" },
  upiDividerText: { marginHorizontal: 12, fontSize: 12, color: "#aaa", fontWeight: "600" },

  upiIdInput: {
    height: 50, borderWidth: 1.5, borderColor: "#DDD", borderRadius: 10,
    paddingHorizontal: 16, fontSize: 15, color: "#333",
    backgroundColor: "#FAFAFA", marginBottom: 6,
  },
  upiIdInputError: { borderColor: "#D32F2F" },
  upiIdErrorText: { fontSize: 12, color: "#D32F2F", marginBottom: 8 },

  upiInfoBox: { backgroundColor: "#F3F6FF", borderRadius: 10, padding: 12, marginVertical: 12 },
  upiInfoText: { fontSize: 12, color: "#555", lineHeight: 18 },

  upiPayButton: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 4, marginBottom: 8,
  },
  upiPayButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  dailyRatePillSmall: {
    backgroundColor: colors.primary + "18", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.primary + "40",
  },
  dailyRatePillText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  dailyRateMiniBreakdown: {
    backgroundColor: "#F8F9FF", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: colors.primary + "88",
  },
  dailyRateMiniRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  dailyRateMiniLabel: { fontSize: 12, color: "#666" },
  dailyRateMiniValue: { fontSize: 12, color: "#333", fontWeight: "600" },
  dailyRateTotalNote: { fontSize: 11, color: colors.primary + "BB", marginTop: 6, fontStyle: "italic" },
  dailyRateFareHint: { fontSize: 11, color: colors.primary, fontWeight: "600", marginTop: 2 },
});

export default Confirmation;