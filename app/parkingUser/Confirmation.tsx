import Contact from "@/components/LiveSessions/Contact";
import LocationCard from "@/components/LiveSessions/LocationCard";
import SessionDetails from "@/components/LiveSessions/SessionDetails";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

type PaymentMethod = "CASH" | "CREDIT" | "DEBIT" | "UPI" | "PAYPAL";

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
  };
}

interface CheckoutResponse {
  statusCode: number;
  data: CheckOutData;
  message: string;
  success: boolean;
}

const Confirmation = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse the lot parameter from JSON string
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const Stripe = useStripeWrapper();

  const [isPopupVisible, setPopupVisible] = useState(false);
  const [carPlateNumber, setCarPlateNumber] = useState("");

  // Receipt modal state
  const [showReceipt, setShowReceipt] = useState(false);

  const hasInitiatedCheckout = useRef(false);
  const isMounted = useRef(true);

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
            paymentMethod: paymentMethod,
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
            paymentMethod: paymentMethod,
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
    const plateNumber = carPlateNumber.trim();
    if (plateNumber !== "") {
      setPopupVisible(false);
      initiateCheckout(plateNumber);
    } else {
      Alert.alert(
        "Required",
        "Please enter your car plate number to continue."
      );
    }
  };

  const handleGoHome = () => {
    setPopupVisible(false);
    router.replace("/userHome");
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

  useEffect(() => {
    if (data?.stripeDetails && Stripe.initializedPaymentSheet) {
      console.log("🔄 Initializing Stripe payment sheet with:", {
        hasPaymentIntent: !!data.stripeDetails.paymentIntent,
        hasEphemeralKey: !!data.stripeDetails.ephemeralKey,
        hasCustomerId: !!data.stripeDetails.customerId,
      });

      const initSuccess = Stripe.initializedPaymentSheet(
        data.stripeDetails.paymentIntent || "",
        data.stripeDetails.ephemeralKey || "",
        data.stripeDetails.customerId || ""
      );

      console.log("Stripe initialization result:", initSuccess);
    }
  }, [data?.stripeDetails]);

  // ============================================================================
  // PAYMENT HANDLER - TOGGLE BETWEEN PRODUCTION AND TESTING MODE
  // ============================================================================
  // Instructions:
  // - For TESTING: Uncomment the TESTING version below
  // - For PRODUCTION: Uncomment the PRODUCTION version below
  // - Keep only ONE version uncommented at a time
  // ============================================================================

  // ============================================================================
  // 🧪 TESTING VERSION - SKIP PAYMENT & BACKEND CALL
  // ============================================================================
  // Uncomment this section for testing (currently active)

  const handlePayment = async () => {
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

    setPaymentLoading(true);

    try {
      console.log("🧪 TESTING MODE: Skipping payment and booking API call...");

      // Simulate a delay to mimic API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("✅ Simulated successful booking");

      // Directly show the receipt without calling the booking API
      setShowReceipt(true);
    } catch (err: any) {
      console.error("❌ Error:", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // ============================================================================
  // 🚀 PRODUCTION VERSION - FULL PAYMENT FLOW
  // ============================================================================
  // Uncomment this section for production deployment

  /*
const handlePayment = async () => {
  if (!vehicleNumber.trim()) {
    Alert.alert(
      "Required",
      "Please enter your car plate number to continue."
    );
    setPopupVisible(true);
    return;
  }

  if (!Stripe.isReadyForPayment || !data?.bookingId) {
    console.log("⚠️ Payment not ready:", {
      isReady: Stripe.isReadyForPayment,
      hasBookingId: !!data?.bookingId,
    });
    Alert.alert("Error", "Payment system not ready. Please try again.");
    return;
  }

  setPaymentLoading(true);

  try {
    console.log("🔄 Initiating payment...");

    const paymentResult = await Stripe.openPayment();
    console.log("Payment result:", paymentResult);

    if (paymentResult) {
      if (!type) {
        Alert.alert("Error", "Invalid booking type");
        return;
      }

      console.log(
        `📋 Processing booking for type ${type} with bookingId ${data?.bookingId}`
      );

      const endpoint =
        type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence";

      const bookingResponse = await axiosInstance.post(
        `/merchants/${endpoint}/book`,
        {
          bookingId: data?.bookingId,
          carLicensePlateImage: vehicleNumber,
        },
        {
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Booking response:", bookingResponse.data);

      if (bookingResponse.data.success) {
        // Show receipt instead of navigating immediately
        setShowReceipt(true);
      } else {
        throw new Error(
          bookingResponse.data.message || "Booking confirmation failed"
        );
      }
    } else {
      console.log("ℹ️ Payment was cancelled or failed");
      Alert.alert("Payment Cancelled", "Payment was not completed.");
    }
  } catch (err: any) {
    console.error("❌ Payment/Booking error:", err, err.response?.data);
    const errorMessage =
      err.response?.data?.message || err.message || "Payment failed";
    Alert.alert("Booking Failed", errorMessage);
  } finally {
    setPaymentLoading(false);
  }
};
*/

  // ============================================================================
  // RECEIPT CLOSE HANDLER - TOGGLE BETWEEN PRODUCTION AND TESTING MODE
  // ============================================================================

  // ============================================================================
  // 🧪 TESTING VERSION - GO TO HOME
  // ============================================================================
  // Uncomment this section for testing (currently active)

  const handleReceiptClose = () => {
    setShowReceipt(false);

    console.log(
      "🧪 TESTING MODE: Returning to home (booking not created on backend)"
    );
    router.replace("/userHome");
  };

  // ============================================================================
  // 🚀 PRODUCTION VERSION - GO TO LIVE SESSION
  // ============================================================================
  // Uncomment this section for production deployment

  /*
const handleReceiptClose = () => {
  setShowReceipt(false);
  
  // Navigate to live session after closing receipt
  router.push({
    pathname: "/LiveSession",
    params: {
      bookingId: data?.bookingId,
      type: type,
    },
  });
};
*/
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
      {/* Car Plate Number Input Modal */}
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
              placeholder="e.g., WB 01 AB 1234"
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

      {/* Booking Receipt Modal */}
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
            <Image
              source={images.BookingConfirmationMap}
              style={styles.mapImage}
              resizeMode="cover"
            />
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
                <TouchableOpacity style={styles.walletButton}>
                  <Image
                    source={images.wallet}
                    style={{ width: 24, height: 24 }}
                  />
                  <Text style={styles.walletText}>{paymentMethod}</Text>
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
                          ? `$${data.pricing.totalAmount.toFixed(2)}`
                          : "..."}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        (!data || paymentLoading) && styles.disabledButton,
                      ]}
                      onPress={handlePayment}
                      disabled={!data || paymentLoading}
                    >
                      <Text style={styles.confirmButtonText}>
                        {paymentLoading ? "Processing..." : "Confirm Booking"}
                      </Text>
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
    top: 90,
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
    height: 280,
    width: "100%",
  },
  mapImage: {
    width: "100%",
    height: "100%",
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
    gap: 12,
  },
  walletText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#000000",
    marginLeft: 8,
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
});

export default Confirmation;
