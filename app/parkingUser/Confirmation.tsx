import Contact from "@/components/LiveSessions/Contact";
import LocationCard from "@/components/LiveSessions/LocationCard";
import SessionDetails from "@/components/LiveSessions/SessionDetails";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { images } from "../../assets/images/images";
import { RootState } from "../../components/redux/store";
import {
  calculateDuration,
  getSpacDetailsFromID,
} from "../../utils/slotIdConverter";
import { useStripeWrapper } from "../stripWrapper";
import BookingReceipt from "./BookingReceipt";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"; // Add this import
import * as Location from 'expo-location'; // Add this import

type PaymentMethod = "CASH" | "CARD" | "UPI";

interface CheckOutData {
  bookingId: string;
  garageName: string;
  slot: string;
  bookingPeriod: {
    from: string;
    to: string;
  };
  vehicleNumber?: string;
  pricing: {
    priceRate?: number;
    basePrice: number;
    discount: number;
    couponApplied: boolean;
    couponDetails: null;
    totalAmount: number;
  };
  stripeDetails?: {
    paymentIntent: string | null;
    ephemeralKey?: string;
    customerId: string;
    paymentIntentId: string;
  };
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

  const type = params.type as "G" | "L" | "R" | undefined;
  const endTime = params.endTime as string;
  const selectedSpot = params.selectedSpot as string | undefined;

  const authToken = useSelector((state: RootState) => state.auth.token);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckOutData | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const Stripe = useStripeWrapper();

  const [isPopupVisible, setPopupVisible] = useState(false);
  const [carPlateNumber, setCarPlateNumber] = useState("");
  
  // Changed default to CARD
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  
  const [showCardDetailsModal, setShowCardDetailsModal] = useState(false);
  const [savedCard, setSavedCard] = useState<CardDetails | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");

  const [showReceipt, setShowReceipt] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const hasInitiatedCheckout = useRef(false);
  const isMounted = useRef(true);
  const stripeInitialized = useRef(false);
  const [showStripeSheet, setShowStripeSheet] = useState(false);

  // Add state for map
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [lotLocation, setLotLocation] = useState<LocationCoordinates | null>(null);
  const [mapRegion, setMapRegion] = useState<LocationCoordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(" ").substr(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.substr(0, 2) + "/" + cleaned.substr(2, 2);
    }
    return cleaned;
  };

  // Add function to get user location
  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return null;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    } catch (error) {
      console.error('Error getting user location:', error);
      return null;
    }
  };

  // Add function to initialize map
  const initializeMap = async () => {
    setLocationLoading(true);
    
    try {
      // Get user location
      const userLoc = await getUserLocation();
      if (userLoc) {
        setUserLocation(userLoc);
      }

      // Get lot location from data or lot object
      let lotCoords = null;
      
      if (data?.placeInfo?.location) {
        // If we have location data from checkout response
        const [longitude, latitude] = data.placeInfo.location.coordinates;
        lotCoords = {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
      } else if (lot?.location) {
        // If we have location in the lot object
        const [longitude, latitude] = lot.location.coordinates;
        lotCoords = {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
      } else if (lot?.latitude && lot?.longitude) {
        // If we have lat/lng directly
        lotCoords = {
          latitude: lot.latitude,
          longitude: lot.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
      }

      if (lotCoords) {
        setLotLocation(lotCoords);
        // Set map region to show both user and lot location
        if (userLoc) {
          // Calculate region that includes both points
          const minLat = Math.min(userLoc.latitude, lotCoords.latitude);
          const maxLat = Math.max(userLoc.latitude, lotCoords.latitude);
          const minLng = Math.min(userLoc.longitude, lotCoords.longitude);
          const maxLng = Math.max(userLoc.longitude, lotCoords.longitude);
          
          setMapRegion({
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: (maxLat - minLat) * 1.5,
            longitudeDelta: (maxLng - minLng) * 1.5,
          });
        } else {
          setMapRegion(lotCoords);
        }
      } else if (userLoc) {
        // If no lot location, just show user location
        setMapRegion(userLoc);
      } else {
        // Default to a central location (can be your city's coordinates)
        setMapRegion({
          latitude: 22.5726, // Example: Kolkata coordinates
          longitude: 88.3639,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      // Set default region if there's an error
      setMapRegion({
        latitude: 22.5726,
        longitude: 88.3639,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    } finally {
      setLocationLoading(false);
    }
  };

  const initiateCheckout = useCallback(
    async (plateNumber: string) => {
      if (!lot || !type) {
        Alert.alert("Error", "Invalid parameters");
        return;
      }

      if (hasInitiatedCheckout.current) {
        console.log("Checkout already initiated, skipping...");
        return;
      }

      hasInitiatedCheckout.current = true;
      setLoading(true);
      setError(null);

      try {
        let requestBody: any;
        let endpoint: string;

        const startTime = new Date();
        const endTimeDate = new Date(endTime);

        if (endTimeDate <= startTime) {
          Alert.alert(
            "Invalid Time",
            "End time must be after the current time"
          );
          setLoading(false);
          hasInitiatedCheckout.current = false;
          return;
        }

        console.log("📅 Booking period:", {
          from: startTime.toISOString(),
          to: endTimeDate.toISOString(),
          duration:
            (endTimeDate.getTime() - startTime.getTime()) / (1000 * 60) +
            " minutes",
        });

        if (type === "G") {
          const slotDetails = getSpacDetailsFromID(selectedSpot || "");
          endpoint = "garage";

          requestBody = {
            garageId: lot._id,
            bookedSlot: slotDetails || { zone: "A", slot: 1 },
            bookingPeriod: {
              from: startTime.toISOString(),
              to: endTimeDate.toISOString(),
            },
            vehicleNumber: plateNumber.trim().toUpperCase(),
            paymentMethod: paymentMethod === "CARD" ? "CREDIT" : paymentMethod,
          };
        } else if (type === "L") {
          const slotDetails = getSpacDetailsFromID(selectedSpot || "");
          endpoint = "parkinglot";

          requestBody = {
            lotId: lot._id,
            bookedSlot: slotDetails || { zone: "A", slot: 1 },
            bookingPeriod: {
              from: startTime.toISOString(),
              to: endTimeDate.toISOString(),
            },
            vehicleNumber: plateNumber.trim().toUpperCase(),
            paymentMethod: paymentMethod === "CARD" ? "CREDIT" : paymentMethod,
          };
        } else if (type === "R") {
          endpoint = "residence";

          requestBody = {
            residenceId: lot._id,
            bookingPeriod: {
              from: startTime.toISOString(),
              to: endTimeDate.toISOString(),
            },
            vehicleNumber: plateNumber.trim().toUpperCase(),
            couponCode: "",
          };
        } else {
          throw new Error("Invalid booking type");
        }

        console.log("📤 Checkout Request:", {
          endpoint,
          body: requestBody,
        });

        const response = await axiosInstance.post<CheckoutResponse>(
          `/merchants/${endpoint}/checkout`,
          requestBody,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: authToken,
            },
            withCredentials: true,
          }
        );

        console.log("✅ Checkout Response:", response.data);

        if (response.data.success) {
          setData(response.data.data);
          setVehicleNumber(plateNumber.trim().toUpperCase());
          stripeInitialized.current = false;
          
          // Initialize map after getting data
          initializeMap();
          
          // Auto-open Stripe payment sheet if payment method is CARD
          if (paymentMethod === "CARD" && response.data.data.stripeDetails) {
            console.log("🔄 Auto-initializing Stripe for card payment...");
            await initializeStripePaymentSheet(response.data.data.stripeDetails);
          }
        } else {
          throw new Error(response.data.message || "Checkout failed");
        }
      } catch (err: any) {
        console.error("❌ Checkout Error:", err.response?.data || err.message);
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to retrieve booking details";
        setError(errorMessage);
        Alert.alert("Error", `${errorMessage}. Please try again.`);
        hasInitiatedCheckout.current = false;
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [lot, type, endTime, selectedSpot, authToken, paymentMethod]
  );

  const handleOkPress = () => {
    const plateNumber = carPlateNumber.trim().toUpperCase();
    
    if (plateNumber === "") {
      Alert.alert(
        "Required",
        "Please enter your car plate number to continue."
      );
      return;
    }
    
    // Validate minimum length
    if (plateNumber.length < 5) {
      Alert.alert(
        "Invalid Vehicle Number",
        "Vehicle number must be at least 5 characters long. Example: WB 01 AB 1234"
      );
      return;
    }
    
    setPopupVisible(false);
    initiateCheckout(plateNumber);
  };

  const handleGoHome = () => {
    setPopupVisible(false);
    router.replace("/userHome");
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    const oldMethod = paymentMethod;
    setPaymentMethod(method);
    setShowPaymentMethodSelector(false);
    
    // Re-initiate checkout if payment method changed and we already have data
    if (oldMethod !== method && vehicleNumber) {
      console.log(`🔄 Payment method changed from ${oldMethod} to ${method}, re-initiating checkout`);
      hasInitiatedCheckout.current = false;
      initiateCheckout(vehicleNumber);
    }
  };

  const handleSaveCard = () => {
    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      Alert.alert("Required", "Please fill in all card details");
      return;
    }
    
    const cardData: CardDetails = {
      cardNumber: cardNumber.replace(/\s/g, ""),
      expiryDate,
      cvv,
      cardholderName,
    };
    
    setSavedCard(cardData);
    setShowCardDetailsModal(false);
    
    setCardNumber("");
    setExpiryDate("");
    setCvv("");
    setCardholderName("");
    
    Alert.alert("Success", "Card details saved successfully!");
  };

  useEffect(() => {
    isMounted.current = true;

    if (!authToken) {
      console.log("No auth token, redirecting to login");
      router.replace("/Login");
      return;
    }

    if (!lot || !type) {
      console.log("Missing lot or type, going back");
      router.back();
      return;
    }

    const timer = setTimeout(() => {
      if (isMounted.current && !hasInitiatedCheckout.current) {
        setPopupVisible(true);
      }
    }, 1000);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Initialize map when component mounts (for cases where we might have location data without checkout)
  useEffect(() => {
    if (!loading && lot) {
      initializeMap();
    }
  }, [lot]);

  const initializeStripePaymentSheet = async (stripeDetails: any) => {
    try {
      if (!stripeDetails || !stripeDetails.paymentIntent || !stripeDetails.customerId) {
        console.log("Missing Stripe details for initialization");
        return false;
      }

      if (stripeInitialized.current) {
        console.log("Stripe already initialized, skipping...");
        return true;
      }

      console.log("🔄 INITIALIZING PAYMENT SHEET");
      console.log("🔍 Payment data received:", {
        customerPrefix: stripeDetails.customerId?.substring(0, 10),
        hasCustomer: !!stripeDetails.customerId,
        hasEphemeralKey: !!stripeDetails.ephemeralKey,
        hasPaymentIntent: !!stripeDetails.paymentIntent,
        intentId: stripeDetails.paymentIntentId || "not provided",
        paymentIntentPrefix: stripeDetails.paymentIntent?.substring(0, 10),
      });

      const initSuccess = await Stripe.initializedPaymentSheet(
        stripeDetails.paymentIntent,
        stripeDetails.ephemeralKey || "",
        stripeDetails.customerId,
        stripeDetails.paymentIntentId
      );

      console.log("🔍 initPaymentSheet result:", initSuccess);

      if (initSuccess) {
        stripeInitialized.current = true;
        console.log("✅ Payment sheet initialized successfully");
        return true;
      } else {
        console.log("❌ Payment sheet initialization failed");
        return false;
      }
    } catch (error) {
      console.error("Error initializing Stripe:", error);
      stripeInitialized.current = false;
      return false;
    }
  };

  const handleConfirmBooking = async () => {
    console.log("🚀 Starting booking confirmation...");

    if (!vehicleNumber.trim()) {
      Alert.alert(
        "Required",
        "Please enter your car plate number to continue."
      );
      setPopupVisible(true);
      return;
    }

    if (!data?.bookingId) {
      Alert.alert("Error", "Booking ID not available. Please try again.");
      return;
    }

    if (!type) {
      Alert.alert("Error", "Invalid booking type");
      return;
    }

    if (paymentMethod === "CARD") {
      // For card payments, open Stripe payment sheet
      handleCardPayment();
    } else if (paymentMethod === "CASH") {
      // For cash payments, directly confirm
      handleCashPayment();
    } else if (paymentMethod === "UPI") {
      Alert.alert(
        "UPI Payment",
        "UPI payment is coming soon. Please select another payment method.",
        [{ text: "OK" }]
      );
    }
  };

  const handleCardPayment = async () => {
    console.log("💳 Processing card payment with Stripe");

    if (!data?.stripeDetails?.paymentIntentId) {
      console.error("❌ No paymentIntentId in stripeDetails:", data?.stripeDetails);
      Alert.alert(
        "Payment Error",
        "Payment configuration incomplete. Please try again."
      );
      return;
    }

    setPaymentLoading(true);

    try {
      console.log("🔄 Opening Stripe payment sheet...");
      const paymentResult = await Stripe.openPayment();

      console.log("💳 Payment sheet result:", paymentResult);

      if (paymentResult === true) {
        console.log("✅ Payment successful! Confirming booking...");
        
        const endpoint = type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence";
        const paymentIntentId = data.stripeDetails.paymentIntentId;
        
        console.log("📤 Sending to backend:", {
          endpoint,
          bookingId: data.bookingId,
          paymentIntentId,
          vehicleNumber
        });
        
        try {
          const bookingResponse = await axiosInstance.post(
            `/merchants/${endpoint}/book`,
            {
              bookingId: data.bookingId,
              carLicensePlateImage: vehicleNumber,
              paymentMethod: "CREDIT",
              paymentIntentId: paymentIntentId,
            },
            {
              headers: {
                Authorization: authToken,
                "Content-Type": "application/json",
              },
              timeout: 15000,
            }
          );

          console.log("✅ Booking response:", bookingResponse.data);

          if (bookingResponse.data.success) {
            setCreatedBookingId(data.bookingId);
            setShowReceipt(true);
          } else {
            throw new Error(bookingResponse.data.message || "Booking confirmation failed");
          }
        } catch (bookError: any) {
          console.error("❌ Booking confirmation error:", {
            message: bookError.message,
            response: bookError.response?.data,
            status: bookError.response?.status,
          });
          
          let errorMessage = "Booking confirmation failed.";
          
          if (bookError.response?.data?.message) {
            errorMessage = bookError.response.data.message;
            
            // Handle specific error cases
            if (bookError.response.data.message.includes("PAYMENT_VERIFICATION_FAILED")) {
              errorMessage = "Payment verification failed. The payment may not have been processed correctly. Please check your payment method or try cash payment.";
            }
            
            if (bookError.response.data.message.includes("INVALID_PAYMENT_INTENT")) {
              errorMessage = "Payment session expired. Please restart the payment process.";
            }
          }
          
          Alert.alert("Payment Error", errorMessage, [
            {
              text: "Try Cash Payment",
              onPress: () => handleCashPayment()
            },
            {
              text: "Try Again",
              onPress: () => handleCardPayment()
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]);
        }
      } else {
        console.log("❌ Payment cancelled by user");
        Alert.alert(
          "Payment Cancelled",
          "Payment was not completed. Would you like to try cash payment instead?",
          [
            {
              text: "Pay with Cash",
              onPress: () => handleCashPayment()
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
      }
    } catch (err: any) {
      console.error("❌ Payment error:", err.message || err);
      
      if (!err.message?.toLowerCase().includes("cancel")) {
        Alert.alert(
          "Payment Error",
          err.message || "An error occurred during payment. Please try again."
        );
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCashPayment = async () => {
    console.log("💵 Processing CASH payment");
    
    setPaymentLoading(true);

    try {
      const endpoint = type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence";
      
      const bookingResponse = await axiosInstance.post(
        `/merchants/${endpoint}/book`,
        {
          bookingId: data!.bookingId,
          carLicensePlateImage: vehicleNumber,
          paymentMethod: "CASH",
        },
        {
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      console.log("✅ CASH booking response:", bookingResponse.data);

      if (bookingResponse.data.success) {
        setCreatedBookingId(data!.bookingId);
        setShowReceipt(true);
      } else {
        throw new Error(bookingResponse.data.message || "Booking confirmation failed");
      }
    } catch (err: any) {
      console.error("❌ CASH payment error:", err);
      Alert.alert(
        "Payment Failed",
        err.response?.data?.message || err.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    
    if (createdBookingId && type) {
      router.push({
        pathname: "/parkingUser/LiveSessionScreen",
        params: {
          bookingId: createdBookingId,
          type: type,
          bookingData: JSON.stringify(data)
        }
      });
    } else {
      router.replace("/userHome");
    }
  };

  if (!lot || !type) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid booking details</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={isPopupVisible}
        onRequestClose={() => {}}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Add Car Plate Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., WB 01 AB 1234 (min. 5 characters)"
              placeholderTextColor="#888"
              value={carPlateNumber}
              onChangeText={setCarPlateNumber}
              autoCapitalize="characters"
              onSubmitEditing={handleOkPress}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonOk]}
              onPress={handleOkPress}
              disabled={loading}
            >
              <Text style={styles.textStyle}>
                {loading ? "Processing..." : "OK"}
              </Text>
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

      <Modal
        animationType="slide"
        transparent={true}
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
              {/* Changed order: CARD first */}
              <TouchableOpacity
                style={[
                  styles.paymentMethodItem,
                  paymentMethod === "CARD" && styles.selectedMethod
                ]}
                onPress={() => handleSelectPaymentMethod("CARD")}
              >
                <Text style={styles.methodIcon}>💳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodName}>Credit/Debit Card</Text>
                  {savedCard && paymentMethod === "CARD" && (
                    <Text style={styles.cardInfoSmall}>
                      •••• {savedCard.cardNumber.slice(-4)}
                    </Text>
                  )}
                </View>
                {paymentMethod === "CARD" && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentMethodItem,
                  paymentMethod === "CASH" && styles.selectedMethod
                ]}
                onPress={() => handleSelectPaymentMethod("CASH")}
              >
                <Text style={styles.methodIcon}>💵</Text>
                <Text style={styles.methodName}>Cash Payment</Text>
                {paymentMethod === "CASH" && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentMethodItem,
                  paymentMethod === "UPI" && styles.selectedMethod
                ]}
                onPress={() => handleSelectPaymentMethod("UPI")}
              >
                <Text style={styles.methodIcon}>📱</Text>
                <Text style={styles.methodName}>UPI Payment</Text>
                {paymentMethod === "UPI" && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
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
                <Text style={styles.cardNumberPreview}>
                  {cardNumber || "•••• •••• •••• ••••"}
                </Text>
                <View style={styles.cardBottomRow}>
                  <View>
                    <Text style={styles.cardLabel}>CARDHOLDER NAME</Text>
                    <Text style={styles.cardValue}>
                      {cardholderName || "YOUR NAME"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.cardLabel}>EXPIRES</Text>
                    <Text style={styles.cardValue}>
                      {expiryDate || "MM/YY"}
                    </Text>
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
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
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
                    onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
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

              <View style={styles.securePaymentInfo}>
                <Text style={styles.secureIcon}>🔒</Text>
                <Text style={styles.secureText}>
                  Your payment information is secure and encrypted
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.saveCardButton}
                onPress={handleSaveCard}
              >
                <Text style={styles.saveCardButtonText}>
                  Save Card Details
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {data && (
        <BookingReceipt
          visible={showReceipt}
          onClose={handleReceiptClose}
          bookingData={{
            bookingId: data.bookingId,
            garageName: data.garageName,
            slot: data.slot,
            bookingPeriod: data.bookingPeriod,
            vehicleNumber: vehicleNumber,
            pricing: data.pricing,
            placeInfo: data.placeInfo,
          }}
          type={type}
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finalizing Details...</Text>
        </View>
      ) : (
        <>
          <View style={styles.customHeader}>
            <TouchableOpacity onPress={() => router.back()}>
              <IconButton
                icon="arrow-left"
                size={30}
                iconColor={colors.primary}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking Confirmation</Text>
          </View>

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
                showsUserLocation={true}
                showsMyLocationButton={true}
                zoomEnabled={true}
                scrollEnabled={true}
                rotateEnabled={true}
              >
                {lotLocation && (
                  <Marker
                    coordinate={lotLocation}
                    title={
                      data?.placeInfo.name ||
                      lot?.garageName ||
                      lot?.parkingName ||
                      lot?.residenceName ||
                      "Parking Location"
                    }
                    description={data?.placeInfo.address || lot?.address || ""}
                    pinColor={colors.primary}
                  />
                )}
                {userLocation && (
                  <Marker
                    coordinate={userLocation}
                    title="Your Location"
                    description="You are here"
                    pinColor="#4CAF50"
                  />
                )}
              </MapView>
            ) : (
              <View style={styles.mapErrorContainer}>
                <Text style={styles.mapErrorText}>Unable to load map</Text>
              </View>
            )}
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.bottomSheet}>
              <LocationCard
                name={
                  data?.placeInfo.name ||
                  lot?.garageName ||
                  lot?.parkingName ||
                  lot?.residenceName ||
                  "Loading..."
                }
                address={
                  data?.placeInfo.address || lot?.address || "Loading..."
                }
                price={data?.pricing.priceRate}
              />

              <View style={styles.sectionContainer}>
                <SessionDetails
                  parkingSlotId={data?.slot}
                  startingFrom={
                    data?.bookingPeriod.from
                      ? new Date(data.bookingPeriod.from).toString()
                      : "Loading..."
                  }
                  duration={
                    data?.bookingPeriod
                      ? calculateDuration(
                          data.bookingPeriod.from,
                          data.bookingPeriod.to
                        )
                      : "Loading..."
                  }
                />
              </View>

              <View style={styles.sectionContainer}>
                <Contact
                  phoneNo={lot?.contactNumber || data?.placeInfo.phoneNo}
                  name={data?.placeInfo.owner || "John Doe"}
                />
              </View>

              {vehicleNumber && (
                <View style={styles.vehicleContainer}>
                  <Text style={styles.vehicleLabel}>Vehicle Number:</Text>
                  <Text style={styles.vehicleNumber}>{vehicleNumber}</Text>
                </View>
              )}

              <View style={styles.fareSection}>
                <TouchableOpacity 
                  style={styles.walletButton}
                  onPress={() => setShowPaymentMethodSelector(true)}
                >
                  <Text style={styles.methodIcon}>
                    {paymentMethod === "CASH" ? "💵" : 
                     paymentMethod === "CARD" ? "💳" : "📱"}
                  </Text>
                  <View style={styles.walletContent}>
                    <Text style={styles.walletText}>
                      {paymentMethod === "CASH" ? "Cash Payment" : 
                       paymentMethod === "CARD" ? "Credit/Debit Card" : 
                       "UPI Payment"}
                    </Text>
                    {paymentMethod === "CARD" && (
                      <Text style={styles.cardInfo}>
                        {savedCard ? `•••• ${savedCard.cardNumber.slice(-4)}` : "Enter card details"}
                      </Text>
                    )}
                  </View>
                  <Icon source="chevron-right" size={24} color="#000000" />
                </TouchableOpacity>

                <View style={styles.totalFareContainer}>
                  <View style={styles.fareDetails}>
                    <View>
                      <Text style={styles.totalFareLabel}>
                        Total Fare (*approx)
                      </Text>
                      <Text style={styles.totalFareAmount}>
                        {data
                          ? `₹${data.pricing.totalAmount.toFixed(2)}`
                          : "..."}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        (!data || paymentLoading) && styles.disabledButton,
                      ]}
                      onPress={handleConfirmBooking}
                      disabled={!data || paymentLoading}
                    >
                      {paymentLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={[styles.confirmButtonText, { marginLeft: 8 }]}>
                            Processing...
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.confirmButtonText}>
                          {paymentMethod === "CARD" ? "Pay Now" : "Confirm Booking"}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 60,
    backgroundColor: "transparent",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: "#000000",
  },
  mapContainer: {
    marginTop:50,
    height: 280,
    width: "100%",
    overflow: 'hidden',
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.primary,
  },
  mapErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapErrorText: {
    fontSize: 16,
    color: '#666',
  },
  bottomSheet: {
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    marginTop: -20,
  },
  sectionContainer: {
    marginTop: 16,
  },
  vehicleContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  vehicleLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
  },
  fareSection: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  walletButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  walletContent: {
    flex: 1,
  },
  walletText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  cardInfo: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cardInfoSmall: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  addCardButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  addCardText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  balanceText: {
    flex: 1,
    fontSize: 16,
    color: "#000000",
  },
  balanceAmount: {
    color: colors.primary,
    fontWeight: "500",
  },
  totalFareContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  fareDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  totalFareLabel: {
    fontSize: 14,
    color: "#666666",
  },
  totalFareAmount: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 24,
    minWidth: 150,
    height: 48,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalView: {
    width: "85%",
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    height: 45,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    width: "100%",
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#000",
  },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    elevation: 2,
    width: "100%",
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonOk: {
    backgroundColor: colors.primary,
  },
  buttonGoHome: {
    backgroundColor: "#6c757d",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: "#cccccc",
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    fontSize: 18,
    color: colors.primary,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  paymentMethodModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "50%",
    paddingBottom: 20,
  },
  cardModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    fontSize: 24,
    color: "#999",
    fontWeight: "bold",
  },
  paymentMethodItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  selectedMethod: {
    backgroundColor: "#f0f8ff",
  },
  methodName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  checkMark: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: "bold",
  },
  cardForm: {
    padding: 20,
  },
  cardPreview: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    minHeight: 200,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardChip: {
    width: 50,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 8,
    marginBottom: 20,
  },
  cardNumberPreview: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 2,
    marginBottom: 20,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 4,
    letterSpacing: 1,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  cardInput: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  rowInputs: {
    flexDirection: "row",
  },
  securePaymentInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 24,
  },
  secureIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  secureText: {
    flex: 1,
    fontSize: 12,
    color: "#666",
  },
  saveCardButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveCardButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Confirmation;