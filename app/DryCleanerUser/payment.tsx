import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useStripeWrapper } from "../stripWrapper";
import axiosInstance from "../../api/axios";
import { useRouter } from "expo-router";
import Constants from 'expo-constants';
import {
  removeOrderItem,
  updateItemOptions,
  updateItemQuantity,
} from "../../components/redux/userSlice";

const generateFreshOrderNumber = () => {
  const prefix = "DCS";
  const timestamp = Date.now().toString().slice(-6);
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${timestamp}${randomNum}`;
};

const generateTrackingId = () => {
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  return randomNum.toString();
};

// Get Google Maps API key from expo config
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || "AIzaSyBn5c5hk6ko6gEwZ3IyWK6AkU4_U_tp_4g";

export default function OrderSummaryApp() {
  const router = useRouter();
  const dispatch = useDispatch();

  // Redux selectors
  const authToken = useSelector((state) => state.auth?.token);
  const user = useSelector((state) => state.auth.user);
  const scheduling = useSelector((state) => state.user?.scheduling);
  const addresses = useSelector((state) => state.user?.addresses);
  const orderData = useSelector((state) => state.user?.order);

  // User's pickup address
  const userAddress = useMemo(() => {
    if (addresses?.home?.fullAddress) {
      console.log("📍 Using home address as pickup:", addresses.home.fullAddress);
      return addresses.home.fullAddress;
    }

    if (addresses?.office?.fullAddress) {
      console.log("📍 Using office address as pickup:", addresses.office.fullAddress);
      return addresses.office.fullAddress;
    }

    console.log("⚠️ No user address found");
    return null;
  }, [addresses]);

  // Dry cleaner's delivery address
  const cleanerAddress = useMemo(() => {
    const cleaner = orderData?.selectedCleaner;
    if (!cleaner?.address) {
      console.log("⚠️ No cleaner address found");
      return null;
    }

    const addr = cleaner.address;
    if (typeof addr === "string") {
      console.log("🏪 Cleaner address (string):", addr);
      return addr;
    }

    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    
    const fullAddress = parts.join(", ") || null;
    console.log("🏪 Cleaner address (constructed):", fullAddress);
    return fullAddress;
  }, [orderData?.selectedCleaner]);

  // Stripe hook
  const {
    initializedPaymentSheet,
    openPayment,
    resetPaymentState,
    debugPaymentState,
    loading: stripeLoading,
    isReadyForPayment,
  } = useStripeWrapper();

  const paymentReadyRef = useRef(false);
  const [localPaymentReady, setLocalPaymentReady] = useState(false);

  const hasItems = useMemo(() => {
    return orderData?.items && orderData.items.length > 0;
  }, [orderData?.items]);

  const [showWashOnlyModal, setShowWashOnlyModal] = useState(false);
  const [showStarchLevelModal, setShowStarchLevelModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [globalPricing, setGlobalPricing] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedBookingId, setCompletedBookingId] = useState(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("debit");
  const [cardDetails, setCardDetails] = useState({
    holderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [orderNumber, setOrderNumber] = useState("");
  const [trackingId, setTrackingId] = useState("");

  // New state for distance
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState(null);

  useEffect(() => {
    if (!orderNumber) {
      const newOrderNumber = generateFreshOrderNumber();
      const newTrackingId = generateTrackingId();
      setOrderNumber(newOrderNumber);
      setTrackingId(newTrackingId);
    }
  }, []);

  const washOnlyOptions = useMemo(
    () => [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
    []
  );

  const starchLevelOptions = useMemo(
    () => [
      { label: "None", value: 1 },
      { label: "Light", value: 2 },
      { label: "Medium", value: 3 },
      { label: "Heavy", value: 4 },
    ],
    []
  );

  // Function to geocode address to coordinates
  const geocodeAddress = async (address) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results?.[0]) {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      }

      console.error("❌ Geocoding failed:", data.status);
      return null;
    } catch (error) {
      console.error("❌ Geocoding error:", error.message);
      return null;
    }
  };

  // Function to calculate distance using Geocoding + Direct calculation
  const calculateDistance = useCallback(async (origin, destination) => {
    if (!origin || !destination) {
      console.log("⚠️ Missing origin or destination for distance calculation");
      return 0;
    }

    console.log("🗺️ Calculating distance:");
    console.log("  Origin (User):", origin);
    console.log("  Destination (Cleaner):", destination);

    setDistanceLoading(true);
    setDistanceError(null);

    try {
      // Geocode both addresses
      console.log("📡 Geocoding addresses...");
      
      const originCoords = await geocodeAddress(origin);
      const destCoords = await geocodeAddress(destination);

      if (!originCoords || !destCoords) {
        console.error("❌ Failed to geocode addresses");
        setDistanceError("Unable to calculate distance. Using default.");
        setDistanceLoading(false);
        return 10;
      }

      console.log("✅ Origin coordinates:", originCoords);
      console.log("✅ Destination coordinates:", destCoords);

      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in kilometers
      const dLat = (destCoords.lat - originCoords.lat) * Math.PI / 180;
      const dLon = (destCoords.lng - originCoords.lng) * Math.PI / 180;
      
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(originCoords.lat * Math.PI / 180) * 
        Math.cos(destCoords.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceInKm = (R * c).toFixed(2);

      console.log("✅ Distance calculated:", distanceInKm, "km");
      
      setDeliveryDistance(parseFloat(distanceInKm));
      setDistanceLoading(false);
      return parseFloat(distanceInKm);
    } catch (error) {
      console.error("❌ Error calculating distance:", error.message);
      setDistanceError("Error calculating distance. Using default.");
      setDistanceLoading(false);
      return 10; // Default fallback distance
    }
  }, []);

  // Fetch global pricing from API
  const fetchGlobalPricing = useCallback(async () => {
    const defaultPricing = {
      deliveryChargePerKm: 25,
      serviceCharge: 0.15,
      platformFee: 2,
    };

    if (!authToken) {
      console.log("⚠️ No auth token, using default pricing");
      setGlobalPricing(defaultPricing);
      setLoading(false);
      return;
    }

    try {
      console.log("📡 Fetching global pricing...");
      const response = await fetch(
        "http://localhost:5000/api/users/admin/get-global-pricing",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const apiResponse = await response.json();
        console.log("✅ Global pricing response:", apiResponse);
        
        if (apiResponse.success && apiResponse.data) {
          const pricing = {
            deliveryChargePerKm: apiResponse.data.pricePerKm || 25,
            serviceCharge: 0.15,
            platformFee: 2,
          };
          console.log("✅ Using pricing:", pricing);
          setGlobalPricing(pricing);
        } else {
          console.log("⚠️ Invalid pricing response, using default");
          setGlobalPricing(defaultPricing);
        }
      } else {
        console.log("⚠️ Pricing API failed, using default");
        setGlobalPricing(defaultPricing);
      }
    } catch (error) {
      console.error("❌ Error fetching pricing:", error.message);
      setGlobalPricing(defaultPricing);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  // Fetch pricing on mount
  useEffect(() => {
    fetchGlobalPricing();
  }, [fetchGlobalPricing]);

  // Calculate distance when addresses are available
  useEffect(() => {
    const fetchDistance = async () => {
      if (userAddress && cleanerAddress && globalPricing) {
        console.log("🔄 Addresses available, calculating distance...");
        await calculateDistance(userAddress, cleanerAddress);
      } else {
        console.log("⏳ Waiting for addresses and pricing...");
        console.log("  User address:", !!userAddress);
        console.log("  Cleaner address:", !!cleanerAddress);
        console.log("  Global pricing:", !!globalPricing);
      }
    };

    fetchDistance();
  }, [userAddress, cleanerAddress, globalPricing, calculateDistance]);

  // Calculate order totals with dynamic delivery charge
  const calculations = useMemo(() => {
    if (!orderData?.items || !globalPricing) {
      return {
        subtotal: 0,
        serviceFees: 0,
        deliveryCharge: 0,
        platformFee: 0,
        total: 0,
      };
    }

    const subtotal = orderData.items.reduce((sum, item) => {
      const price = parseFloat(String(item.price || 0));
      const quantity = parseInt(String(item.quantity || 0), 10);
      return sum + price * quantity;
    }, 0);

    const serviceFees = subtotal * globalPricing.serviceCharge;
    
    // Use calculated distance or fallback to 10km
    const distanceToUse = deliveryDistance > 0 ? deliveryDistance : 10;
    const deliveryCharge = globalPricing.deliveryChargePerKm * distanceToUse;
    
    const platformFee = globalPricing.platformFee;
    const total = subtotal + serviceFees + deliveryCharge + platformFee;

    console.log("💰 Calculations:", {
      subtotal: subtotal.toFixed(2),
      serviceFees: serviceFees.toFixed(2),
      deliveryDistance: distanceToUse.toFixed(2),
      deliveryChargePerKm: globalPricing.deliveryChargePerKm,
      deliveryCharge: deliveryCharge.toFixed(2),
      platformFee: platformFee.toFixed(2),
      total: total.toFixed(2),
    });

    return {
      subtotal,
      serviceFees,
      deliveryCharge,
      platformFee,
      total,
    };
  }, [orderData?.items, globalPricing, deliveryDistance]);

  useEffect(() => {
    if (__DEV__) {
      console.log("=== DEBUG ===");
      console.log("Redux order exists:", !!orderData);
      console.log("Items count:", orderData?.items?.length || 0);
      console.log("Order Number:", orderNumber);
      console.log("User Address:", userAddress);
      console.log("Cleaner Address:", cleanerAddress);
      console.log("Delivery Distance (km):", deliveryDistance);
      console.log("Delivery Charge:", calculations.deliveryCharge);
      console.log("Total Amount:", calculations.total);
      console.log("=== END DEBUG ===");
    }
  }, [orderData, orderNumber, userAddress, cleanerAddress, deliveryDistance, calculations]);

  const getScheduledDateTime = (scheduling, type) => {
    const isPickup = type === "pickup";

    const isoDateTime = isPickup
      ? scheduling?.scheduledPickupDateTime
      : scheduling?.scheduledDeliveryDateTime;

    if (isoDateTime) {
      return isoDateTime;
    }

    const date = isPickup ? scheduling?.pickupDate : scheduling?.deliveryDate;
    const month = isPickup
      ? scheduling?.pickupMonth
      : scheduling?.deliveryMonth;
    const time = isPickup ? scheduling?.pickupTime : scheduling?.deliveryTime;

    if (!date || !month || !time) {
      console.error(`Missing ${type} scheduling data:`, { date, month, time });
      return new Date().toISOString();
    }

    try {
      const currentYear = new Date().getFullYear();
      const monthNumber =
        [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ].indexOf(month) + 1;

      const timeMatch = time.match(/(\d+):(\d+)(AM|PM)/);
      if (!timeMatch) return new Date().toISOString();

      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const period = timeMatch[3];

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      return new Date(
        currentYear,
        monthNumber - 1,
        parseInt(date),
        hours,
        minutes
      ).toISOString();
    } catch (error) {
      console.error(`Error formatting ${type} date:`, error);
      return new Date().toISOString();
    }
  };

  const buildISODate = (date, month, time) => {
    try {
      const currentYear = new Date().getFullYear();
      const currentDate = new Date();

      const monthNumber =
        [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ].indexOf(month) + 1;

      if (monthNumber === 0) {
        console.error("❌ Invalid month:", month);
        throw new Error(`Invalid month: ${month}`);
      }

      const timeMatch = time.match(/(\d+):(\d+)(AM|PM)/i);
      if (!timeMatch) {
        console.error("❌ Invalid time format:", time);
        throw new Error(`Invalid time format: ${time}`);
      }

      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const period = timeMatch[3].toUpperCase();

      if (period === "PM" && hours !== 12) {
        hours += 12;
      } else if (period === "AM" && hours === 12) {
        hours = 0;
      }

      if (
        isNaN(hours) ||
        isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        throw new Error(`Invalid time values: ${hours}:${minutes}`);
      }

      const dateNum = parseInt(date, 10);
      if (isNaN(dateNum) || dateNum < 1 || dateNum > 31) {
        throw new Error(`Invalid date: ${date}`);
      }

      let scheduledDate = new Date(
        currentYear,
        monthNumber - 1,
        dateNum,
        hours,
        minutes,
        0,
        0
      );

      if (scheduledDate <= currentDate) {
        console.log(`📅 Date ${date} ${month} is in the past, using next year`);
        scheduledDate = new Date(
          currentYear + 1,
          monthNumber - 1,
          dateNum,
          hours,
          minutes,
          0,
          0
        );
      }

      if (isNaN(scheduledDate.getTime())) {
        throw new Error("Invalid date created");
      }

      const isoString = scheduledDate.toISOString();
      console.log(`📅 Built ISO date: ${date} ${month} ${time} → ${isoString}`);

      return isoString;
    } catch (error) {
      console.error("❌ Error building ISO date:", error.message);
      throw error;
    }
  };

  const formatAddress = (address) => {
    if (!address) return "Not specified";

    if (typeof address === "string") {
      return address.trim() || "Not specified";
    }

    if (typeof address === "object" && address !== null) {
      if (address.fullAddress) {
        return address.fullAddress.trim() || "Not specified";
      }

      if (address.street || address.city) {
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        if (address.country) parts.push(address.country);
        return parts.join(", ") || "Not specified";
      }
    }

    return "Not specified";
  };

  const handlePayment = async () => {
    console.log("🚀 Starting payment process...");
    console.log("🔍 Initial checks:", {
      hasOrderData: !!orderData,
      hasCleaner: !!orderData?.selectedCleaner,
      hasScheduling: !!scheduling,
      hasUserAddress: !!userAddress,
      deliveryDistance: deliveryDistance,
    });

    if (!orderData || !orderData.selectedCleaner) {
      Alert.alert(
        "Error",
        "Please select a dry cleaner and add items to your order"
      );
      return;
    }

    if (!scheduling) {
      Alert.alert("Error", "Please schedule your pickup and delivery times");
      return;
    }

    if (!userAddress || userAddress === "Address not specified") {
      console.error("❌ No valid user address found");
      Alert.alert(
        "Address Required",
        "Please add a pickup address before proceeding with payment."
      );
      return;
    }

    if (!cleanerAddress) {
      console.error("❌ No valid cleaner address found");
      Alert.alert(
        "Error",
        "Cleaner address is not available. Please select a different cleaner."
      );
      return;
    }

    if (deliveryDistance === 0 || distanceLoading) {
      console.log("⏳ Distance still calculating...");
      Alert.alert(
        "Please Wait",
        "Calculating delivery distance. Please try again in a moment."
      );
      return;
    }

    console.log("✅ All validations passed");
    console.log("✅ Using user address:", userAddress);
    console.log("✅ Using cleaner address:", cleanerAddress);
    console.log("✅ Delivery distance:", deliveryDistance, "km");

    const freshOrderNumber = generateFreshOrderNumber();
    const freshTrackingId = generateTrackingId();
    setOrderNumber(freshOrderNumber);
    setTrackingId(freshTrackingId);

    console.log("🧹 Clearing any previous payment data...");
    resetPaymentState();

    setPaymentLoading(true);
    setLocalPaymentReady(false);
    paymentReadyRef.current = false;

    await new Promise((resolve) => setTimeout(resolve, 300));

    let createdBookingId = null;
    let currentStep = "";

    try {
      currentStep = "Building booking data";
      console.log(`📋 Step: ${currentStep}`);

      let scheduledPickupDateTime;
      let scheduledDeliveryDateTime;

      try {
        if (
          scheduling.scheduledPickupDateTime &&
          scheduling.scheduledDeliveryDateTime
        ) {
          scheduledPickupDateTime = scheduling.scheduledPickupDateTime;
          scheduledDeliveryDateTime = scheduling.scheduledDeliveryDateTime;
          console.log("✅ Using pre-formatted datetime strings from Redux");
        } else {
          console.log("🔨 Building datetime strings from scheduling data");

          scheduledPickupDateTime = buildISODate(
            scheduling.pickupDate,
            scheduling.pickupMonth,
            scheduling.pickupTime
          );

          scheduledDeliveryDateTime = buildISODate(
            scheduling.deliveryDate,
            scheduling.deliveryMonth,
            scheduling.deliveryTime
          );
        }
      } catch (dateError) {
        console.error("❌ Failed to build datetime strings:", dateError);
        Alert.alert(
          "Invalid Schedule",
          "There was an error with your pickup/delivery schedule. Please go back and select your times again."
        );
        setPaymentLoading(false);
        return;
      }

      const bookingData = {
        userId: user?._id,
        dryCleaner: orderData.selectedCleaner._id,

        orderItems: orderData.items.map((item) => ({
          itemId: item._id,
          name: item.name,
          category: item.category || "Clothes",
          quantity: item.quantity,
          price: item.price,
          starchLevel: item.starchLevel || 1,
          washOnly: item.washOnly || false,
          options: {
            washAndFold: item.options?.washAndFold || false,
            button: item.options?.button || false,
            zipper: item.options?.zipper || false,
          },
        })),

        isScheduled: true,
        scheduledPickupDateTime,
        scheduledDeliveryDateTime,

        pickupAddress: userAddress,
        dropoffAddress: cleanerAddress,

        orderNumber: freshOrderNumber,
        trackingId: freshTrackingId,

        pricing: {
          subtotal: calculations.subtotal,
          serviceFees: calculations.serviceFees,
          deliveryCharge: calculations.deliveryCharge,
          platformFee: calculations.platformFee,
          totalAmount: calculations.total,
        },

        distance: deliveryDistance,
        time: 30,
        price: calculations.subtotal,
        deliveryCharge: calculations.deliveryCharge,
        bookingType: "pickup",
        paymentMethod: paymentMethod.toUpperCase(),
        paymentStatus: "pending",
        status: "pending",
      };

      currentStep = "Validating booking data";
      console.log(`📋 Step: ${currentStep}`);

      const validationErrors = [];

      if (!user?._id) validationErrors.push("User ID is missing");
      if (!orderData.selectedCleaner?._id)
        validationErrors.push("Dry cleaner ID is missing");
      if (!scheduledPickupDateTime)
        validationErrors.push("Scheduled pickup date/time is invalid");
      if (!scheduledDeliveryDateTime)
        validationErrors.push("Scheduled delivery date/time is invalid");
      if (!userAddress || userAddress === "Address not specified") {
        validationErrors.push("Valid user address is required");
      }
      if (!cleanerAddress) {
        validationErrors.push("Valid cleaner address is required");
      }

      const now = new Date();
      const pickupDate = new Date(scheduledPickupDateTime);
      const deliveryDate = new Date(scheduledDeliveryDateTime);

      if (pickupDate <= now) {
        validationErrors.push("Scheduled pickup date must be in the future");
      }
      if (deliveryDate <= pickupDate) {
        validationErrors.push(
          "Scheduled delivery date must be after pickup date"
        );
      }
      if (!orderData.items || orderData.items.length === 0) {
        validationErrors.push("No items in order");
      }
      if (
        calculations.deliveryCharge === undefined ||
        calculations.deliveryCharge === null
      ) {
        validationErrors.push("Delivery charge is required");
      }
      if (deliveryDistance === 0) {
        validationErrors.push("Delivery distance is required");
      }

      if (validationErrors.length > 0) {
        console.error("❌ Validation errors:", validationErrors);
        throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
      }

      console.log("✅ Booking data validated");
      console.log("📦 Booking data:", JSON.stringify(bookingData, null, 2));

      currentStep = "Creating booking";
      console.log(`📋 Step: ${currentStep}`);

      const bookingResponse = await axiosInstance.post(
        "/users/create",
        bookingData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      if (!bookingResponse.data.success) {
        throw new Error(
          bookingResponse.data.message || "Failed to create booking"
        );
      }

      const createdBooking = bookingResponse.data.data;
      createdBookingId = createdBooking._id;
      setCompletedBookingId(createdBooking._id);

      console.log("✅ Booking created successfully:", createdBookingId);

      currentStep = "Creating payment intent";
      console.log(`📋 Step: ${currentStep}`);

      const paymentIntentResponse = await axiosInstance.post(
        "/users/payment-intent",
        {
          bookingId: createdBooking._id,
          orderNumber: freshOrderNumber,
          amount: Math.round(calculations.total * 100),
          currency: "usd",
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      if (!paymentIntentResponse.data.success) {
        throw new Error("Failed to create payment intent");
      }

      const { paymentIntent, ephemeralKey, customerId, paymentIntentId } =
        paymentIntentResponse.data.data;

      console.log("✅ NEW Payment intent received:", {
        paymentIntentId,
        clientSecretPrefix: paymentIntent?.substring(0, 30),
        clientSecretLength: paymentIntent?.length,
      });

      if (!paymentIntent || !paymentIntent.includes("_secret_")) {
        console.error("❌ Invalid payment intent format!");
        throw new Error("Invalid payment intent format received from server");
      }

      if (paymentIntentId && !paymentIntent.includes(paymentIntentId)) {
        console.error("❌ Payment intent ID mismatch!");
        console.error("Expected ID:", paymentIntentId);
        console.error("Client secret:", paymentIntent.substring(0, 50));
        throw new Error("Payment intent data mismatch - please try again");
      }

      currentStep = "Initializing payment sheet";
      console.log(`📋 Step: ${currentStep}`);
      console.log("💳 Initializing payment sheet with FRESH data...");
      console.log("   Payment Intent ID:", paymentIntentId);

      const initialized = await initializedPaymentSheet(
        paymentIntent,
        ephemeralKey,
        customerId,
        paymentIntentId
      );

      if (!initialized) {
        throw new Error("Failed to initialize payment sheet");
      }

      const stateAfterInit = debugPaymentState();
      console.log("✅ Payment sheet initialized");
      console.log(
        "🔍 Stored payment intent ID:",
        stateAfterInit.ref.paymentIntentId
      );
      console.log("🔍 Should match:", paymentIntentId);

      if (stateAfterInit.ref.paymentIntentId !== paymentIntentId) {
        console.error("❌ WARNING: Stored payment intent ID does not match!");
        console.error("Expected:", paymentIntentId);
        console.error("Got:", stateAfterInit.ref.paymentIntentId);
      }

      setLocalPaymentReady(true);
      paymentReadyRef.current = true;

      console.log("⏳ Waiting 2 seconds for payment sheet...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("💳 Opening payment sheet NOW...");
      console.log("💳 Using payment intent:", paymentIntentId);

      const paymentResult = await openPayment();

      console.log("💳 Payment result:", paymentResult);

      if (paymentResult === true) {
        console.log("✅ Payment successful!");
        currentStep = "Confirming payment";

        const confirmResponse = await axiosInstance.post(
          "/users/confirm-payment",
          {
            bookingId: createdBooking._id,
            orderNumber: freshOrderNumber,
            paymentIntentId: paymentIntentId || paymentIntent,
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          }
        );

        if (confirmResponse.data.success) {
          console.log("✅ Payment confirmed");
          setShowPaymentModal(false);
          setShowSuccessModal(true);
          resetPaymentState();
        } else {
          throw new Error("Payment confirmation failed");
        }
      } else if (paymentResult === false) {
        console.log("ℹ️ Payment cancelled");

        Alert.alert(
          "Payment Incomplete",
          "The payment was not completed. What would you like to do?",
          [
            {
              text: "Try Again",
              onPress: async () => {
                try {
                  const retryResult = await openPayment();
                  if (retryResult === true) {
                    const confirmResp = await axiosInstance.post(
                      "/users/confirm-payment",
                      {
                        bookingId: createdBookingId,
                        orderNumber: freshOrderNumber,
                        paymentIntentId,
                      },
                      {
                        headers: { Authorization: `Bearer ${authToken}` },
                        timeout: 15000,
                      }
                    );
                    if (confirmResp.data?.success) {
                      setShowPaymentModal(false);
                      setShowSuccessModal(true);
                      resetPaymentState();
                    }
                  }
                } catch (retryErr) {
                  Alert.alert("Retry Failed", retryErr.message);
                }
              },
            },
            {
              text: "Cancel Booking",
              style: "destructive",
              onPress: async () => {
                if (createdBookingId) {
                  await handleBookingCancellation(
                    createdBookingId,
                    freshOrderNumber,
                    "User cancelled"
                  );
                  resetPaymentState();
                  Alert.alert(
                    "Booking Cancelled",
                    "Your booking has been cancelled."
                  );
                  router.back();
                }
              },
            },
            {
              text: "Keep Pending",
              style: "cancel",
              onPress: () => {
                Alert.alert(
                  "Booking Pending",
                  "You can complete payment later from your orders."
                );
                router.back();
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error("❌ Payment error:", err.message);

      if (!err.message?.toLowerCase().includes("cancel")) {
        Alert.alert("Payment Failed", err.message);
      }
    } finally {
      console.log("🏁 Cleaning up...");
      setPaymentLoading(false);
      setLocalPaymentReady(false);
      paymentReadyRef.current = false;
    }
  };

  const handleBookingCancellation = async (
    bookingId,
    orderNumber,
    reason = "Payment cancelled by user"
  ) => {
    console.log("🔄 Attempting to cancel booking:", bookingId);

    try {
      const response = await axiosInstance.post(
        `/users/${bookingId}/cancel`,
        {
          orderNumber,
          reason,
        },
        {
          timeout: 10000,
        }
      );

      console.log("✅ Cancellation response:", response.data);

      if (response.data?.success) {
        console.log("✅ Booking cancelled successfully");
        return true;
      } else {
        console.log("⚠️ Cancellation failed but got response");
        return false;
      }
    } catch (error) {
      console.error("❌ Booking cancellation failed:", error.message);

      if (error.response) {
        console.error("Error details:", {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url,
          fullUrl: error.config?.baseURL + error.config?.url,
        });
      }

      return false;
    }
  };

  const toggleOption = useCallback(
    (itemId, optionName) => {
      const item = orderData?.items.find((i) => i._id === itemId);
      if (item) {
        const newOptions = {
          ...item.options,
          [optionName]: !item.options[optionName],
        };
        dispatch(
          updateItemOptions({
            itemId: itemId,
            options: newOptions,
            itemName: item.name,
          })
        );
      }
    },
    [orderData?.items, dispatch]
  );

  const deleteItem = useCallback(
    (id) => {
      const item = orderData?.items.find((i) => i._id === id);
      Alert.alert(
        "Remove Item",
        `Are you sure you want to remove "${
          item?.name || "this item"
        }" from your order?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              dispatch(removeOrderItem(id));
              Alert.alert(
                "Item Removed",
                `${item?.name || "Item"} has been removed from your order.`,
                [{ text: "OK" }]
              );
            },
          },
        ],
        { cancelable: true }
      );
    },
    [dispatch, orderData?.items]
  );

  const updateWashOnly = useCallback(
    (value) => {
      if (selectedItemId) {
        const item = orderData?.items.find((i) => i._id === selectedItemId);
        dispatch(
          updateItemOptions({
            itemId: selectedItemId,
            washOnly: value,
            itemName: item?.name,
          })
        );
        setShowWashOnlyModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId, dispatch, orderData?.items]
  );

  const updateStarchLevel = useCallback(
    (value) => {
      if (!selectedItemId) return;
      const itemList = orderData?.items ?? [];
      const item = itemList.find((i) => i._id === selectedItemId);
      if (item) {
        dispatch(
          updateItemOptions({
            itemId: selectedItemId,
            starchLevel: value,
            itemName: item.name,
          })
        );
      }
      setShowStarchLevelModal(false);
      setSelectedItemId(null);
    },
    [selectedItemId, dispatch, orderData]
  );

  const updateQuantity = useCallback(
    (itemId, newQuantity) => {
      const item = orderData?.items.find((i) => i._id === itemId);
      if (!item) return;
      const validQuantity = Math.max(0, Math.floor(newQuantity));
      if (validQuantity === 0) {
        Alert.alert(
          "Remove Item?",
          `Setting quantity to 0 will remove "${item.name}" from your order. Continue?`,
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Remove Item",
              style: "destructive",
              onPress: () => {
                dispatch(removeOrderItem(itemId));
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        dispatch(
          updateItemQuantity({
            itemId,
            quantity: validQuantity,
            itemName: item.name,
          })
        );
      }
    },
    [dispatch, orderData?.items]
  );

  const incrementQuantity = useCallback(
    (itemId) => {
      const item = orderData?.items.find((i) => i._id === itemId);
      if (!item) return;
      const currentQuantity = parseInt(String(item.quantity || 0), 10);
      const newQuantity = currentQuantity + 1;
      dispatch(
        updateItemQuantity({
          itemId,
          quantity: newQuantity,
          itemName: item.name,
        })
      );
    },
    [orderData?.items, dispatch]
  );

  const decrementQuantity = useCallback(
    (itemId) => {
      const item = orderData?.items.find((i) => i._id === itemId);
      if (!item) return;
      const currentQuantity = parseInt(String(item.quantity || 0), 10);
      if (currentQuantity <= 1) {
        Alert.alert(
          "Remove Item?",
          `This will remove "${item.name}" from your order. Continue?`,
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Remove",
              style: "destructive",
              onPress: () => {
                dispatch(removeOrderItem(itemId));
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        const newQuantity = currentQuantity - 1;
        dispatch(
          updateItemQuantity({
            itemId,
            quantity: newQuantity,
            itemName: item.name,
          })
        );
      }
    },
    [orderData?.items, dispatch]
  );

  const getItemTotal = useCallback((item) => {
    const price = parseFloat(String(item.price || 0));
    const quantity = parseInt(String(item.quantity || 0), 10);
    if (isNaN(price) || isNaN(quantity)) return 0;
    return price * quantity;
  }, []);

  const getStarchLevelText = useCallback((level) => {
    switch (level) {
      case 1:
        return "None";
      case 2:
        return "Light";
      case 3:
        return "Medium";
      case 4:
        return "Heavy";
      default:
        return "Medium";
    }
  }, []);

  const renderAddressText = useCallback((address) => {
    if (!address) return "No address provided";

    if (typeof address === "string") {
      return address.trim() || "No address provided";
    }

    if (typeof address === "object" && address !== null) {
      if (address.street || address.city) {
        const street = address.street || "";
        const city = address.city || "";
        const state = address.state || "";
        const country = address.country || "";

        const parts = [];
        if (street) parts.push(street);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (country) parts.push(country);

        return parts.join(", ") || "No address provided";
      }

      if (address.fullAddress) {
        return address.fullAddress.trim() || "No address provided";
      }
    }

    return "No address provided";
  }, []);

  const RadioButton = ({ selected, onPress, label }) => {
    if (!label) return null;

    return (
      <TouchableOpacity style={styles.radioContainer} onPress={onPress}>
        <View style={[styles.radioButton, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
        {label && <Text style={styles.radioLabel}>{label}</Text>}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading order summary...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7FA" />
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={35} color="#FF8C00" />
        </TouchableOpacity>
        <Text style={styles.title}>Order Summary</Text>
      </View>

      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>Order Sub-Total</Text>
        <TouchableOpacity>
          <Text style={styles.subtitle2}>ORDER</Text>
        </TouchableOpacity>
      </View>

      {orderNumber ? (
        <View style={styles.orderNumberCard}>
          <Text style={styles.orderNumberLabel}>PAY FOR</Text>
          <Text style={styles.orderNumberValue}>#{orderNumber}</Text>
        </View>
      ) : null}

      {orderData?.selectedCleaner ? (
        <View style={styles.cleanerInfoCard}>
          <Text style={styles.cleanerName}>
            {orderData.selectedCleaner.shopname || "Unknown Cleaner"}
          </Text>
          <Text style={styles.cleanerAddress}>
            {renderAddressText(orderData.selectedCleaner.address)}
          </Text>
          {orderData.selectedCleaner.rating ? (
            <Text style={styles.cleanerRating}>
              {`Rating: ${String(orderData.selectedCleaner.rating)}★`}
            </Text>
          ) : null}
          {distanceLoading ? (
            <View style={styles.distanceContainer}>
              <ActivityIndicator size="small" color="#FF8C00" />
              <Text style={styles.distanceText}>Calculating distance...</Text>
            </View>
          ) : deliveryDistance > 0 ? (
            <Text style={styles.distanceText}>
              📍 Distance: {deliveryDistance.toFixed(2)} km
            </Text>
          ) : distanceError ? (
            <Text style={styles.distanceErrorText}>
              ⚠️ {distanceError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!hasItems ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items in your order</Text>
          <TouchableOpacity
            style={styles.addItemsButton}
            onPress={() => router.back()}
          >
            <Text style={styles.addItemsButtonText}>Add Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.itemsContainer}
            showsVerticalScrollIndicator={false}
          >
            {orderData?.items?.map((item) => (
              <View key={item._id || item.name} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemNameContainer}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name || "Unknown Item"}
                    </Text>
                    <Text style={styles.itemSubtotal}>
                      Total: ${getItemTotal(item).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.priceQuantityContainer}>
                    <Text style={styles.itemPrice}>
                      ${parseFloat(String(item.price || 0)).toFixed(2)} each
                    </Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={[
                          styles.quantityButton,
                          parseInt(String(item.quantity || 0)) <= 1 &&
                            styles.quantityButtonDisabled,
                        ]}
                        onPress={() => decrementQuantity(item._id)}
                        activeOpacity={0.7}
                        disabled={parseInt(String(item.quantity || 0)) <= 0}
                      >
                        <Text
                          style={[
                            styles.quantityButtonText,
                            parseInt(String(item.quantity || 0)) <= 1 &&
                              styles.quantityButtonTextDisabled,
                          ]}
                        >
                          −
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>
                        {parseInt(String(item.quantity || 0))}
                      </Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => incrementQuantity(item._id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.optionsContainer}>
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => {
                        setSelectedItemId(item._id);
                        setShowWashOnlyModal(true);
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        Wash Only: {item.washOnly ? "Yes" : "No"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => {
                        setSelectedItemId(item._id);
                        setShowStarchLevelModal(true);
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        Starch Level:{" "}
                        {getStarchLevelText(item.starchLevel || 3)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.checkboxContainer}>
                    {item.options?.zipper !== undefined ? (
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          item.options.zipper && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleOption(item._id, "zipper")}
                      >
                        <View style={styles.checkboxInner}>
                          {item.options.zipper ? (
                            <Text style={styles.checkmark}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={styles.checkboxText}>Zipper</Text>
                      </TouchableOpacity>
                    ) : null}
                    {item.options?.button !== undefined ? (
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          item.options.button && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleOption(item._id, "button")}
                      >
                        <View style={styles.checkboxInner}>
                          {item.options.button ? (
                            <Text style={styles.checkmark}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={styles.checkboxText}>Button</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        item.options?.washAndFold && styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, "washAndFold")}
                    >
                      <View style={styles.checkboxInner}>
                        {item.options?.washAndFold ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : null}
                      </View>
                      <Text style={styles.checkboxText}>Wash & Fold</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteItem(item._id)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="delete" size={20} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sub Total</Text>
              <Text style={styles.summaryValue}>
                ${calculations?.subtotal?.toFixed(2) ?? "0.00"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Service Fees (
                {((globalPricing?.serviceCharge ?? 0.15) * 100).toFixed(0)}%)
              </Text>
              <Text style={styles.summaryValue}>
                ${calculations?.serviceFees?.toFixed(2) ?? "0.00"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery Charge ({deliveryDistance > 0 ? deliveryDistance.toFixed(2) : '10'}km @ $
                {globalPricing?.deliveryChargePerKm ?? 25}/km)
                {distanceLoading && " ⏳"}
              </Text>
              <Text style={styles.summaryValue}>
                ${calculations?.deliveryCharge?.toFixed(2) ?? "0.00"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee</Text>
              <Text style={styles.summaryValue}>
                ${calculations?.platformFee?.toFixed(2) ?? "0.00"}
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Payment</Text>
              <Text style={styles.totalValue}>
                ${calculations?.total?.toFixed(2) ?? "0.00"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.continueButton,
                (distanceLoading || deliveryDistance === 0) && styles.disabledButton
              ]}
              onPress={() => setShowPaymentModal(true)}
              disabled={distanceLoading || deliveryDistance === 0}
            >
              <Text style={styles.continueButtonText}>
                {distanceLoading ? "Calculating Distance..." : "Place Your Order"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.paymentModalContainer}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentModalHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FF8C00" />
              </TouchableOpacity>
              <Text style={styles.paymentModalTitle}>Add card</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.paymentScrollView}
            >
              <Text style={styles.sectionLabel}>Card information</Text>
              <View style={styles.cardInputContainer}>
                <TextInput
                  style={styles.cardNumberInput}
                  placeholder="Card number"
                  placeholderTextColor="#9ca3af"
                  value={cardDetails.cardNumber}
                  onChangeText={(text) =>
                    setCardDetails({ ...cardDetails, cardNumber: text })
                  }
                  keyboardType="numeric"
                />
                <View style={styles.cardLogos}>
                  <Text style={styles.cardLogo}>VISA</Text>
                  <Text style={styles.cardLogo}>MC</Text>
                  <Text style={styles.cardLogo}>AMEX</Text>
                  <Text style={styles.cardLogo}>JCB</Text>
                </View>
              </View>

              <View style={styles.expiryAndCvcRow}>
                <TextInput
                  style={[styles.cardInput, styles.expiryInput]}
                  placeholder="MM / YY"
                  placeholderTextColor="#9ca3af"
                  value={cardDetails.expiry}
                  onChangeText={(text) =>
                    setCardDetails({ ...cardDetails, expiry: text })
                  }
                  keyboardType="numeric"
                />
                <View style={styles.cvcContainer}>
                  <TextInput
                    style={styles.cvcInput}
                    placeholder="CVC"
                    placeholderTextColor="#9ca3af"
                    value={cardDetails.cvv}
                    onChangeText={(text) =>
                      setCardDetails({ ...cardDetails, cvv: text })
                    }
                    keyboardType="numeric"
                    secureTextEntry
                  />
                  <MaterialIcons name="credit-card" size={16} color="#666" />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Billing address</Text>
              <View style={styles.billingAddressContainer}>
                <View style={styles.countrySelector}>
                  <Text style={styles.countryText}>United States</Text>
                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={20}
                    color="#666"
                  />
                </View>
                <TextInput
                  style={styles.zipInput}
                  placeholder="ZIP Code"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.cardTypeContainer}>
                <RadioButton
                  selected={paymentMethod === "debit"}
                  onPress={() => setPaymentMethod("debit")}
                  label="Debit Card"
                />
                <RadioButton
                  selected={paymentMethod === "credit"}
                  onPress={() => setPaymentMethod("credit")}
                  label="Credit Card"
                />
              </View>

              <TouchableOpacity style={styles.saveDetailsContainer}>
                <View style={styles.checkbox}>
                  <View style={styles.checkboxInner} />
                </View>
                <Text style={styles.saveDetailsText}>
                  Save payment details to Vervoer Pvt. Lmt. for future purchases
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.payButton,
                paymentLoading && styles.disabledButton,
              ]}
              activeOpacity={0.8}
              onPress={handlePayment}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.loadingText}>Processing...</Text>
                </View>
              ) : (
                <View style={styles.payButtonContent}>
                  <Text style={styles.payButtonText}>
                    Pay ${calculations?.total?.toFixed(2) ?? "0.00"}
                  </Text>
                  <MaterialIcons name="lock" size={16} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successModalContent}>
              <View style={styles.successIconContainer}>
                <View style={styles.successIcon}>
                  <MaterialIcons name="check" size={28} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.successTitle}>Submitted Successfully</Text>
              <Text style={styles.successSubtitle}>
                Your Order #{orderNumber} Is Completed
              </Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Navigate to receipt page
                  router.push({
                    pathname: "/dryCleanerUser/orderReceiptPage",
                    params: {
                      orderId: completedBookingId,
                      orderNumber: orderNumber,
                      trackingId: trackingId,
                      totalAmount: calculations.total,
                      orderData: JSON.stringify({
                        items: orderData?.items,
                        cleaner: orderData?.selectedCleaner,
                        addresses: addresses,
                        scheduling: scheduling,
                      }),
                    },
                  });
                }}
              >
                <Text style={styles.successButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWashOnlyModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Wash Only</Text>
            {washOnlyOptions.map((option) => (
              <TouchableOpacity
                key={String(option.value)}
                style={styles.modalOption}
                onPress={() => updateWashOnly(option.value)}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowWashOnlyModal(false);
                setSelectedItemId(null);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStarchLevelModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starch Level</Text>
            {starchLevelOptions.map((option) => (
              <TouchableOpacity
                key={String(option.value)}
                style={styles.modalOption}
                onPress={() => updateStarchLevel(option.value)}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowStarchLevelModal(false);
                setSelectedItemId(null);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7FA",
    paddingTop: 60,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 40,
    top: 29,
    flexDirection: "row",
    alignItems: "center",
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  distanceText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  distanceErrorText: {
    fontSize: 12,
    color: "#FF6B6B",
    marginTop: 4,
  },
  disabledButton: {
    backgroundColor: "#CCC",
    opacity: 0.6,
  },
  title: {
    fontSize: 18,
    fontWeight: "400",
    color: "#000000",
    marginLeft: 15,
  },
  subtitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: -20,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "300",
    color: "#707070",
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF8C00",
  },
  orderNumberCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE4B5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumberLabel: {
    fontSize: 16,
    fontWeight: "400",
    color: "#666",
  },
  orderNumberValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF8C00",
    letterSpacing: 1,
  },
  cleanerInfoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  cleanerAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  cleanerRating: {
    fontSize: 14,
    color: "#F99026",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 10,
    textAlign: "center",
  },
  addItemsButton: {
    backgroundColor: "#F99026",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  addItemsButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -10,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 5,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: "500",
    color: "#F99026",
  },
  priceQuantityContainer: {
    alignItems: "flex-end",
    minWidth: 120,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F99026",
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginHorizontal: 2,
  },
  quantityButtonDisabled: {
    backgroundColor: "#F0F0F0",
    shadowOpacity: 0.05,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  quantityButtonTextDisabled: {
    color: "#999",
  },
  quantityText: {
    fontSize: 16,
    color: "#333",
    marginHorizontal: 15,
    minWidth: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  optionsContainer: {
    gap: 15,
    position: "relative",
  },
  dropdownContainer: {
    flexDirection: "row",
    gap: 10,
  },
  dropdown: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minHeight: 44,
    justifyContent: "center",
  },
  dropdownText: {
    color: "#666",
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    minHeight: 40,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  checkboxChecked: {
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
  },
  checkmark: {
    color: "#FF8C00",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxText: {
    color: "#666",
    fontSize: 14,
  },
  deleteButton: {
    position: "absolute",
    right: 20,
    top: 55,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summary: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
    marginRight: 10,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "right",
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#F99026",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    flex: 1,
    marginRight: 10,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F99026",
    textAlign: "right",
  },
  continueButton: {
    backgroundColor: "#F99026",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 20,
    alignItems: "center",
    shadowColor: "#F99026",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  paymentModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  paymentModalContent: {
    backgroundColor: "#000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 20,
  },
  paymentModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    marginRight: 15,
  },
  paymentModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFF",
  },
  paymentScrollView: {
    paddingHorizontal: 20,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    color: "#CCC",
    marginBottom: 15,
    marginTop: 10,
  },
  cardInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  cardNumberInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    paddingVertical: 8,
  },
  cardLogos: {
    flexDirection: "row",
    gap: 8,
  },
  cardLogo: {
    color: "#CCC",
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "#444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiryAndCvcRow: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 20,
  },
  cardInput: {
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: "#FFF",
    fontSize: 16,
  },
  expiryInput: {
    flex: 1,
  },
  cvcContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  cvcInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    paddingVertical: 3,
  },
  billingAddressContainer: {
    gap: 15,
    marginBottom: 20,
  },
  countrySelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  countryText: {
    color: "#FFF",
    fontSize: 16,
  },
  zipInput: {
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: "#FFF",
    fontSize: 16,
  },
  cardTypeContainer: {
    flexDirection: "row",
    marginBottom: 25,
    gap: 30,
  },
  radioContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#666",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: {
    borderColor: "#FF8C00",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF8C00",
  },
  radioLabel: {
    fontSize: 16,
    color: "#FFF",
  },
  saveDetailsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 30,
  },
  saveDetailsText: {
    color: "#CCC",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  payButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 18,
    marginHorizontal: 20,
    marginBottom: 30,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#555",
  },
  payButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  modalCloseButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#FF4757",
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  successModalContainer: {
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  successModalContent: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 30,
    alignItems: "center",
  },
  successIconContainer: {
    marginBottom: 25,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 20,
  },
  successButton: {
    backgroundColor: "#FF8C00",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 40,
    minWidth: 100,
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
