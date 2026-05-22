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
  TextInput,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useStripe } from "@stripe/stripe-react-native";
import axiosInstance from "../../api/axios";
import { useRouter } from "expo-router";
import {
  removeOrderItem,
  updateItemOptions,
  updateItemQuantity,
} from "../../components/redux/userSlice";

// ─── Types ────────────────────────────────────────────────────────────────────
type PaymentMethodType = "CARD" | "CASH" | "UPI";

const STARCH_LEVELS: ("low" | "medium" | "high")[] = ["low", "medium", "high"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const getEffectiveItemPrice = (item: any): number => {
  const addOnTotal = (item.additionalservice || [])
    .filter((s: any) =>
      (item.selectedAdditionals || item.options?.selectedAdditionals || []).includes(s.name)
    )
    .reduce((sum: number, s: any) => sum + (s.price || 0), 0);
  if (typeof item.effectivePrice === "number" && item.effectivePrice > 0)
    return item.effectivePrice;
  return parseFloat(String(item.price || 0)) + addOnTotal;
};

// ─── Payment method config ────────────────────────────────────────────────────
const PAYMENT_METHODS: {
  id: PaymentMethodType;
  label: string;
  sublabel: string;
  icon: string;
}[] = [
  {
    id: "CARD",
    label: "Credit / Debit Card",
    sublabel: "Visa, Mastercard, Amex",
    icon: "💳",
  },
  {
    id: "CASH",
    label: "Cash on Pickup",
    sublabel: "Pay when we collect your items",
    icon: "💵",
  },
  {
    id: "UPI",
    label: "Google / Apple Pay",
    sublabel: Platform.OS === "ios" ? "Apple Pay via Stripe" : "Google Pay via Stripe",
    icon: Platform.OS === "ios" ? "🍎" : "📱",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
interface TipSectionProps {
  tipAmount: string;
  onChangeTip: (val: string) => void;
  onClearTip: () => void;
}
const TipSection: React.FC<TipSectionProps> = ({ tipAmount, onChangeTip, onClearTip }) => (
  <View style={styles.tipSection}>
    <Text style={styles.tipSectionTitle}>Add a Tip</Text>
    <Text style={styles.tipSectionSubtitle}>Enter the tip amount you would like to give</Text>
    <View style={styles.customTipContainer}>
      <Text style={styles.customTipLabel}>Tip Amount</Text>
      <View style={styles.customTipInputContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.customTipInput}
          value={tipAmount}
          onChangeText={onChangeTip}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#999"
        />
        {tipAmount ? (
          <TouchableOpacity onPress={onClearTip} style={styles.clearTipButton}>
            <MaterialIcons name="clear" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>
      {tipAmount ? (
        <Text style={styles.tipValue}>
          You're tipping: ${(parseFloat(tipAmount) || 0).toFixed(2)}
        </Text>
      ) : null}
    </View>
  </View>
);

interface RadioButtonProps {
  selected: boolean;
  onPress: () => void;
  label: string;
}
const RadioButton: React.FC<RadioButtonProps> = ({ selected, onPress, label }) => (
  <TouchableOpacity style={styles.radioContainer} onPress={onPress}>
    <View style={[styles.radioButton, selected && styles.radioSelected]}>
      {selected && <View style={styles.radioInner} />}
    </View>
    <Text style={styles.radioLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function OrderSummaryApp() {
  const router = useRouter();
  const dispatch = useDispatch();

  // ── Stripe hook — gives us initPaymentSheet + presentPaymentSheet ──────────
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const authToken = useSelector((state: any) => state.auth?.token);
  const user = useSelector((state: any) => state.auth.user);
  const scheduling = useSelector((state: any) => state.user?.scheduling);
  const addresses = useSelector((state: any) => state.user?.addresses);
  const orderData = useSelector((state: any) => state.user?.order);

  const userAddress = useMemo(() => {
    if (addresses?.home?.fullAddress) return addresses.home.fullAddress;
    if (addresses?.office?.fullAddress) return addresses.office.fullAddress;
    return null;
  }, [addresses]);

  const cleanerAddress = useMemo(() => {
    const cleaner = orderData?.selectedCleaner;
    if (!cleaner?.address) return null;
    const addr = cleaner.address;
    if (typeof addr === "string") return addr;
    const parts: string[] = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    return parts.join(", ") || null;
  }, [orderData?.selectedCleaner]);

  const hasItems = useMemo(
    () => orderData?.items && orderData.items.length > 0,
    [orderData?.items]
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [showWashOnlyModal, setShowWashOnlyModal] = useState(false);
  const [showStarchLevelModal, setShowStarchLevelModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [globalPricing, setGlobalPricing] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ── Payment method state — now typed ──────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CARD");

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [deliveryDistance, setDeliveryDistance] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [cardDetails, setCardDetails] = useState({ cardNumber: "", expiry: "", cvv: "" });

  // ── Ref to hold paymentIntentId across async calls ─────────────────────────
  const paymentIntentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orderNumber) {
      setOrderNumber(generateFreshOrderNumber());
      setTrackingId(generateTrackingId());
    }
  }, [orderNumber]);

  const washOnlyOptions = useMemo(
    () => [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
    []
  );

  const getAllowedStarchOptions = useCallback(
    (item: any): ("low" | "medium" | "high")[] => {
      const merchantCap = item?.merchantStarchLevel || item?.starchLevel || "medium";
      const maxIndex = STARCH_LEVELS.indexOf(merchantCap as "low" | "medium" | "high");
      return STARCH_LEVELS.filter((_, idx) => idx <= maxIndex);
    },
    []
  );

  const selectedItemForStarch = useMemo(
    () => orderData?.items?.find((i: any) => i._id === selectedItemId) || null,
    [orderData?.items, selectedItemId]
  );

  // ── Distance calculation ───────────────────────────────────────────────────
  const calculateDistance = useCallback(
    async (pickupAddr: string, dropoffAddr: string) => {
      if (!pickupAddr || !dropoffAddr) {
        setDeliveryDistance(10);
        setDistanceLoading(false);
        return 10;
      }
      if (isCalculating) return;
      setDistanceLoading(true);
      setIsCalculating(true);
      try {
        const response = await axiosInstance.post(
          "/users/calculate-distance",
          { pickupAddress: pickupAddr, dropoffAddress: dropoffAddr },
          { headers: { "Content-Type": "application/json" }, timeout: 15000 }
        );
        if (response.data?.success && response.data?.data?.distance) {
          const distance = parseFloat(response.data.data.distance);
          setDeliveryDistance(distance);
          return distance;
        }
        setDeliveryDistance(10);
        return 10;
      } catch (error: any) {
        console.error("❌ Distance calculation error:", error.message);
        setDeliveryDistance(10);
        return 10;
      } finally {
        setDistanceLoading(false);
        setIsCalculating(false);
      }
    },
    [isCalculating]
  );

  useEffect(() => {
    let isSubscribed = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const fetchDistance = async () => {
      if (
        userAddress &&
        cleanerAddress &&
        globalPricing &&
        deliveryDistance === null &&
        !distanceLoading
      ) {
        timeoutId = setTimeout(async () => {
          if (isSubscribed) await calculateDistance(userAddress, cleanerAddress);
        }, 500);
      }
    };
    fetchDistance();
    return () => {
      isSubscribed = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    userAddress,
    cleanerAddress,
    globalPricing,
    deliveryDistance,
    distanceLoading,
    calculateDistance,
  ]);

  // ── Global pricing ─────────────────────────────────────────────────────────
  const fetchGlobalPricing = useCallback(async () => {
    const defaultPricing = { deliveryChargePerKm: 25, serviceCharge: 0.15, platformFee: 2 };
    setGlobalPricing(defaultPricing);
    if (!authToken) {
      setLoading(false);
      return;
    }
    try {
      const response = await axiosInstance.get("/users/admin/get-global-pricing", {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 10000,
      });
      if (response.data?.success && response.data?.data) {
        setGlobalPricing({
          deliveryChargePerKm: parseFloat(response.data.data.pricePerKm) || 25,
          serviceCharge: 0.15,
          platformFee: 2,
        });
      }
    } catch (error: any) {
      console.log("⚠️ Error fetching pricing, using default:", error.message);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchGlobalPricing();
  }, [fetchGlobalPricing]);

  // ── Calculations ───────────────────────────────────────────────────────────
  const calculations = useMemo(() => {
    if (!orderData?.items || !globalPricing) {
      return { subtotal: 0, serviceFees: 0, deliveryCharge: 0, platformFee: 0, tip: 0, total: 0 };
    }
    const subtotal = orderData.items.reduce((sum: number, item: any) => {
      return sum + getEffectiveItemPrice(item) * parseInt(String(item.quantity || 0), 10);
    }, 0);
    const serviceFees = subtotal * (globalPricing.serviceCharge || 0.15);
    const distanceToUse = deliveryDistance || 10;
    const deliveryCharge = (globalPricing.deliveryChargePerKm || 25) * distanceToUse;
    const platformFee = globalPricing.platformFee || 2;
    const tip = isNaN(parseFloat(tipAmount)) ? 0 : parseFloat(tipAmount);
    const total = subtotal + serviceFees + deliveryCharge + platformFee + tip;
    return { subtotal, serviceFees, deliveryCharge, platformFee, tip, total };
  }, [orderData?.items, globalPricing, deliveryDistance, tipAmount]);

  // ── Date builder ───────────────────────────────────────────────────────────
  const buildISODate = (date: string, month: string, time: string) => {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    const monthNumber =
      [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
      ].indexOf(month) + 1;
    if (monthNumber === 0) throw new Error(`Invalid month: ${month}`);
    const timeMatch = time.match(/(\d+):(\d+)(AM|PM)/i);
    if (!timeMatch) throw new Error(`Invalid time format: ${time}`);
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    else if (period === "AM" && hours === 12) hours = 0;
    let scheduledDate = new Date(
      currentYear,
      monthNumber - 1,
      parseInt(date, 10),
      hours,
      minutes,
      0,
      0
    );
    if (scheduledDate <= currentDate) {
      scheduledDate = new Date(
        currentYear + 1,
        monthNumber - 1,
        parseInt(date, 10),
        hours,
        minutes,
        0,
        0
      );
    }
    return scheduledDate.toISOString();
  };

  const formatAddress = (address: any) => {
    if (!address) return "Not specified";
    if (typeof address === "string") return address.trim() || "Not specified";
    if (typeof address === "object" && address !== null) {
      if (address.fullAddress) return address.fullAddress.trim() || "Not specified";
      const parts: string[] = [];
      if (address.street) parts.push(address.street);
      if (address.city) parts.push(address.city);
      if (address.state) parts.push(address.state);
      if (address.country) parts.push(address.country);
      return parts.join(", ") || "Not specified";
    }
    return "Not specified";
  };

  // ── NEW: initialize Stripe payment sheet (used for CARD and UPI) ───────────
  const initializeStripeSheet = async (
    bookingId: string,
    freshOrderNumber: string,
    mode: "CARD" | "UPI"
  ): Promise<string | null> => {
    const response = await axiosInstance.post(
      "/users/payment-intent",
      {
        bookingId,
        orderNumber: freshOrderNumber,
        amount: Math.round(calculations.total * 100),
        
        currency: "usd",
        // Tell backend which mode so it can tag metadata
        walletMode: mode === "UPI",
        
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (!response.data.success) throw new Error("Failed to create payment intent");

    const { paymentIntent, ephemeralKey, customerId, paymentIntentId } =
      response.data.data;

    paymentIntentIdRef.current = paymentIntentId;

    const { error } = await initPaymentSheet({
      merchantDisplayName:        "Your App Name",   // ← replace with your app name
      customerId,
      customerEphemeralKeySecret:  ephemeralKey,
      paymentIntentClientSecret:   paymentIntent,
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: { address: { country: "US" } },
      // ── Wallet config: enable Apple Pay on iOS, Google Pay on Android ──────
      ...(mode === "UPI" && {
        applePay: {
          merchantCountryCode: "US",
        },
        googlePay: {
          merchantCountryCode: "US",
          testEnv: __DEV__,          // set to false in production
        },
      }),
    });

    if (error) throw new Error(error.message);
    return paymentIntentId;
  };

  // ── NEW: present sheet and confirm with backend ────────────────────────────
  const presentAndConfirmSheet = async (
    bookingId: string,
    freshOrderNumber: string
  ): Promise<boolean> => {
    const { error } = await presentPaymentSheet();

    if (error) {
      if (error.code === "Canceled") return false;
      throw new Error(error.message);
    }

    // Confirm with backend
    const confirmResponse = await axiosInstance.post(
      "/users/confirm-payment",
      {
        bookingId,
        orderNumber: freshOrderNumber,
        paymentIntentId: paymentIntentIdRef.current,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (!confirmResponse.data.success) throw new Error("Payment confirmation failed");
    return true;
  };

  // ── Main payment handler ───────────────────────────────────────────────────
const handlePayment = async () => {
  if (!orderData?.selectedCleaner) {
    Alert.alert("Error", "Please select a dry cleaner and add items to your order");
    return;
  }
  if (!scheduling) {
    Alert.alert("Error", "Please schedule your pickup and delivery times");
    return;
  }
  if (!userAddress) {
    Alert.alert("Address Required", "Please add a pickup address before proceeding.");
    return;
  }
  if (!cleanerAddress) {
    Alert.alert("Error", "Cleaner address is not available.");
    return;
  }
  if (distanceLoading) {
    Alert.alert("Please Wait", "Calculating delivery distance. Please try again.");
    return;
  }

  const freshOrderNumber = generateFreshOrderNumber();
  const freshTrackingId = generateTrackingId();
  setOrderNumber(freshOrderNumber);
  setTrackingId(freshTrackingId);
  setPaymentLoading(true);

  try {
    // ── FIX: Payment Method Mapping ─────────────────────────────
    const paymentMethodMap = {
      CARD: "CREDIT",
      CASH: "CASH",
      UPI: "UPI",
    };

    const finalPaymentMethod = paymentMethodMap[paymentMethod];

    console.log("🔥 FINAL PAYMENT METHOD:", finalPaymentMethod);

    // ── Build schedule dates ───────────────────────────────────
    let scheduledPickupDateTime: string;
    let scheduledDeliveryDateTime: string;

    try {
      if (scheduling.scheduledPickupDateTime && scheduling.scheduledDeliveryDateTime) {
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
    } catch {
      Alert.alert(
        "Invalid Schedule",
        "There was an error with your schedule. Please go back and select your times again."
      );
      setPaymentLoading(false);
      return;
    }

    // ── Create booking ─────────────────────────────────────────
    const bookingData = {
      userId: user?._id,
      dryCleaner: orderData.selectedCleaner._id,
      orderItems: orderData.items.map((item: any) => ({
        itemId: item._id,
        name: item.name,
        category: item.category || "Clothes",
        quantity: item.quantity,
        price: item.price,
        effectivePrice: getEffectiveItemPrice(item),
        starchLevel: item.starchLevel || "low",
        merchantStarchLevel:
          item.merchantStarchLevel || item.starchLevel || "medium",
        washOnly: item.washOnly || false,
        additionalservice: item.additionalservice || [],
        selectedAdditionals:
          item.selectedAdditionals ||
          item.options?.selectedAdditionals ||
          [],
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
        tip: calculations.tip,
        totalAmount: calculations.total,
      },
      distance: deliveryDistance || 10,
      time: 30,
      price: calculations.subtotal,
      deliveryCharge: calculations.deliveryCharge,
      bookingType: "pickup",

      // ✅ FIXED HERE
      paymentMethod: finalPaymentMethod,

      paymentStatus: paymentMethod === "CASH" ? "pending" : "initiated",
      status: "pending",
    };

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
      throw new Error(bookingResponse.data.message || "Failed to create booking");
    }

    const createdBooking = bookingResponse.data.data;
    setCompletedBookingId(createdBooking._id);
    setShowPaymentModal(false);

    // ── CASH flow ──────────────────────────────────────────────
    if (paymentMethod === "CASH") {
      setShowSuccessModal(true);
      return;
    }

    // ── CARD / UPI → Stripe ───────────────────────────────────
    const mode = paymentMethod === "UPI" ? "UPI" : "CARD";

    await initializeStripeSheet(createdBooking._id, freshOrderNumber, mode);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const success = await presentAndConfirmSheet(
      createdBooking._id,
      freshOrderNumber
    );

    if (success) {
      setShowSuccessModal(true);
    } else {
      Alert.alert(
        "Payment Incomplete",
        "The payment was not completed. What would you like to do?",
        [
          {
            text: "Try Again",
            onPress: async () => {
              try {
                await initializeStripeSheet(
                  createdBooking._id,
                  freshOrderNumber,
                  mode
                );
                const retrySuccess = await presentAndConfirmSheet(
                  createdBooking._id,
                  freshOrderNumber
                );
                if (retrySuccess) setShowSuccessModal(true);
              } catch (retryErr: any) {
                Alert.alert("Retry Failed", retryErr.message);
              }
            },
          },
          {
            text: "Cancel Booking",
            style: "destructive",
            onPress: () => {
              Alert.alert("Booking Cancelled");
              router.back();
            },
          },
          {
            text: "Keep Pending",
            style: "cancel",
            onPress: () => {
              Alert.alert("Booking Pending");
              router.back();
            },
          },
        ]
      );
    }
  } catch (err: any) {
    console.error("❌ Payment error:", err.message);
    Alert.alert("Payment Failed", err.message);
  } finally {
    setPaymentLoading(false);
  }
};

  const handleCustomTip = (value: string) => {
    if (value === "") {
      setTipAmount("");
      return;
    }
    const sanitized = value.replace(/[^0-9.]/g, "");
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setTipAmount(sanitized);
  };

  const clearTip = () => setTipAmount("");

  const toggleOption = useCallback(
    (itemId: string, optionName: string) => {
      const item = orderData?.items.find((i: any) => i._id === itemId);
      if (item) {
        dispatch(
          updateItemOptions({
            itemId,
            options: { ...item.options, [optionName]: !item.options[optionName] },
            itemName: item.name,
          })
        );
      }
    },
    [orderData?.items, dispatch]
  );

  const deleteItem = useCallback(
    (id: string) => {
      const item = orderData?.items.find((i: any) => i._id === id);
      Alert.alert(
        "Remove Item",
        `Are you sure you want to remove "${item?.name || "this item"}" from your order?`,
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
    (value: boolean) => {
      if (selectedItemId) {
        const item = orderData?.items.find((i: any) => i._id === selectedItemId);
        dispatch(
          updateItemOptions({ itemId: selectedItemId, washOnly: value, itemName: item?.name })
        );
        setShowWashOnlyModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId, dispatch, orderData?.items]
  );

  const updateStarchLevel = useCallback(
    (value: "low" | "medium" | "high") => {
      if (!selectedItemId) return;
      const item = orderData?.items.find((i: any) => i._id === selectedItemId);
      if (item) {
        const merchantCap = item.merchantStarchLevel || item.starchLevel || "medium";
        const merchantMaxIndex = STARCH_LEVELS.indexOf(merchantCap as "low" | "medium" | "high");
        const selectedIndex = STARCH_LEVELS.indexOf(value);
        const capped = STARCH_LEVELS[Math.min(selectedIndex, merchantMaxIndex)];
        dispatch(
          updateItemOptions({ itemId: selectedItemId, starchLevel: capped, itemName: item.name })
        );
      }
      setShowStarchLevelModal(false);
      setSelectedItemId(null);
    },
    [selectedItemId, dispatch, orderData?.items]
  );

  const incrementQuantity = useCallback(
    (itemId: string) => {
      const item = orderData?.items.find((i: any) => i._id === itemId);
      if (!item) return;
      dispatch(
        updateItemQuantity({
          itemId,
          quantity: parseInt(String(item.quantity || 0), 10) + 1,
          itemName: item.name,
        })
      );
    },
    [orderData?.items, dispatch]
  );

  const decrementQuantity = useCallback(
    (itemId: string) => {
      const item = orderData?.items.find((i: any) => i._id === itemId);
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

  const getItemTotal = useCallback(
    (item: any) => getEffectiveItemPrice(item) * parseInt(String(item.quantity || 0), 10),
    []
  );

  const getStarchLevelText = useCallback((level: string | number): string => {
    if (typeof level === "string")
      return level.charAt(0).toUpperCase() + level.slice(1);
    const map: { [key: number]: string } = {
      1: "Low",
      2: "Low",
      3: "Medium",
      4: "High",
      5: "High",
    };
    return map[level as number] || "Medium";
  }, []);

  const selectedMethodConfig = PAYMENT_METHODS.find((m) => m.id === paymentMethod)!;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={styles.loadingText}>Loading order summary...</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <Text style={styles.distanceText}>📍 Distance: ~10 km (estimated)</Text>
          )}
        </View>
      ) : null}

      {!hasItems ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items in your order</Text>
          <TouchableOpacity style={styles.addItemsButton} onPress={() => router.back()}>
            <Text style={styles.addItemsButtonText}>Add Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
            {orderData?.items?.map((item: any) => {
              const effectivePrice = getEffectiveItemPrice(item);
              const addOnTotal = effectivePrice - parseFloat(String(item.price || 0));
              return (
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
                        ${effectivePrice.toFixed(2)} each
                        {addOnTotal > 0 ? ` (+$${addOnTotal.toFixed(2)} add-ons)` : ""}
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

                  {(item.selectedAdditionals || item.options?.selectedAdditionals || [])
                    .length > 0 && (
                    <View style={styles.addOnRow}>
                      <Text style={styles.addOnLabel}>Add-ons: </Text>
                      <Text style={styles.addOnValues}>
                        {(
                          item.selectedAdditionals ||
                          item.options?.selectedAdditionals ||
                          []
                        ).join(", ")}
                      </Text>
                    </View>
                  )}

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
                        <Text style={styles.dropdownSubText}>Tap to change</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.dropdown, styles.starchDropdown]}
                        onPress={() => {
                          setSelectedItemId(item._id);
                          setShowStarchLevelModal(true);
                        }}
                      >
                        <Text style={styles.dropdownText}>
                          Starch: {getStarchLevelText(item.starchLevel || "low")}
                        </Text>
                        <Text style={styles.starchCapLabel}>
                          Max:{" "}
                          {getStarchLevelText(
                            item.merchantStarchLevel || item.starchLevel || "medium"
                          )}{" "}
                          ▼
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
              );
            })}

            <TipSection
              tipAmount={tipAmount}
              onChangeTip={handleCustomTip}
              onClearTip={clearTip}
            />
          </ScrollView>

          {/* ── Summary + Place Order ──────────────────────────────────────── */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sub Total</Text>
              <Text style={styles.summaryValue}>
                ${calculations?.subtotal?.toFixed(2) ?? "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Estimated taxes (
                {((globalPricing?.serviceCharge ?? 0.15) * 100).toFixed(0)}%)
              </Text>
              <Text style={styles.summaryValue}>
                ${calculations?.serviceFees?.toFixed(2) ?? "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery Charge (
                {deliveryDistance && deliveryDistance > 0
                  ? deliveryDistance.toFixed(2)
                  : "10 (default)"}
                km @ ${globalPricing?.deliveryChargePerKm ?? 25}/km)
                {distanceLoading && " ⏳"}
              </Text>
              <Text style={styles.summaryValue}>
                ${calculations?.deliveryCharge?.toFixed(2) ?? "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tip</Text>
              <Text style={styles.summaryValue}>
                ${Number(calculations?.tip || 0).toFixed(2)}
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
                ${Number(calculations?.total || 0).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.continueButton,
                (distanceLoading || deliveryDistance === null) && styles.disabledButton,
              ]}
              onPress={() => setShowPaymentModal(true)}
              disabled={distanceLoading || deliveryDistance === null}
            >
              <Text style={styles.continueButtonText}>
                {distanceLoading ? "Calculating Distance..." : "Place Your Order"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Payment Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.paymentModalContainer}>
          <View style={styles.paymentModalContent}>
            {/* Header */}
            <View style={styles.paymentModalHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FF8C00" />
              </TouchableOpacity>
              <Text style={styles.paymentModalTitle}>Choose Payment</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.paymentScrollView}
            >
              {/* ── Order total recap ──────────────────────────────────────── */}
              <View style={styles.totalRecapCard}>
                <Text style={styles.totalRecapLabel}>Order Total</Text>
                <Text style={styles.totalRecapAmount}>
                  ${calculations?.total?.toFixed(2) ?? "0.00"}
                </Text>
              </View>

              {/* ── Payment method selector ────────────────────────────────── */}
              <Text style={styles.sectionLabel}>Select Payment Method</Text>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === method.id && styles.paymentMethodOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod(method.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentMethodIcon}>{method.icon}</Text>
                  <View style={styles.paymentMethodTextContainer}>
                    <Text
                      style={[
                        styles.paymentMethodLabel,
                        paymentMethod === method.id && styles.paymentMethodLabelSelected,
                      ]}
                    >
                      {method.label}
                    </Text>
                    <Text style={styles.paymentMethodSubLabel}>{method.sublabel}</Text>
                  </View>
                  <View
                    style={[
                      styles.paymentMethodRadio,
                      paymentMethod === method.id && styles.paymentMethodRadioSelected,
                    ]}
                  >
                    {paymentMethod === method.id && (
                      <View style={styles.paymentMethodRadioInner} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              {/* ── Contextual hint per method ─────────────────────────────── */}
              {paymentMethod === "CARD" && (
                <View style={styles.methodHintBox}>
                  <MaterialIcons name="info-outline" size={16} color="#FF8C00" />
                  <Text style={styles.methodHintText}>
                    Stripe's secure sheet will open. Enter your card details there.
                  </Text>
                </View>
              )}
              {paymentMethod === "CASH" && (
                <View style={styles.methodHintBox}>
                  <MaterialIcons name="info-outline" size={16} color="#FF8C00" />
                  <Text style={styles.methodHintText}>
                    Pay cash when our driver arrives for pickup. No online payment needed.
                  </Text>
                </View>
              )}
              {paymentMethod === "UPI" && (
                <View style={styles.methodHintBox}>
                  <MaterialIcons name="info-outline" size={16} color="#FF8C00" />
                  <Text style={styles.methodHintText}>
                    {Platform.OS === "ios"
                      ? "Apple Pay will appear in the Stripe payment sheet."
                      : "Google Pay will appear in the Stripe payment sheet."}
                    {" "}CashApp Pay and saved cards are also available.
                  </Text>
                </View>
              )}

              {/* ── Card preview (cosmetic only for CARD mode) ─────────────── */}
              {paymentMethod === "CARD" && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                    Card information
                  </Text>
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
                  <Text style={styles.cardCosmticNote}>
                    * Card details are entered securely in Stripe's payment sheet
                  </Text>
                </>
              )}

              <View style={styles.saveDetailsContainer}>
                <Text style={styles.saveDetailsText}>
                  Your payment is secured by Stripe. We never store your card details.
                </Text>
              </View>
            </ScrollView>

            {/* ── Pay / Confirm button ───────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.payButton, paymentLoading && styles.disabledButton]}
              activeOpacity={0.8}
              onPress={handlePayment}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.loadingText}>Processing...</Text>
                </View>
              ) : (
                <View style={styles.payButtonContent}>
                  <Text style={styles.payButtonText}>
                    {paymentMethod === "CASH"
                      ? `Confirm Order · $${calculations?.total?.toFixed(2) ?? "0.00"}`
                      : `Pay $${calculations?.total?.toFixed(2) ?? "0.00"}`}
                  </Text>
                  <MaterialIcons
                    name={paymentMethod === "CASH" ? "check-circle" : "lock"}
                    size={18}
                    color="#ffffff"
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal ──────────────────────────────────────────────────── */}
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
              {paymentMethod === "CASH" && (
                <Text style={styles.successCashNote}>
                  Please have cash ready when our driver arrives.
                </Text>
              )}
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push({
                    pathname: "/dryCleanerUser/orderReceiptPage",
                    params: {
                      orderId:     completedBookingId,
                      orderNumber,
                      trackingId,
                      totalAmount: calculations.total,
                      orderData:   JSON.stringify({
                        items:     orderData?.items,
                        cleaner:   orderData?.selectedCleaner,
                        addresses,
                        scheduling,
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

      {/* ── Wash Only Modal ────────────────────────────────────────────────── */}
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

      {/* ── Starch Level Modal ─────────────────────────────────────────────── */}
      <Modal visible={showStarchLevelModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starch Level</Text>
            {selectedItemForStarch && (
              <Text style={styles.modalSubtitle}>
                Merchant allows up to:{" "}
                <Text style={styles.modalSubtitleBold}>
                  {getStarchLevelText(
                    selectedItemForStarch.merchantStarchLevel ||
                      selectedItemForStarch.starchLevel ||
                      "medium"
                  )}
                </Text>
              </Text>
            )}
            {selectedItemForStarch &&
              getAllowedStarchOptions(selectedItemForStarch).map((level) => {
                const currentLevel = selectedItemForStarch.starchLevel || "low";
                const isSelected = currentLevel === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => updateStarchLevel(level)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {getStarchLevelText(level)}
                    </Text>
                    {isSelected && (
                      <Text style={styles.modalOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: "#F7F7FA", paddingTop: 0 },
  loadingContainer:  { justifyContent: "center", alignItems: "center" },
  loadingText:       { fontSize: 16, color: "#666", marginLeft: 8 },
  loadingRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  headerContainer:   { paddingHorizontal: 20, marginBottom: 40, top: 9, flexDirection: "row", alignItems: "center" },
  distanceContainer: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  distanceText:      { fontSize: 14, color: "#666", marginLeft: 8 },
  disabledButton:    { backgroundColor: "#CCC", opacity: 0.6 },
  title:             { fontSize: 18, fontWeight: "400", color: "#000000", marginLeft: 15 },
  subtitleContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: -20, marginBottom: 20 },
  subtitle:          { fontSize: 20, fontWeight: "300", color: "#707070" },
  subtitle2:         { fontSize: 14, fontWeight: "600", color: "#FF8C00" },
  orderNumberCard: {
    backgroundColor: "#FFFFFF", marginHorizontal: 20, marginBottom: 15, padding: 20,
    borderRadius: 12, borderWidth: 1, borderColor: "#FFE4B5",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  orderNumberLabel:  { fontSize: 16, fontWeight: "400", color: "#666" },
  orderNumberValue:  { fontSize: 18, fontWeight: "700", color: "#FF8C00", letterSpacing: 1 },
  cleanerInfoCard: {
    backgroundColor: "#FFFFFF", marginHorizontal: 20, marginBottom: 15, padding: 15,
    borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cleanerName:       { fontSize: 16, fontWeight: "600", color: "#000", marginBottom: 4 },
  cleanerAddress:    { fontSize: 14, color: "#666", marginBottom: 4 },
  cleanerRating:     { fontSize: 14, color: "#F99026", fontWeight: "500" },
  emptyContainer:    { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  emptyText:         { fontSize: 18, color: "#666", marginBottom: 10, textAlign: "center" },
  addItemsButton:    { backgroundColor: "#F99026", paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 },
  addItemsButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  itemsContainer:    { flex: 1, paddingHorizontal: 20, marginTop: -10 },
  itemCard: {
    backgroundColor: "#FFFFFF", borderRadius: 15, padding: 15, marginBottom: 15,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3,
  },
  itemHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 },
  itemNameContainer:  { flex: 1, marginRight: 10 },
  itemName:           { fontSize: 18, fontWeight: "600", color: "#000000", marginBottom: 5 },
  itemSubtotal:       { fontSize: 14, fontWeight: "500", color: "#F99026" },
  priceQuantityContainer: { alignItems: "flex-end", minWidth: 120 },
  itemPrice:          { fontSize: 13, fontWeight: "600", color: "#F99026", marginBottom: 8 },
  addOnRow:           { flexDirection: "row", alignItems: "center", marginBottom: 8, flexWrap: "wrap" },
  addOnLabel:         { fontSize: 12, color: "#FF8C00", fontWeight: "600" },
  addOnValues:        { fontSize: 12, color: "#666", flex: 1 },
  quantityControls:   { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 20, paddingHorizontal: 4 },
  quantityButton: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1,
    shadowRadius: 2, elevation: 2, marginHorizontal: 2,
  },
  quantityButtonText: { fontSize: 18, fontWeight: "600", color: "#333" },
  quantityText:       { fontSize: 16, color: "#333", marginHorizontal: 15, minWidth: 20, textAlign: "center", fontWeight: "600" },
  optionsContainer:   { gap: 15, position: "relative" },
  dropdownContainer:  { flexDirection: "row", gap: 10 },
  dropdown: {
    flex: 1, padding: 12, backgroundColor: "#F8F8F8", borderRadius: 8,
    borderWidth: 1, borderColor: "#E0E0E0", minHeight: 54, justifyContent: "center",
  },
  starchDropdown:    { backgroundColor: "#FFF8F0", borderColor: "#FFD699" },
  dropdownText:      { color: "#333", fontSize: 14, fontWeight: "500" },
  dropdownSubText:   { fontSize: 11, color: "#999", marginTop: 2 },
  starchCapLabel:    { fontSize: 11, color: "#FF8C00", marginTop: 2, fontWeight: "500" },
  checkboxContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  checkbox:          { flexDirection: "row", alignItems: "center", padding: 8, minHeight: 40 },
  checkboxInner: {
    width: 20, height: 20, borderWidth: 1, borderColor: "#666", borderRadius: 4,
    marginRight: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF",
  },
  checkboxChecked:   { backgroundColor: "#F5F5F5", borderRadius: 6 },
  checkmark:         { color: "#FF8C00", fontSize: 14, fontWeight: "bold" },
  checkboxText:      { color: "#666", fontSize: 14 },
  deleteButton: {
    position: "absolute", right: 20, top: 55, width: 40, height: 40,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1,
    shadowRadius: 2, elevation: 2,
  },
  summary: {
    backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 5,
  },
  summaryRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  summaryLabel: { fontSize: 14, color: "#666", flex: 1, marginRight: 10 },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#333", textAlign: "right" },
  totalRow:     { borderBottomWidth: 0, paddingVertical: 12, marginTop: 8, borderTopWidth: 2, borderTopColor: "#F99026" },
  totalLabel:   { fontSize: 18, fontWeight: "700", color: "#000", flex: 1, marginRight: 10 },
  totalValue:   { fontSize: 20, fontWeight: "700", color: "#F99026", textAlign: "right" },
  continueButton: {
    backgroundColor: "#F99026", paddingVertical: 16, paddingHorizontal: 24,
    borderRadius: 25, marginTop: 20, alignItems: "center",
    shadowColor: "#F99026", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 4,
  },
  continueButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },

  // ── Payment modal ──────────────────────────────────────────────────────────
  paymentModalContainer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  paymentModalContent:   { backgroundColor: "#000", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", paddingTop: 20 },
  paymentModalHeader:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  backButton:            { marginRight: 15 },
  paymentModalTitle:     { fontSize: 20, fontWeight: "600", color: "#FFF" },
  paymentScrollView:     { paddingHorizontal: 20, flex: 1 },

  // Total recap card
  totalRecapCard: {
    backgroundColor: "#1A1A1A", borderRadius: 12, padding: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20, borderWidth: 1, borderColor: "#FF8C0033",
  },
  totalRecapLabel:  { fontSize: 14, color: "#999" },
  totalRecapAmount: { fontSize: 22, fontWeight: "700", color: "#FF8C00" },

  sectionLabel: { fontSize: 15, color: "#CCC", marginBottom: 12, fontWeight: "500" },

  // Payment method options
  paymentMethodOption: {
    flexDirection: "row", alignItems: "center", padding: 14,
    backgroundColor: "#1A1A1A", borderRadius: 12, borderWidth: 1,
    borderColor: "#333", marginBottom: 10, gap: 12,
  },
  paymentMethodOptionSelected: { borderColor: "#FF8C00", backgroundColor: "#1A1A1A" },
  paymentMethodIcon:            { fontSize: 22, width: 32, textAlign: "center" },
  paymentMethodTextContainer:   { flex: 1 },
  paymentMethodLabel:           { fontSize: 15, fontWeight: "500", color: "#CCC" },
  paymentMethodLabelSelected:   { color: "#FF8C00" },
  paymentMethodSubLabel:        { fontSize: 12, color: "#666", marginTop: 2 },
  paymentMethodRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: "#555", justifyContent: "center", alignItems: "center",
  },
  paymentMethodRadioSelected:  { borderColor: "#FF8C00" },
  paymentMethodRadioInner:     { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF8C00" },

  // Method hint
  methodHintBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FF8C0015", borderRadius: 8, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: "#FF8C0030",
  },
  methodHintText: { fontSize: 13, color: "#FF8C00", flex: 1, lineHeight: 18 },

  // Card inputs (cosmetic)
  cardInputContainer:  { flexDirection: "row", alignItems: "center", backgroundColor: "#333", borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15 },
  cardNumberInput:     { flex: 1, color: "#FFF", fontSize: 16, paddingVertical: 8 },
  cardLogos:           { flexDirection: "row", gap: 8 },
  cardLogo:            { color: "#CCC", fontSize: 12, fontWeight: "600", backgroundColor: "#444", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  expiryAndCvcRow:     { flexDirection: "row", gap: 15, marginBottom: 8 },
  cardInput:           { backgroundColor: "#333", borderRadius: 8, paddingHorizontal: 15, paddingVertical: 15, color: "#FFF", fontSize: 16 },
  expiryInput:         { flex: 1 },
  cvcContainer:        { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#333", borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12 },
  cvcInput:            { flex: 1, color: "#FFF", fontSize: 16, paddingVertical: 3 },
  cardCosmticNote:     { fontSize: 11, color: "#666", marginBottom: 16, fontStyle: "italic" },

  saveDetailsContainer: { marginBottom: 30, marginTop: 8 },
  saveDetailsText:      { color: "#555", fontSize: 13, lineHeight: 18, textAlign: "center" },

  radioContainer:  { flexDirection: "row", alignItems: "center" },
  radioButton:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#666", marginRight: 8, justifyContent: "center", alignItems: "center" },
  radioSelected:   { borderColor: "#FF8C00" },
  radioInner:      { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF8C00" },
  radioLabel:      { fontSize: 16, color: "#FFF" },

  // Pay button
  payButton:        { backgroundColor: "#FF8C00", borderRadius: 14, paddingVertical: 18, marginHorizontal: 20, marginBottom: 30, alignItems: "center" },
  payButtonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  payButtonText:    { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },

  // Misc modals
  modalContainer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  modalContent:   { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", maxWidth: 300, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  modalTitle:     { fontSize: 18, fontWeight: "600", color: "#333", textAlign: "center", marginBottom: 6 },
  modalSubtitle:  { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 15 },
  modalSubtitleBold:          { color: "#FF8C00", fontWeight: "600" },
  modalOption:                { paddingVertical: 16, paddingHorizontal: 20, backgroundColor: "#F8F8F8", borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E0E0E0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalOptionSelected:        { backgroundColor: "#FFF3E0", borderColor: "#FF8C00" },
  modalOptionText:            { fontSize: 16, color: "#333", fontWeight: "500" },
  modalOptionTextSelected:    { color: "#FF8C00", fontWeight: "700" },
  modalOptionCheck:           { color: "#FF8C00", fontSize: 16, fontWeight: "bold" },
  modalCloseButton:           { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "#FF4757", borderRadius: 12, marginTop: 10, alignItems: "center" },
  modalCloseButtonText:       { fontSize: 16, color: "#FFFFFF", fontWeight: "600" },

  // Success modal
  successModalOverlay:   { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
  successModalContainer: { width: 300, backgroundColor: "#FFFFFF", borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  successModalContent:   { paddingTop: 40, paddingBottom: 30, paddingHorizontal: 30, alignItems: "center" },
  successIconContainer:  { marginBottom: 25 },
  successIcon:           { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FF8C00", justifyContent: "center", alignItems: "center", shadowColor: "#FF8C00", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  successTitle:          { fontSize: 18, fontWeight: "600", color: "#333333", textAlign: "center", marginBottom: 8 },
  successSubtitle:       { fontSize: 14, color: "#666666", textAlign: "center", marginBottom: 12, lineHeight: 20 },
  successCashNote:       { fontSize: 13, color: "#FF8C00", textAlign: "center", marginBottom: 16, fontWeight: "500" },
  successButton:         { backgroundColor: "#FF8C00", borderRadius: 25, paddingVertical: 12, paddingHorizontal: 40, minWidth: 100, shadowColor: "#FF8C00", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  successButtonText:     { color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center" },

  // Tip section
  tipSection:                { backgroundColor: "#FFFFFF", marginHorizontal: 0, marginBottom: 15, marginTop: 0, padding: 20, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  tipSectionTitle:           { fontSize: 18, fontWeight: "600", color: "#000", marginBottom: 4 },
  tipSectionSubtitle:        { fontSize: 14, color: "#666", marginBottom: 16 },
  customTipContainer:        { marginTop: 8 },
  customTipLabel:            { fontSize: 14, color: "#666", marginBottom: 8, fontWeight: "500" },
  customTipInputContainer:   { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 10, borderWidth: 2, borderColor: "#E0E0E0", paddingHorizontal: 15, paddingVertical: 12 },
  currencySymbol:            { fontSize: 18, fontWeight: "600", color: "#333", marginRight: 8 },
  customTipInput:            { flex: 1, fontSize: 18, fontWeight: "600", color: "#333", padding: 0 },
  clearTipButton:            { padding: 4, marginLeft: 8 },
  tipValue:                  { fontSize: 14, color: "#4CAF50", fontWeight: "600", marginTop: 8 },
});