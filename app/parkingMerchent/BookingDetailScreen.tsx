// parkingMerchent/BookingDetailScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../assets/color";
import axiosInstance from "../../api/axios";

type BookingType = "parking" | "garage" | "residence";
type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "active"
  | "SUCCESS"
  | "FAILED";

interface EarlyCheckOut {
  markedAt: string;
  originalTo: string;
}

interface BookingDetail {
  _id: string;
  bookingId: string;
  orderNumber: string;
  status: BookingStatus;
  createdAt: string;
  vehicleNumber: string;
  totalAmount: number;
  bookingPeriod?: { from: string; to: string };
  placeInfo?: { name: string; address: string; phoneNo: string };
  slot?: string;
  type: BookingType;
  paymentMethod?: string;
  paymentStatus?: string;
  earlyCheckOut?: EarlyCheckOut | null;
  user?: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
}

const BookingDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useSelector((state: any) => state.auth);

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [markingVacant, setMarkingVacant] = useState(false);
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  useEffect(() => {
    try {
      if (params.bookingData) {
        setBooking(JSON.parse(params.bookingData as string));
      }
    } catch {
      Alert.alert("Error", "Failed to load booking details");
    }
  }, []);

  // --- Helpers ---------------------------------------------------------------

  const getEndpoint = (type: BookingType) => {
    switch (type) {
      case "parking":   return "parkinglot";
      case "garage":    return "garage";
      case "residence": return "residence";
    }
  };

  const isCurrentlyActive = (): boolean => {
    if (!booking) return false;
    const isSuccess =
      booking.status?.toUpperCase() === "SUCCESS" ||
      booking.paymentStatus?.toUpperCase() === "SUCCESS";
    if (!isSuccess) return false;
    if (booking.earlyCheckOut) return false;
    if (!booking.bookingPeriod?.to) return false;
    return new Date(booking.bookingPeriod.to) > new Date();
  };

  /**
   * True when paymentMethod=CASH and status is still PENDING.
   * The backend now keeps cash bookings PENDING until the merchant
   * explicitly calls /confirm-cash. This button only shows in that window.
   */
  const isCashPaymentPending = (): boolean => {
    if (!booking) return false;
    const method = booking.paymentMethod?.toUpperCase();
    if (method !== "CASH") return false;
    const status = (booking.paymentStatus ?? booking.status)?.toUpperCase();
    return status === "PENDING";
  };

  const getVacantButtonLabel = (): string => {
    if (!booking) return "Mark Vacant";
    switch (booking.type) {
      case "parking":   return "Mark Slot Vacant";
      case "garage":    return "Mark Garage Slot Vacant";
      case "residence": return "Mark Residence Vacant";
    }
  };

  const getVacantHint = (): string => {
    if (!booking) return "";
    switch (booking.type) {
      case "parking":
        return "Use this if the vehicle has left before the scheduled checkout time.";
      case "garage":
        return "Use this if the vehicle has left the garage before the scheduled checkout time.";
      case "residence":
        return "Use this if the resident has vacated before the scheduled checkout time.";
    }
  };

  // --- Confirm Cash Payment --------------------------------------------------

  /**
   * Merchant taps this after physically collecting cash.
   * PATCH /merchants/{parkinglot|garage|residence}/booking/:id/confirm-cash
   * Backend verifies ownership, checks no slot conflict, then sets status=SUCCESS.
   */
  const handleConfirmCashPayment = () => {
    if (!booking) return;
    Alert.alert(
      "Confirm Cash Payment",
      `Confirm that you have collected $${booking.totalAmount?.toFixed(2)} in cash?\n\nThis will activate the booking immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Confirm Payment", onPress: confirmCashPayment },
      ]
    );
  };

  const confirmCashPayment = async () => {
    if (!booking) return;
    setConfirmingCash(true);
    try {
      const endpoint = getEndpoint(booking.type);
      const response = await axiosInstance.patch(
        `/merchants/${endpoint}/booking/${booking.bookingId}/confirm-cash`,
        {},
        { headers: { Authorization: token } }
      );

      if (response.data.success) {
        // Flip local state:
        //   isCashPaymentPending() -> false (button disappears)
        //   isCurrentlyActive()   -> true  (mark vacant button appears)
        setBooking((prev) =>
          prev
            ? { ...prev, status: "SUCCESS" as BookingStatus, paymentStatus: "SUCCESS" }
            : prev
        );
        Alert.alert("Payment Confirmed ✓", "Cash payment confirmed. Booking is now active.");
      } else {
        throw new Error(response.data.message || "Failed to confirm payment");
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || error?.message || "Failed to confirm cash payment"
      );
    } finally {
      setConfirmingCash(false);
    }
  };

  // --- Mark Vacant -----------------------------------------------------------

  const handleMarkVacant = () => {
    if (!booking) return;
    const slotLabel =
      booking.type === "residence" ? "This residence" : `Slot ${booking.slot || "—"}`;
    Alert.alert(
      "Mark Vacant",
      `Are you sure the ${booking.type === "residence" ? "resident has vacated" : "vehicle has left"}?\n\n${slotLabel} will be marked available immediately for new bookings.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Mark Vacant", style: "destructive", onPress: confirmMarkVacant },
      ]
    );
  };

  const confirmMarkVacant = async () => {
    if (!booking) return;
    setMarkingVacant(true);
    try {
      const endpoint = getEndpoint(booking.type);
      const response = await axiosInstance.patch(
        `/merchants/${endpoint}/booking/${booking.bookingId}/mark-vacant`,
        {},
        { headers: { Authorization: token } }
      );
      if (response.data.success) {
        const { markedVacantAt, originalCheckOut } = response.data.data;
        setBooking((prev) =>
          prev
            ? {
                ...prev,
                earlyCheckOut: { markedAt: markedVacantAt, originalTo: originalCheckOut },
                bookingPeriod: prev.bookingPeriod
                  ? { ...prev.bookingPeriod, to: markedVacantAt }
                  : prev.bookingPeriod,
              }
            : prev
        );
        Alert.alert(
          "Marked Vacant ✓",
          booking.type === "residence"
            ? "Residence is now available for new bookings."
            : `Slot ${booking.slot || ""} is now available for new bookings.`
        );
      } else {
        throw new Error(response.data.message || "Failed to mark vacant");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || error?.message || "Failed to mark vacant");
    } finally {
      setMarkingVacant(false);
    }
  };

  // --- Generic status update -------------------------------------------------

  const updateBookingStatus = async (newStatus: string) => {
    if (!booking) return;
    setUpdating(true);
    try {
      const endpoint = getEndpoint(booking.type);
      const response = await axiosInstance.patch(
        `/merchants/${endpoint}/booking/${booking.bookingId}/status`,
        { status: newStatus },
        { headers: { Authorization: token } }
      );
      if (response.data.success) {
        setBooking((prev) => prev ? { ...prev, status: newStatus as BookingStatus } : prev);
        Alert.alert("Success", `Booking status updated to ${getStatusText(newStatus as BookingStatus)}`);
      } else {
        throw new Error(response.data.message || "Update failed");
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setBooking((prev) => prev ? { ...prev, status: newStatus as BookingStatus } : prev);
        Alert.alert("Updated Locally", `Status changed to ${getStatusText(newStatus as BookingStatus)}. Note: Backend endpoint not yet available.`);
      } else {
        Alert.alert("Error", `Failed to update status: ${error?.response?.data?.message || error?.message || ""}`);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStatus = () => {
    if (!booking) return;
    const options: { text: string; onPress?: () => void; style?: "cancel" | "destructive" | "default" }[] = [];
    if (booking.status !== "confirmed" && booking.status !== "SUCCESS")
      options.push({ text: "Confirm", onPress: () => updateBookingStatus("confirmed") });
    if (booking.status !== "in_progress")
      options.push({ text: "Mark In Progress", onPress: () => updateBookingStatus("in_progress") });
    if (booking.status !== "completed" && booking.status !== "SUCCESS")
      options.push({ text: "Mark Completed", onPress: () => updateBookingStatus("completed") });
    if (booking.status !== "cancelled" && booking.status !== "FAILED") {
      options.push({
        text: "Cancel Booking", style: "destructive",
        onPress: () => {
          Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
            { text: "No", style: "cancel" },
            { text: "Yes, Cancel", style: "destructive", onPress: () => updateBookingStatus("cancelled") },
          ]);
        },
      });
    }
    options.push({ text: "Close", style: "cancel" });
    Alert.alert("Update Booking Status", "Choose new status:", options);
  };

  // --- Display helpers -------------------------------------------------------

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SUCCESS": case "CONFIRMED": case "ACTIVE": return "#4CAF50";
      case "PENDING":     return "#FFA500";
      case "IN_PROGRESS": return "#2196F3";
      case "COMPLETED":   return "#666666";
      case "FAILED": case "CANCELLED": return "#FF0000";
      default: return colors.gray;
    }
  };

  const getStatusText = (status: BookingStatus) => {
    const map: Record<string, string> = {
      SUCCESS: "Success", PENDING: "Pending", CONFIRMED: "Confirmed",
      ACTIVE: "Active", IN_PROGRESS: "In Progress", COMPLETED: "Completed",
      FAILED: "Failed", CANCELLED: "Cancelled",
    };
    return map[status?.toUpperCase()] || status;
  };

  const getTypeIcon = (type: BookingType): any =>
    ({ parking: "car-sport", garage: "construct", residence: "home" }[type] || "car");

  const getTypeColor = (type: BookingType) =>
    ({ parking: "#FF8C00", garage: "#FF9800", residence: "#4CAF50" }[type] || colors.gray);

  const getTypeText = (type: BookingType) =>
    ({ parking: "Parking Booking", garage: "Garage Booking", residence: "Residence Booking" }[type] || "Booking");

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return "N/A"; }
  };

  const formatDateTime = (d: string) => {
    try {
      return new Date(d).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return "N/A"; }
  };

  const calculateDuration = (from: string, to: string) => {
    try {
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      if (h > 0) return `${h} hour${h > 1 ? "s" : ""} ${m} min`;
      return `${m} minute${m > 1 ? "s" : ""}`;
    } catch { return "N/A"; }
  };

  const handleCall = (phone: string) => {
    if (phone && phone !== "N/A") Linking.openURL(`tel:${phone}`);
    else Alert.alert("Error", "Phone number not available");
  };

  const handleEmail = (email: string) => {
    if (email) Linking.openURL(`mailto:${email}`);
    else Alert.alert("Error", "Email not available");
  };

  // --- Render guards ---------------------------------------------------------

  if (loading || !booking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(booking.status);
  const isTerminal =
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status?.toUpperCase() === "FAILED";

  // --- Render ----------------------------------------------------------------

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Type Badge */}
        <View style={styles.section}>
          <View style={[styles.typeBadgeLarge, { backgroundColor: `${getTypeColor(booking.type)}18` }]}>
            <Ionicons name={getTypeIcon(booking.type)} size={24} color={getTypeColor(booking.type)} />
            <Text style={[styles.typeBadgeText, { color: getTypeColor(booking.type) }]}>
              {getTypeText(booking.type)}
            </Text>
          </View>
        </View>

        {/* Status row */}
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}18`, borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {getStatusText(booking.status)}
              </Text>
            </View>
            {booking.earlyCheckOut && (
              <View style={styles.vacatedBadge}>
                <Ionicons name="exit-outline" size={13} color="#FF8C00" />
                <Text style={styles.vacatedBadgeText}>Vacated Early</Text>
              </View>
            )}
            {isCashPaymentPending() && (
              <View style={styles.cashPendingBadge}>
                <Ionicons name="cash-outline" size={13} color="#795548" />
                <Text style={styles.cashPendingBadgeText}>Awaiting Cash</Text>
              </View>
            )}
          </View>
        </View>

        {/* Early checkout card */}
        {booking.earlyCheckOut && (
          <View style={styles.section}>
            <View style={styles.earlyCheckoutCard}>
              <Ionicons name="information-circle" size={20} color="#FF8C00" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.earlyCheckoutTitle}>Early Departure Recorded</Text>
                <Text style={styles.earlyCheckoutText}>Vacated at {formatDateTime(booking.earlyCheckOut.markedAt)}</Text>
                <Text style={styles.earlyCheckoutText}>Original checkout: {formatDateTime(booking.earlyCheckOut.originalTo)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Cash pending info card — explains what merchant needs to do */}
        {isCashPaymentPending() && (
          <View style={styles.section}>
            <View style={styles.cashPendingCard}>
              <Ionicons name="cash" size={20} color="#5D4037" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.cashPendingCardTitle}>Cash Payment Pending Your Confirmation</Text>
                <Text style={styles.cashPendingCardText}>
                  The customer chose cash payment. Once you collect{" "}
                  <Text style={{ fontWeight: "700" }}>${booking.totalAmount?.toFixed(2)}</Text>
                  {" "}in cash, tap "Confirm Cash Received" below to activate this booking.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Booking Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          <View style={styles.card}>
            <InfoRow label="Order Number" value={booking.orderNumber} />
            <InfoRow label="Booking Date" value={formatDate(booking.createdAt)} />
            {booking.vehicleNumber && booking.vehicleNumber !== "N/A" && (
              <InfoRow label="Vehicle Number" value={booking.vehicleNumber} valueStyle={styles.vehicleNumber} />
            )}
            {booking.slot && <InfoRow label="Slot" value={booking.slot} />}
          </View>
        </View>

        {/* Booking Period */}
        {booking.bookingPeriod && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Period</Text>
            <View style={styles.card}>
              <View style={styles.periodItem}>
                <Ionicons name="log-in-outline" size={22} color={colors.primary} />
                <View style={styles.periodDetails}>
                  <Text style={styles.periodLabel}>Check-in</Text>
                  <Text style={styles.periodValue}>{formatDateTime(booking.bookingPeriod.from)}</Text>
                </View>
              </View>
              <View style={styles.durationRow}>
                <Text style={styles.durationText}>
                  ⏱ {calculateDuration(booking.bookingPeriod.from, booking.bookingPeriod.to)}
                </Text>
              </View>
              <View style={styles.periodItem}>
                <Ionicons name="log-out-outline" size={22} color="#FF8C00" />
                <View style={styles.periodDetails}>
                  <Text style={styles.periodLabel}>{booking.earlyCheckOut ? "Actual Check-out" : "Check-out"}</Text>
                  <Text style={styles.periodValue}>{formatDateTime(booking.bookingPeriod.to)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Location */}
        {booking.placeInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location Details</Text>
            <View style={styles.card}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={22} color={colors.primary} />
                <Text style={styles.locationName}>{booking.placeInfo.name}</Text>
              </View>
              <Text style={styles.locationAddress}>{booking.placeInfo.address}</Text>
              {booking.placeInfo.phoneNo && booking.placeInfo.phoneNo !== "N/A" && (
                <TouchableOpacity style={styles.contactButton} onPress={() => handleCall(booking.placeInfo!.phoneNo)}>
                  <Ionicons name="call" size={16} color={colors.primary} />
                  <Text style={styles.contactButtonText}>{booking.placeInfo.phoneNo}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Customer */}
        {booking.user && (booking.user.firstName || booking.user.phone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.card}>
              <View style={styles.customerHeader}>
                <View style={styles.customerAvatar}>
                  <Ionicons name="person" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{booking.user.firstName} {booking.user.lastName}</Text>
                  {!!booking.user.phone && <Text style={styles.customerContact}>{booking.user.phone}</Text>}
                  {!!booking.user.email && <Text style={styles.customerContact}>{booking.user.email}</Text>}
                </View>
              </View>
              <View style={styles.customerActions}>
                {!!booking.user.phone && (
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleCall(booking.user!.phone)}>
                    <Ionicons name="call" size={18} color="#FFF" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
                {!!booking.user.email && (
                  <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={() => handleEmail(booking.user!.email!)}>
                    <Ionicons name="mail" size={18} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Email</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.card}>
            <InfoRow label="Total Amount" value={`$${booking.totalAmount.toFixed(2)}`} valueStyle={styles.amountValue} />
            {!!booking.paymentMethod && booking.paymentMethod !== "N/A" && (
              <InfoRow label="Payment Method" value={booking.paymentMethod.toUpperCase()} />
            )}
            {!!booking.paymentStatus && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Status</Text>
                <View style={[styles.paymentBadge, { backgroundColor: `${getStatusColor(booking.paymentStatus)}18` }]}>
                  <Text style={[styles.paymentBadgeText, { color: getStatusColor(booking.paymentStatus) }]}>
                    {booking.paymentStatus.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ================================================================
            CONFIRM CASH RECEIVED  —  merchant-only action
            Shows when: paymentMethod=CASH AND status=PENDING
            Calls: PATCH /merchants/{type}/booking/:id/confirm-cash
            Result: status flips to SUCCESS on server + locally
        ================================================================= */}
        {isCashPaymentPending() && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.cashConfirmButton, confirmingCash && styles.disabledButton]}
              onPress={handleConfirmCashPayment}
              disabled={confirmingCash}
              activeOpacity={0.8}
            >
              {confirmingCash ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
              )}
              <Text style={styles.cashConfirmButtonText}>
                {confirmingCash ? "Confirming..." : "Confirm Cash Received"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>
              Tap after collecting cash from the customer to activate this booking.
            </Text>
          </View>
        )}

        {/* Mark Vacant — only after booking is active (SUCCESS) */}
        {isCurrentlyActive() && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.vacantButton,
                booking.type === "residence" && styles.vacantButtonResidence,
                markingVacant && styles.disabledButton,
              ]}
              onPress={handleMarkVacant}
              disabled={markingVacant}
            >
              {markingVacant ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="exit-outline" size={20} color="#FFF" />
              )}
              <Text style={styles.vacantButtonText}>
                {markingVacant ? "Marking Vacant..." : getVacantButtonLabel()}
              </Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>{getVacantHint()}</Text>
          </View>
        )}

        {/* Update Status */}
        {!isTerminal && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.updateButton, updating && styles.disabledButton]}
              onPress={handleUpdateStatus}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="refresh" size={20} color="#FFF" />
              )}
              <Text style={styles.updateButtonText}>
                {updating ? "Updating..." : "Update Status"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
};

// ── Small reusable components ──────────────────────────────────────────────────

const InfoRow = ({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) => (
  <>
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
    <View style={styles.divider} />
  </>
);

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 15, color: "#666" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#FF8C00",
  },
  backButton: {
    width: 38, height: 38, borderRadius: 19, justifyContent: "center",
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 10 },
  card: {
    backgroundColor: "#FFF", borderRadius: 12, padding: 16, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3,
  },
  typeBadgeLarge: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 12 },
  typeBadgeText: { fontSize: 17, fontWeight: "bold", marginLeft: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  statusPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusPillText: { fontSize: 14, fontWeight: "600" },
  vacatedBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0",
    borderWidth: 1, borderColor: "#FF8C00", paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20, gap: 4,
  },
  vacatedBadgeText: { fontSize: 12, fontWeight: "600", color: "#FF8C00" },
  cashPendingBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#EFEBE9",
    borderWidth: 1, borderColor: "#A1887F", paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20, gap: 4,
  },
  cashPendingBadgeText: { fontSize: 12, fontWeight: "600", color: "#5D4037" },
  earlyCheckoutCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFF8F0",
    borderWidth: 1, borderColor: "#FFD699", borderRadius: 10, padding: 12,
  },
  earlyCheckoutTitle: { fontSize: 13, fontWeight: "700", color: "#CC6600", marginBottom: 3 },
  earlyCheckoutText: { fontSize: 12, color: "#995200", marginTop: 1 },
  cashPendingCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFF8F5",
    borderWidth: 1, borderColor: "#BCAAA4", borderRadius: 10, padding: 12,
  },
  cashPendingCardTitle: { fontSize: 13, fontWeight: "700", color: "#4E342E", marginBottom: 4 },
  cashPendingCardText: { fontSize: 12, color: "#6D4C41", lineHeight: 18 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11 },
  infoLabel: { fontSize: 14, color: "#666", flex: 1 },
  infoValue: { fontSize: 14, color: "#000", fontWeight: "500", flex: 1, textAlign: "right" },
  vehicleNumber: { fontWeight: "bold", fontSize: 15, color: "#FF8C00" },
  amountValue: { fontSize: 18, fontWeight: "bold", color: "#4CAF50", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#F0F0F0" },
  periodItem: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  periodDetails: { marginLeft: 12, flex: 1 },
  periodLabel: { fontSize: 12, color: "#666", marginBottom: 2 },
  periodValue: { fontSize: 14, color: "#000", fontWeight: "500" },
  durationRow: { alignItems: "center", marginVertical: 6 },
  durationText: {
    fontSize: 13, color: "#FF8C00", fontWeight: "600",
    backgroundColor: "#FFF3E0", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  locationHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  locationName: { fontSize: 15, fontWeight: "bold", color: "#000", marginLeft: 10, flex: 1 },
  locationAddress: { fontSize: 13, color: "#666", lineHeight: 20, marginBottom: 10 },
  contactButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#E3F2FD", padding: 10, borderRadius: 8 },
  contactButtonText: { fontSize: 14, color: colors.primary, fontWeight: "500", marginLeft: 8 },
  customerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  customerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FF8C00", justifyContent: "center", alignItems: "center" },
  customerName: { fontSize: 15, fontWeight: "bold", color: "#000", marginLeft: 12, marginBottom: 2 },
  customerContact: { fontSize: 13, color: "#666", marginLeft: 12, marginTop: 2 },
  customerActions: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FF8C00", padding: 11, borderRadius: 8 },
  actionButtonSecondary: { backgroundColor: "#E3F2FD" },
  actionButtonText: { fontSize: 14, color: "#FFF", fontWeight: "600", marginLeft: 6 },
  paymentBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  paymentBadgeText: { fontSize: 12, fontWeight: "600" },
  cashConfirmButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2E7D32", padding: 16, borderRadius: 12, elevation: 3, gap: 10,
  },
  cashConfirmButtonText: { fontSize: 16, color: "#FFF", fontWeight: "bold" },
  vacantButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#E65100", padding: 15, borderRadius: 12, elevation: 2, gap: 8,
  },
  vacantButtonResidence: { backgroundColor: "#2E7D32" },
  vacantButtonText: { fontSize: 16, color: "#FFF", fontWeight: "bold" },
  updateButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#FF8C00", padding: 15, borderRadius: 12, elevation: 2, gap: 8,
  },
  updateButtonText: { fontSize: 16, color: "#FFF", fontWeight: "bold" },
  disabledButton: { opacity: 0.6 },
  hintText: { fontSize: 12, color: "#999", textAlign: "center", marginTop: 6 },
});

export default BookingDetailScreen;