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
  Modal,
  Alert,
  ActivityIndicator,
  StatusBar,
  TextInput
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useStripeWrapper } from "../stripWrapper";
import axiosInstance from "../../api/axios";
import { useRouter } from "expo-router";
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

// // Haversine formula to calculate distance between two coordinates
// const calculateDistanceFromCoords = (lat1, lon1, lat2, lon2) => {
//   const R = 6371; // Earth's radius in kilometers
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLon = (lon2 - lon1) * Math.PI / 180;
  
//   const a = 
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * Math.PI / 180) * 
//     Math.cos(lat2 * Math.PI / 180) *
//     Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   const distance = R * c;
  
//   return distance;
// };

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
      return addresses.home.fullAddress;
    }
    if (addresses?.office?.fullAddress) {
      return addresses.office.fullAddress;
    }
    return null;
  }, [addresses]);

  // Dry cleaner's delivery address
  const cleanerAddress = useMemo(() => {
    const cleaner = orderData?.selectedCleaner;
    if (!cleaner?.address) return null;

    const addr = cleaner.address;
    if (typeof addr === "string") return addr;

    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    
    return parts.join(", ") || null;
  }, [orderData?.selectedCleaner]);

  // Stripe hook
  const {
    initializedPaymentSheet,
    openPayment,
    resetPaymentState,
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
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [orderNumber, setOrderNumber] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  // Distance state
  const [deliveryDistance, setDeliveryDistance] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState({
  cardNumber: "",
  expiry: "",
  cvv: "",
});

  useEffect(() => {
    if (!orderNumber) {
      const newOrderNumber = generateFreshOrderNumber();
      const newTrackingId = generateTrackingId();
      setOrderNumber(newOrderNumber);
      setTrackingId(newTrackingId);
    }
  }, [orderNumber]);

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

  // Geocode address using Nominatim (free, no API key required)
  // Improved geocoding function with better error handling and address formatting
const geocodeAddress = async (address) => {
  try {
    // Clean and format the address for better geocoding
    const cleanAddress = address
      .replace(/\s+/g, ' ')  // Remove extra spaces
      .trim();
    
    console.log("🔍 Attempting to geocode:", cleanAddress);
    
    // Use Nominatim with better parameters
    const url = `https://nominatim.openstreetmap.org/search?` + 
      `format=json` +
      `&q=${encodeURIComponent(cleanAddress)}` +
      `&limit=1` +
      `&countrycodes=in` +  // Limit to India for better results
      `&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DryCleanerApp/1.0 (contact@example.com)',
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      console.log("✅ Geocoding successful:", result);
      return result;
    }

    // Try alternative geocoding with just city and state if full address fails
    const fallbackParts = cleanAddress.split(',').slice(-3); // Get last 3 parts (usually city, state, country)
    if (fallbackParts.length > 0) {
      console.log("🔄 Trying fallback geocoding with:", fallbackParts.join(','));
      
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait longer between requests
      
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?` + 
        `format=json` +
        `&q=${encodeURIComponent(fallbackParts.join(',').trim())}` +
        `&limit=1` +
        `&countrycodes=in`;
      
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'DryCleanerApp/1.0 (contact@example.com)',
          'Accept': 'application/json',
        }
      });
      
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData && fallbackData.length > 0) {
        const result = {
          lat: parseFloat(fallbackData[0].lat),
          lng: parseFloat(fallbackData[0].lon)
        };
        console.log("✅ Fallback geocoding successful:", result);
        return result;
      }
    }

    console.warn("⚠️ Geocoding failed: No results found for:", cleanAddress);
    return null;
  } catch (error) {
    console.error("❌ Geocoding error:", error.message);
    return null;
  }
};

// Improved distance calculation with caching
const calculateDistance = useCallback(async (pickupAddr, dropoffAddr) => {
  if (!pickupAddr || !dropoffAddr) {
    console.log("⚠️ Missing addresses");
    setDeliveryDistance(10);
    setDistanceLoading(false);
    return 10;
  }
  
  // Prevent concurrent calls
  if (isCalculating) {
    console.log("⚠️ Distance calculation already in progress");
    return;
  }
  
  console.log("🗺️ Calculating distance via backend...");
  setDistanceLoading(true);
  setIsCalculating(true);
  
  try {
    const response = await axiosInstance.post(
      "/users/calculate-distance",
      {
        pickupAddress: pickupAddr,
        dropoffAddress: dropoffAddr
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    
    if (response.data?.success && response.data?.data?.distance) {
      const distance = parseFloat(response.data.data.distance);
      console.log("✅ Distance from backend:", distance, "km");
      
      setDeliveryDistance(distance);
      return distance;
    }
    
    console.log("⚠️ Using default 10km");
    setDeliveryDistance(10);
    return 10;
  } catch (error) {
    console.error("❌ Distance calculation error:", error.message);
    setDeliveryDistance(10);
    return 10;
  } finally {
    setDistanceLoading(false);
    setIsCalculating(false);
  }
}, []); 

// Remove the duplicate useEffect blocks and replace with this one
useEffect(() => {
  let isSubscribed = true;
  let timeoutId;
  
  const fetchDistance = async () => {
    // Only calculate if we have all required data and haven't calculated yet
    if (
      userAddress && 
      cleanerAddress && 
      globalPricing && 
      deliveryDistance === null && 
      !distanceLoading
    ) {
      console.log("🔄 Starting distance calculation...");
      
      // Debounce to prevent multiple rapid calls
      timeoutId = setTimeout(async () => {
        if (isSubscribed) {
          await calculateDistance(userAddress, cleanerAddress);
        }
      }, 500); // Wait 500ms before making the call
    }
  };

  fetchDistance();
  
  return () => {
    isSubscribed = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}, [userAddress, cleanerAddress, globalPricing]); // Remove calculateDistance, deliveryDistance, and distanceLoading from dependencies

  // Fetch global pricing from backend
  const fetchGlobalPricing = useCallback(async () => {
    const defaultPricing = {
      deliveryChargePerKm: 25,
      serviceCharge: 0.15,
      platformFee: 2,
    };

    setGlobalPricing(defaultPricing);

    if (!authToken) {
      console.log("⚠️ No auth token, using default pricing");
      setLoading(false);
      return;
    }

    try {
      console.log("📡 Fetching global pricing from backend...");
      const response = await axiosInstance.get(
        "/users/admin/get-global-pricing",
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          timeout: 10000,
        }
      );

      if (response.data?.success && response.data?.data) {
        const pricing = {
          deliveryChargePerKm: parseFloat(response.data.data.pricePerKm) || 25,
          serviceCharge: 0.15,
          platformFee: 2,
        };
        console.log("✅ Pricing from backend:", pricing);
        setGlobalPricing(pricing);
      } else {
        console.log("⚠️ Using default pricing");
      }
    } catch (error) {
      console.log("⚠️ Error fetching pricing, using default:", error.message);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  // Fetch pricing on mount
  useEffect(() => {
    fetchGlobalPricing();
  }, [fetchGlobalPricing]);

  // Calculate distance when addresses and pricing are available
  useEffect(() => {
    const fetchDistance = async () => {
      if (userAddress && cleanerAddress && globalPricing && deliveryDistance === null) {
        console.log("🔄 Addresses ready, calculating distance...");
        await calculateDistance(userAddress, cleanerAddress);
      }
    };

    fetchDistance();
  }, [userAddress, cleanerAddress, globalPricing, deliveryDistance, calculateDistance]);

  // Calculate order totals
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

    const serviceFees = subtotal * (globalPricing.serviceCharge || 0.15);
    const distanceToUse = deliveryDistance || 10;
    const deliveryChargePerKm = globalPricing.deliveryChargePerKm || 25;
    const deliveryCharge = deliveryChargePerKm * distanceToUse;
    const platformFee = globalPricing.platformFee || 2;
    const total = subtotal + serviceFees + deliveryCharge + platformFee;

    return {
      subtotal,
      serviceFees,
      deliveryCharge,
      platformFee,
      total,
    };
  }, [orderData?.items, globalPricing, deliveryDistance]);

  const buildISODate = (date, month, time) => {
    try {
      const currentYear = new Date().getFullYear();
      const currentDate = new Date();

      const monthNumber =
        [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December",
        ].indexOf(month) + 1;

      if (monthNumber === 0) {
        throw new Error(`Invalid month: ${month}`);
      }

      const timeMatch = time.match(/(\d+):(\d+)(AM|PM)/i);
      if (!timeMatch) {
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

      const dateNum = parseInt(date, 10);
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

      return scheduledDate.toISOString();
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

    if (!userAddress) {
      Alert.alert(
        "Address Required",
        "Please add a pickup address before proceeding with payment."
      );
      return;
    }

    if (!cleanerAddress) {
      Alert.alert(
        "Error",
        "Cleaner address is not available. Please select a different cleaner."
      );
      return;
    }

    if (distanceLoading) {
      Alert.alert(
        "Please Wait",
        "Calculating delivery distance. Please try again in a moment."
      );
      return;
    }

    const freshOrderNumber = generateFreshOrderNumber();
    const freshTrackingId = generateTrackingId();
    setOrderNumber(freshOrderNumber);
    setTrackingId(freshTrackingId);

    resetPaymentState();
    setPaymentLoading(true);
    setLocalPaymentReady(false);
    paymentReadyRef.current = false;

    await new Promise((resolve) => setTimeout(resolve, 300));

    let createdBookingId = null;

    try {
      let scheduledPickupDateTime;
      let scheduledDeliveryDateTime;

      try {
        if (
          scheduling.scheduledPickupDateTime &&
          scheduling.scheduledDeliveryDateTime
        ) {
          scheduledPickupDateTime = scheduling.scheduledPickupDateTime;
          scheduledDeliveryDateTime = scheduling.scheduledDeliveryDateTime;
        } else {
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
        Alert.alert(
          "Invalid Schedule",
          "There was an error with your pickup/delivery schedule. Please go back and select your times again."
        );
        setPaymentLoading(false);
        return;
      }

      const finalDistance = deliveryDistance || 10;

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
        distance: finalDistance,
        time: 30,
        price: calculations.subtotal,
        deliveryCharge: calculations.deliveryCharge,
        bookingType: "pickup",
        paymentMethod: paymentMethod.toUpperCase(),
        paymentStatus: "pending",
        status: "pending",
      };

      console.log("📦 Creating booking...");
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

      console.log("✅ Booking created:", createdBookingId);

      console.log("💳 Creating payment intent...");
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

      console.log("✅ Payment intent received");

      const initialized = await initializedPaymentSheet(
        paymentIntent,
        ephemeralKey,
        customerId,
        paymentIntentId
      );

      if (!initialized) {
        throw new Error("Failed to initialize payment sheet");
      }

      setLocalPaymentReady(true);
      paymentReadyRef.current = true;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("💳 Opening payment sheet...");
      const paymentResult = await openPayment();

      if (paymentResult === true) {
        console.log("✅ Payment successful!");
        
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
          setShowPaymentModal(false);
          setShowSuccessModal(true);
          resetPaymentState();
        } else {
          throw new Error("Payment confirmation failed");
        }
      } else if (paymentResult === false) {
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
              onPress: () => {
                resetPaymentState();
                Alert.alert(
                  "Booking Cancelled",
                  "Your booking has been cancelled."
                );
                router.back();
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
      setPaymentLoading(false);
      setLocalPaymentReady(false);
      paymentReadyRef.current = false;
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
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              dispatch(removeOrderItem(id));
              Alert.alert(
                "Item Removed",
                `${item?.name || "Item"} has been removed from your order.`
              );
            },
          },
        ]
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
      const item = orderData?.items.find((i) => i._id === selectedItemId);
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

  const incrementQuantity = useCallback(
    (itemId) => {
      const item = orderData?.items.find((i) => i._id === itemId);
      if (!item) return;
      const currentQuantity = parseInt(String(item.quantity || 0), 10);
      dispatch(
        updateItemQuantity({
          itemId,
          quantity: currentQuantity + 1,
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
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () => dispatch(removeOrderItem(itemId)),
            },
          ]
        );
      } else {
        dispatch(
          updateItemQuantity({
            itemId,
            quantity: currentQuantity - 1,
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
    return price * quantity;
  }, []);

  const getStarchLevelText = useCallback((level) => {
    switch (level) {
      case 1: return "None";
      case 2: return "Light";
      case 3: return "Medium";
      case 4: return "Heavy";
      default: return "Medium";
    }
  }, []);

  const RadioButton = ({ selected, onPress, label }) => (
    <TouchableOpacity style={styles.radioContainer} onPress={onPress}>
      <View style={[styles.radioButton, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF8C00" />
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
            {formatAddress(orderData.selectedCleaner.address)}
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
          ) : deliveryDistance ? (
            <Text style={styles.distanceText}>
              📍 Distance: {deliveryDistance.toFixed(2)} km
            </Text>
          ) : (
            <Text style={styles.distanceText}>
              📍 Distance: ~10 km (estimated)
            </Text>
          )}
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
                        style={styles.quantityButton}
                        onPress={() => decrementQuantity(item._id)}
                      >
                        <Text style={styles.quantityButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>
                        {parseInt(String(item.quantity || 0))}
                      </Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => incrementQuantity(item._id)}
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
                        Starch Level: {getStarchLevelText(item.starchLevel || 3)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.checkboxContainer}>
                    {item.options?.zipper !== undefined && (
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          item.options.zipper && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleOption(item._id, "zipper")}
                      >
                        <View style={styles.checkboxInner}>
                          {item.options.zipper && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text style={styles.checkboxText}>Zipper</Text>
                      </TouchableOpacity>
                    )}
                    {item.options?.button !== undefined && (
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          item.options.button && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleOption(item._id, "button")}
                      >
                        <View style={styles.checkboxInner}>
                          {item.options.button && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text style={styles.checkboxText}>Button</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        item.options?.washAndFold && styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, "washAndFold")}
                    >
                      <View style={styles.checkboxInner}>
                        {item.options?.washAndFold && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>Wash & Fold</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteItem(item._id)}
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
    Delivery Charge ({deliveryDistance > 0 ? deliveryDistance.toFixed(2) : '10 (default)'}km @ $
    {globalPricing?.deliveryChargePerKm ?? 25}/km)
    {distanceLoading && " ⏳"}
    {deliveryDistance <= 0 && !distanceLoading && " ⚠️ Using default"}
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
    paddingTop: 0,
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
    marginBottom:40,
    top: 9,
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
