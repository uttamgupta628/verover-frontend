// app/parkingUser/booking-detail.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconButton } from "react-native-paper";
import QRCode from "react-native-qrcode-svg";
import { useSelector } from "react-redux";
import axiosInstance from "../../api/axios";
import { RootState } from "../../components/redux/store";
import colors from "../../assets/color";
import { useStripeWrapper } from "../stripWrapper";

interface BookingDetail {
  _id?: string;
  bookingId?: string;
  type: "G" | "L" | "R";
  garageName?: string;
  slot?: string;
  bookedSlot?: string;
  vehicleNumber?: string;
  bookingPeriod?: { from: string; to: string };
  pricing?: {
    totalAmount?: number;
    basePrice?: number;
    discount?: number;
    serviceFee?: number;
    transactionFee?: number;
    estimatedTaxes?: number;
    priceRate?: number;       // ← added
  };
  priceRate?: number;         // ← added — some backends return this at top level
  placeInfo?: {
    name?: string;
    address?: string;
    phoneNo?: string;
    owner?: string;
  };
  paymentDetails?: {
    status?: string;
    method?: string;
    paymentMethod?: string;
    paidAt?: string;
    amountPaid?: number;
    totalAmount?: number;
  };
  status?: string;
  createdAt?: string;
}

// ── Extension pricing preview ────────────────────────────────────────────────
interface ExtensionPreview {
  doubleRate: number;
  baseAmount: number;
  serviceFee: number;
  transactionFee: number;
  estimatedTaxes: number;
  totalAmount: number;
}

const HOUR_OPTIONS = [1, 2, 3, 6, 12, 24];

const BookingDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const authToken = useSelector((state: RootState) => state.auth.token);
  const Stripe = useStripeWrapper();

  const [bookingData, setBookingData] = useState<BookingDetail | null>(null);

  // ── Extend modal state ────────────────────────────────────────────────────
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extraHours, setExtraHours] = useState(1);
  const [customHours, setCustomHours] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendSuccess, setExtendSuccess] = useState(false);
  const [newCheckOut, setNewCheckOut] = useState<string | null>(null);

  // ── Stripe extension state ────────────────────────────────────────────────
  const [pendingStripeExtension, setPendingStripeExtension] = useState<{
    paymentIntentId: string;
    bookingId: string;
    endpoint: string;
    newTo: string;
  } | null>(null);

  useEffect(() => {
    try {
      if (params.bookingData) {
        const parsed = JSON.parse(params.bookingData as string);
        setBookingData(parsed);
      } else {
        Alert.alert("Error", "No booking data found");
      }
    } catch {
      Alert.alert("Error", "Invalid booking data");
    }
  }, []);

  if (!bookingData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const formatDate = (value?: string) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusConfig = (status = "") => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        return { color: "#10B981", bg: "#ECFDF5", label: "✓  Confirmed" };
      case "PENDING":
        return { color: "#F59E0B", bg: "#FFFBEB", label: "⏳  Pending" };
      case "FAILED":
        return { color: "#EF4444", bg: "#FEF2F2", label: "✕  Failed" };
      case "CANCELLED":
        return { color: "#6B7280", bg: "#F3F4F6", label: "✕  Cancelled" };
      default:
        return { color: "#6B7280", bg: "#F3F4F6", label: status || "N/A" };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "G": return "Garage";
      case "L": return "Parking Lot";
      case "R": return "Residence";
      default:  return "Parking";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "G": return "🏢";
      case "L": return "🅿️";
      case "R": return "🏠";
      default:  return "🚗";
    }
  };

  const resolvePaymentMethod = (raw?: string): string => {
    if (!raw) return "N/A";
    const m = raw.toUpperCase();
    if (m === "STRIPE" || m === "CARD" || m === "CREDIT" || m.includes("CREDIT")) return "Card";
    if (m === "CASH") return "Cash";
    if (m.includes("UPI")) return "UPI";
    return raw;
  };

  const getPaymentIcon = (method = "") => {
    const m = method.toUpperCase();
    if (m === "CARD" || m === "STRIPE" || m === "CREDIT" || m.includes("CREDIT")) return "💳";
    if (m === "CASH") return "💵";
    if (m.includes("UPI")) return "📱";
    return "💰";
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const displayName  = bookingData.placeInfo?.name || bookingData.garageName || "N/A";
  const slotDisplay  = bookingData.slot || bookingData.bookedSlot || "N/A";
  const totalAmount  =
    bookingData.pricing?.totalAmount       ??
    bookingData.paymentDetails?.amountPaid ??
    bookingData.paymentDetails?.totalAmount ?? 0;

  const status = bookingData.status || bookingData.paymentDetails?.status || "N/A";

  const rawPaymentMethod =
    bookingData.paymentDetails?.method        ||
    bookingData.paymentDetails?.paymentMethod || "";
  const paymentMethod = resolvePaymentMethod(rawPaymentMethod);

  const statusConfig = getStatusConfig(status);

  const qrCodeValue = JSON.stringify({
    bookingId:     bookingData.bookingId || bookingData._id,
    place:         displayName,
    slot:          slotDisplay,
    vehicleNumber: bookingData.vehicleNumber,
    type:          bookingData.type,
  });

  const durationMs = bookingData.bookingPeriod
    ? new Date(bookingData.bookingPeriod.to).getTime() -
      new Date(bookingData.bookingPeriod.from).getTime()
    : 0;
  const durationHrs = durationMs > 0 ? Math.ceil(durationMs / 3600000) : null;

  // ── Can this booking be extended? ─────────────────────────────────────────
  const canExtend =
    (status.toUpperCase() === "SUCCESS" || status.toUpperCase() === "PENDING") &&
    bookingData.bookingPeriod?.to != null &&
    new Date(bookingData.bookingPeriod.to).getTime() > Date.now();

  // ── Extension pricing preview ──────────────────────────────────────────────
  // FIX: check priceRate at multiple levels before falling back to basePrice/hrs
  // This prevents doubleRate from being $0 when priceRate isn't in pricing
  const explicitRate =
    bookingData.priceRate ??
    bookingData.pricing?.priceRate ??
    null;

  const basePrice   = bookingData.pricing?.basePrice ?? totalAmount;
  const origHrs     = durationHrs && durationHrs > 0 ? durationHrs : 1;
  const origRate    = explicitRate !== null && explicitRate > 0
    ? explicitRate
    : basePrice / origHrs;

  // Guard: if origRate is still 0, use totalAmount / origHrs as last resort
  const safeOrigRate = origRate > 0 ? origRate : (totalAmount / origHrs);
  const doubleRate   = safeOrigRate * 2;

  const getHours = () => {
    if (useCustom) {
      const h = parseFloat(customHours);
      return isNaN(h) || h < 1 ? 1 : Math.min(h, 72);
    }
    return extraHours;
  };

  const computePreview = (): ExtensionPreview => {
    const h              = getHours();
    const baseAmount     = doubleRate * h;
    const serviceFee     = baseAmount * 0.05;
    const transactionFee = 0.5;
    const estimatedTaxes = baseAmount * 0.15;
    const total          = baseAmount + serviceFee + transactionFee + estimatedTaxes;
    return {
      doubleRate,
      baseAmount,
      serviceFee,
      transactionFee,
      estimatedTaxes,
      totalAmount: total,
    };
  };

  const preview = computePreview();

  // ── New checkout time preview ─────────────────────────────────────────────
  const currentTo      = bookingData.bookingPeriod?.to
    ? new Date(bookingData.bookingPeriod.to)
    : new Date();
  const previewNewTo   = new Date(currentTo.getTime() + getHours() * 3_600_000);
  const formattedNewTo = formatDate(previewNewTo.toISOString());

  // ── Backend call ──────────────────────────────────────────────────────────
  const handleExtend = async () => {
    const hours   = getHours();
    const bid     = bookingData.bookingId || bookingData._id;
    if (!bid) { Alert.alert("Error", "Booking ID not found"); return; }

    const typePrefix =
      bookingData.type === "G" ? "garage" :
      bookingData.type === "L" ? "parkinglot" : "residence";

    const backendPaymentMethod =
      paymentMethod === "Card" ? "CREDIT" :
      paymentMethod === "UPI"  ? "UPI"    : "CASH";

    setExtendLoading(true);
    try {
      // ── STEP 1: Create extension record on backend ─────────────────────
      const response = await axiosInstance.post(
        `/merchants/${typePrefix}/booking/${bid}/extend`,
        { bookingId: bid, extraHours: hours, paymentMethod: backendPaymentMethod },
        { headers: { Authorization: authToken, "Content-Type": "application/json" }, timeout: 15000 }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Extension failed");
      }

      const data = response.data.data;

      // ── STEP 2a: CASH — already PENDING on backend, show success ───────
      if (backendPaymentMethod === "CASH") {
        setNewCheckOut(data?.newTo ?? previewNewTo.toISOString());
        setExtendSuccess(true);
        return;
      }

      // ── STEP 2b: CREDIT — open Stripe payment sheet ────────────────────
      if (backendPaymentMethod === "CREDIT") {
        const sd = data?.stripeDetails;

        if (!sd?.paymentIntent || !sd?.paymentIntentId) {
          throw new Error("Stripe payment details missing from server response.");
        }

        // Build the pending context BEFORE opening the sheet
        // so confirmStripeExtension always has valid data even if sheet
        // closes unexpectedly
        const pendingContext = {
          paymentIntentId: sd.paymentIntentId,
          bookingId:       bid,
          endpoint:        typePrefix,
          newTo:           data?.newTo ?? previewNewTo.toISOString(),
        };
        setPendingStripeExtension(pendingContext);

        // Initialise the Stripe payment sheet
        const customerId = sd.customerId || sd.paymentIntentId || `ext_${Date.now()}`;
        const initOk = await Stripe.initializedPaymentSheet(
          sd.paymentIntent,
          sd.ephemeralKey || "",
          customerId,
          sd.paymentIntentId
        );

        if (!initOk) {
          setPendingStripeExtension(null);
          throw new Error("Could not initialise payment sheet. Please try again.");
        }

        // Open the sheet
        const payResult = await Stripe.openPayment();

        if (payResult === true) {
          // ── STEP 3: Confirm extension on backend ───────────────────────
          await confirmStripeExtension(pendingContext);
        } else {
          // User cancelled — extension record stays AWAITING_CONFIRMATION
          // on the backend (will not activate). Show gentle message.
          setPendingStripeExtension(null);
          Alert.alert(
            "Payment Cancelled",
            "Your extension was not charged. The booking period remains unchanged.",
            [{ text: "OK" }]
          );
        }
        return;
      }

      // ── UPI — treat same as cash for now (collect-request flow) ────────
      setNewCheckOut(data?.newTo ?? previewNewTo.toISOString());
      setExtendSuccess(true);

    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to extend booking.";
      let friendlyMsg = msg;
      if (msg.includes("EXTENSION_SLOT_NOT_AVAILABLE"))
        friendlyMsg = "The slot is already booked during your requested extension window.";
      else if (msg.includes("BOOKING_NOT_EXTENDABLE"))
        friendlyMsg = "This booking cannot be extended (it may be failed or cancelled).";
      else if (msg.includes("CANNOT_DERIVE_HOURLY_RATE"))
        friendlyMsg = "Could not calculate the extension rate. Please contact support.";
      Alert.alert("Extension Failed", friendlyMsg);
    } finally {
      setExtendLoading(false);
    }
  };

  // ── STEP 3: Confirm Stripe extension on backend ──────────────────────────
  const confirmStripeExtension = async (pending: {
    paymentIntentId: string;
    bookingId: string;
    endpoint: string;
    newTo: string;
  }) => {
    try {
      const confirmRes = await axiosInstance.patch(
        `/merchants/${pending.endpoint}/booking/${pending.bookingId}/extend/confirm`,
        { paymentIntentId: pending.paymentIntentId },
        { headers: { Authorization: authToken, "Content-Type": "application/json" }, timeout: 15000 }
      );

      if (confirmRes.data.success) {
        // FIX: backend returns newCheckOut, fall back to newTo if absent
        const activatedTo =
          confirmRes.data.data?.newCheckOut ??
          confirmRes.data.data?.newTo       ??
          pending.newTo;

        // FIX: update bookingData BEFORE showing success to avoid stale UI
        setBookingData((prev) =>
          prev
            ? {
                ...prev,
                bookingPeriod: {
                  from: prev.bookingPeriod?.from ?? "",
                  to:   activatedTo,
                },
              }
            : prev
        );
        setNewCheckOut(activatedTo);
        setPendingStripeExtension(null); // clear pending after all state is set
        setExtendSuccess(true);
      } else {
        throw new Error(confirmRes.data.message || "Confirmation failed");
      }
    } catch (err: any) {
      // Payment went through on Stripe but backend confirm failed — show retry
      Alert.alert(
        "Confirmation Failed",
        "Your card was charged but we could not confirm the extension. Please contact support with your booking ID.",
        [
          {
            text: "Retry Confirm",
            onPress: () => confirmStripeExtension(pending), // uses parameter — safe closure
          },
          { text: "OK", style: "cancel" },
        ]
      );
    }
  };

  const handleCloseExtend = () => {
    setShowExtendModal(false);
    setExtendSuccess(false);
    setNewCheckOut(null);
    setUseCustom(false);
    setCustomHours("");
    setExtraHours(1);
    setPendingStripeExtension(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconButton icon="arrow-left" size={24} iconColor={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HERO CARD ───────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroBlobTL} />
          <View style={styles.heroBlobBR} />

          <View style={styles.typeRow}>
            <View style={styles.typePill}>
              <Text style={styles.typeIcon}>{getTypeIcon(bookingData.type)}</Text>
              <Text style={styles.typePillText}>{getTypeLabel(bookingData.type)}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.heroPlaceName}>{displayName}</Text>
          {bookingData.placeInfo?.address && (
            <Text style={styles.heroAddress}>📍 {bookingData.placeInfo.address}</Text>
          )}

          <View style={styles.heroStatsRow}>
            {bookingData.type !== "R" && (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Slot</Text>
                <Text style={styles.heroStatValue}>{slotDisplay}</Text>
              </View>
            )}
            {durationHrs && (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Duration</Text>
                <Text style={styles.heroStatValue}>{durationHrs}h</Text>
              </View>
            )}
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Amount</Text>
              <Text style={[styles.heroStatValue, styles.heroStatAmount]}>
                ${totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── EXTEND TIME BUTTON ──────────────────────────────────────── */}
        {canExtend && (
          <TouchableOpacity
            style={styles.extendBtn}
            onPress={() => setShowExtendModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.extendBtnInner}>
              <View style={styles.extendBtnLeft}>
                <Text style={styles.extendBtnIcon}>⏱️</Text>
                <View>
                  <Text style={styles.extendBtnTitle}>Extend Parking Time</Text>
                  <Text style={styles.extendBtnSub}>
                    Charged at 2× rate · Same payment method
                  </Text>
                </View>
              </View>
              <Text style={styles.extendBtnArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── BOOKING ID STRIP ────────────────────────────────────────── */}
        <View style={styles.bookingIdStrip}>
          <View>
            <Text style={styles.bookingIdLabel}>Booking ID</Text>
            <Text style={styles.bookingIdValue}>
              #{bookingData.bookingId || bookingData._id}
            </Text>
          </View>
          <View style={styles.paymentMethodBadge}>
            <Text style={styles.paymentMethodIcon}>{getPaymentIcon(paymentMethod)}</Text>
            <Text style={styles.paymentMethodText}>{paymentMethod}</Text>
          </View>
        </View>

        {/* ── PAYMENT INFO ROW ────────────────────────────────────────── */}
        <View style={styles.paymentInfoRow}>
          <View style={styles.paymentInfoItem}>
            <Text style={styles.paymentInfoLabel}>Payment Status</Text>
            <View style={[styles.paymentStatusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.paymentStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.paymentInfoDivider} />
          <View style={styles.paymentInfoItem}>
            <Text style={styles.paymentInfoLabel}>Paid Via</Text>
            <Text style={styles.paymentInfoValue}>
              {getPaymentIcon(paymentMethod)} {paymentMethod}
            </Text>
          </View>
          {bookingData.paymentDetails?.paidAt && (
            <>
              <View style={styles.paymentInfoDivider} />
              <View style={styles.paymentInfoItem}>
                <Text style={styles.paymentInfoLabel}>Paid At</Text>
                <Text style={styles.paymentInfoValue}>
                  {formatDate(bookingData.paymentDetails.paidAt)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── QR CODE ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderDot} />
            <Text style={styles.cardTitle}>Parking Pass</Text>
          </View>
          <View style={styles.qrWrapper}>
            <View style={styles.qrFrame}>
              <QRCode value={qrCodeValue} size={180} color="#1a1a1a" />
            </View>
          </View>
          <Text style={styles.qrVehicleNumber}>
            🚗 {bookingData.vehicleNumber || "—"}
          </Text>
          <Text style={styles.qrHint}>Present this QR at the parking gate</Text>
        </View>

        {/* ── BOOKING INFO ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderDot} />
            <Text style={styles.cardTitle}>Booking Info</Text>
          </View>

          <Detail
            icon="📅"
            label="Check In"
            value={formatDate(bookingData.bookingPeriod?.from)}
          />
          <Detail
            icon="📅"
            label="Check Out"
            value={formatDate(bookingData.bookingPeriod?.to)}
          />
          {bookingData.type !== "R" && (
            <Detail icon="🅿️" label="Slot" value={slotDisplay} />
          )}
          <Detail
            icon="🚗"
            label="Vehicle"
            value={bookingData.vehicleNumber || "N/A"}
          />
          {bookingData.placeInfo?.phoneNo && (
            <Detail icon="📞" label="Contact" value={bookingData.placeInfo.phoneNo} />
          )}
          {bookingData.placeInfo?.owner && (
            <Detail icon="👤" label="Manager" value={bookingData.placeInfo.owner} />
          )}
        </View>

        {/* ── PRICE BREAKDOWN ──────────────────────────────────────────── */}
        {bookingData.pricing && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderDot} />
              <Text style={styles.cardTitle}>Price Breakdown</Text>
            </View>

            <PriceRow
              label="Base Price"
              value={`$${(bookingData.pricing.basePrice ?? 0).toFixed(2)}`}
            />
            {(bookingData.pricing.serviceFee ?? 0) > 0 && (
              <PriceRow
                label="Service Fee (5%)"
                value={`$${bookingData.pricing.serviceFee!.toFixed(2)}`}
              />
            )}
            {(bookingData.pricing.transactionFee ?? 0) > 0 && (
              <PriceRow
                label="Transaction Fee"
                value={`$${bookingData.pricing.transactionFee!.toFixed(2)}`}
              />
            )}
            {(bookingData.pricing.estimatedTaxes ?? 0) > 0 && (
              <PriceRow
                label="Taxes (15%)"
                value={`$${bookingData.pricing.estimatedTaxes!.toFixed(2)}`}
              />
            )}
            {(bookingData.pricing.discount ?? 0) > 0 && (
              <PriceRow
                label="Discount"
                value={`- $${bookingData.pricing.discount!.toFixed(2)}`}
                isDiscount
              />
            )}

            <View style={styles.priceDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.paymentMethodLine}>
              <Text style={styles.paymentMethodLineLabel}>
                {getPaymentIcon(paymentMethod)} Paid via {paymentMethod}
              </Text>
            </View>

            <Text style={styles.taxNote}>* Estimated taxes may vary</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── EXTEND TIME MODAL ─────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={showExtendModal}
        onRequestClose={handleCloseExtend}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.extendModal}>

            {/* Header */}
            <View style={styles.extendModalHeader}>
              <View>
                <Text style={styles.extendModalTitle}>Extend Parking Time</Text>
                <Text style={styles.extendModalSub}>
                  Billed at 2× your original rate
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseExtend} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.extendModalBody}>

              {extendSuccess ? (
                /* ── SUCCESS STATE ── */
                <View style={styles.successBox}>
                  <View style={styles.successIconWrap}>
                    <Text style={styles.successIcon}>✓</Text>
                  </View>
                  <Text style={styles.successTitle}>Time Extended!</Text>
                  <Text style={styles.successMsg}>
                    Your parking has been extended. New checkout time:
                  </Text>
                  <View style={styles.successDateChip}>
                    <Text style={styles.successDateText}>
                      {formatDate(newCheckOut ?? previewNewTo.toISOString())}
                    </Text>
                  </View>
                  {paymentMethod === "Cash" && (
                    <View style={styles.cashNote}>
                      <Text style={styles.cashNoteText}>
                        💵 Cash payment pending. The merchant will confirm your extension shortly.
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.doneBtn} onPress={handleCloseExtend}>
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* ── Current checkout info ── */}
                  <View style={styles.currentCheckoutCard}>
                    <Text style={styles.currentCheckoutLabel}>Current Check-Out</Text>
                    <Text style={styles.currentCheckoutValue}>
                      {formatDate(bookingData.bookingPeriod?.to)}
                    </Text>
                  </View>

                  {/* ── Rate warning ── */}
                  <View style={styles.rateWarningBox}>
                    <Text style={styles.rateWarningIcon}>⚠️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rateWarningTitle}>Double Rate Applied</Text>
                      <Text style={styles.rateWarningText}>
                        Original: ${safeOrigRate.toFixed(2)}/hr →{" "}
                        Extension: ${doubleRate.toFixed(2)}/hr
                      </Text>
                    </View>
                  </View>

                  {/* ── Hour selector ── */}
                  <Text style={styles.sectionLabel}>Select Extra Hours</Text>
                  <View style={styles.hourGrid}>
                    {HOUR_OPTIONS.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.hourChip,
                          !useCustom && extraHours === h && styles.hourChipSelected,
                        ]}
                        onPress={() => { setExtraHours(h); setUseCustom(false); }}
                      >
                        <Text
                          style={[
                            styles.hourChipText,
                            !useCustom && extraHours === h && styles.hourChipTextSelected,
                          ]}
                        >
                          {h}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.hourChip, useCustom && styles.hourChipSelected]}
                      onPress={() => setUseCustom(true)}
                    >
                      <Text
                        style={[styles.hourChipText, useCustom && styles.hourChipTextSelected]}
                      >
                        Custom
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {useCustom && (
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="e.g. 5"
                        placeholderTextColor="#aaa"
                        keyboardType="numeric"
                        value={customHours}
                        onChangeText={setCustomHours}
                        maxLength={3}
                      />
                      <Text style={styles.customInputSuffix}>hours (max 72)</Text>
                    </View>
                  )}

                  {/* ── New checkout preview ── */}
                  <View style={styles.newCheckoutPreview}>
                    <Text style={styles.newCheckoutLabel}>New Check-Out</Text>
                    <Text style={styles.newCheckoutValue}>{formattedNewTo}</Text>
                  </View>

                  {/* ── Price breakdown ── */}
                  <View style={styles.extendPriceCard}>
                    <Text style={styles.extendPriceTitle}>Extension Cost Breakdown</Text>

                    <View style={styles.extendPriceRow}>
                      <Text style={styles.extendPriceLabel}>
                        Base ({getHours()}h × ${doubleRate.toFixed(2)}/h)
                      </Text>
                      <Text style={styles.extendPriceValue}>
                        ${preview.baseAmount.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.extendPriceRow}>
                      <Text style={styles.extendPriceLabel}>Service Fee (5%)</Text>
                      <Text style={styles.extendPriceValue}>
                        ${preview.serviceFee.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.extendPriceRow}>
                      <Text style={styles.extendPriceLabel}>Transaction Fee</Text>
                      <Text style={styles.extendPriceValue}>
                        ${preview.transactionFee.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.extendPriceRow}>
                      <Text style={styles.extendPriceLabel}>Taxes (15%)</Text>
                      <Text style={styles.extendPriceValue}>
                        ${preview.estimatedTaxes.toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.extendPriceDivider} />

                    <View style={styles.extendTotalRow}>
                      <Text style={styles.extendTotalLabel}>Total Due</Text>
                      <Text style={styles.extendTotalValue}>
                        ${preview.totalAmount.toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.payViaRow}>
                      <Text style={styles.payViaText}>
                        {getPaymentIcon(paymentMethod)} Pay via {paymentMethod}
                        {paymentMethod === "Cash" && " · Merchant confirms"}
                      </Text>
                    </View>
                  </View>

                  {/* ── Confirm button ── */}
                  <TouchableOpacity
                    style={[
                      styles.extendConfirmBtn,
                      extendLoading && styles.extendConfirmBtnDisabled,
                    ]}
                    onPress={handleExtend}
                    disabled={extendLoading}
                  >
                    {extendLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.extendConfirmBtnText}>
                        Confirm Extension · ${preview.totalAmount.toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.extendDisclaimer}>
                    * Extension activates immediately (cash bookings after merchant confirmation).
                    Estimated taxes may vary.
                  </Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const Detail = ({
  icon, label, value,
}: { icon: string; label: string; value: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLeft}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const PriceRow = ({
  label, value, isDiscount = false,
}: { label: string; value: string; isDiscount?: boolean }) => (
  <View style={styles.priceRow}>
    <Text style={styles.priceLabel}>{label}</Text>
    <Text style={[styles.priceValue, isDiscount && styles.discountValue]}>{value}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  centered:  { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F5" },
  loadingText: { fontSize: 16, color: colors.primary },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn:     { borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111" },

  scrollContent: { padding: 16, paddingBottom: 40 },

  // Hero card
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 22,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBlobTL: {
    position: "absolute",
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -40, left: -30,
  },
  heroBlobBR: {
    position: "absolute",
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -60, right: -40,
  },
  typeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  typeIcon:      { fontSize: 14 },
  typePillText:  { fontSize: 13, fontWeight: "600", color: "#fff" },
  statusPill:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText:{ fontSize: 12, fontWeight: "700" },
  heroPlaceName: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6, letterSpacing: 0.2 },
  heroAddress:   { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 20 },
  heroStatsRow:  {
    flexDirection: "row",
    gap: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
  },
  heroStat:       { flex: 1, alignItems: "center" },
  heroStatLabel:  { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  heroStatValue:  { fontSize: 18, fontWeight: "700", color: "#fff" },
  heroStatAmount: { fontSize: 20 },

  // ── Extend button ──────────────────────────────────────────────────────────
  extendBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.primary + "40",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  extendBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: colors.primary + "08",
  },
  extendBtnLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  extendBtnIcon: { fontSize: 26 },
  extendBtnTitle: { fontSize: 15, fontWeight: "700", color: colors.primary, marginBottom: 2 },
  extendBtnSub:   { fontSize: 12, color: "#888" },
  extendBtnArrow: { fontSize: 28, color: colors.primary, fontWeight: "300", marginLeft: 8 },

  // Booking ID strip
  bookingIdStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingIdLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "600", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  bookingIdValue: { fontSize: 15, fontWeight: "700", color: "#111", letterSpacing: 0.3 },
  paymentMethodBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "15",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  paymentMethodIcon: { fontSize: 16 },
  paymentMethodText: { fontSize: 13, fontWeight: "700", color: colors.primary },

  // Payment info row
  paymentInfoRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    alignItems: "center",
  },
  paymentInfoItem:    { flex: 1, alignItems: "center" },
  paymentInfoLabel:   { fontSize: 11, color: "#9CA3AF", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  paymentInfoValue:   { fontSize: 14, fontWeight: "700", color: "#111" },
  paymentInfoDivider: { width: 1, height: 36, backgroundColor: "#F0F0F0", marginHorizontal: 4 },
  paymentStatusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  paymentStatusText:  { fontSize: 12, fontWeight: "700" },

  // Generic card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardHeaderDot: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.primary },
  cardTitle:     { fontSize: 16, fontWeight: "700", color: "#111" },

  // QR section
  qrWrapper:       { alignItems: "center", marginBottom: 14 },
  qrFrame: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary + "30",
    borderStyle: "dashed",
    backgroundColor: "#FAFAFA",
  },
  qrVehicleNumber: { textAlign: "center", fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 6, letterSpacing: 1 },
  qrHint:          { textAlign: "center", fontSize: 12, color: "#9CA3AF" },

  // Detail row
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailLeft:  { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  detailIcon:  { fontSize: 15 },
  detailLabel: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  detailValue: { fontSize: 14, fontWeight: "600", color: "#111", flexShrink: 1, textAlign: "right", marginLeft: 12, maxWidth: "55%" },

  // Price rows
  priceRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  priceLabel:   { fontSize: 14, color: "#6B7280" },
  priceValue:   { fontSize: 14, fontWeight: "600", color: "#111" },
  discountValue:{ color: "#10B981", fontWeight: "700" },
  priceDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },
  totalRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  totalLabel:   { fontSize: 16, fontWeight: "700", color: "#111" },
  totalValue:   { fontSize: 20, fontWeight: "800", color: colors.primary },

  paymentMethodLine: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    alignItems: "center",
  },
  paymentMethodLineLabel: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  taxNote: { fontSize: 11, color: "#9CA3AF", fontStyle: "italic", marginTop: 8, textAlign: "center" },

  // ── Extend modal ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "flex-end",
  },
  extendModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 30,
  },
  extendModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  extendModalTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  extendModalSub:   { fontSize: 12, color: "#888", marginTop: 3 },
  modalCloseBtn:    { padding: 4 },
  modalCloseBtnText:{ fontSize: 20, color: "#999", fontWeight: "600" },

  extendModalBody: { padding: 20 },

  currentCheckoutCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  currentCheckoutLabel: { fontSize: 11, color: "#6B7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  currentCheckoutValue: { fontSize: 15, fontWeight: "700", color: "#111" },

  rateWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  rateWarningIcon:  { fontSize: 18 },
  rateWarningTitle: { fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 2 },
  rateWarningText:  { fontSize: 12, color: "#78350F" },

  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 10, letterSpacing: 0.3 },

  hourGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  hourChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  hourChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  hourChipText:         { fontSize: 14, fontWeight: "600", color: "#374151" },
  hourChipTextSelected: { color: "#fff" },

  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  customInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.primary + "60",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#FAFAFA",
  },
  customInputSuffix: { fontSize: 13, color: "#6B7280" },

  newCheckoutPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.primary + "10",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  newCheckoutLabel: { fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  newCheckoutValue: { fontSize: 14, fontWeight: "700", color: colors.primary },

  extendPriceCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  extendPriceTitle: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 12 },
  extendPriceRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  extendPriceLabel: { fontSize: 13, color: "#6B7280" },
  extendPriceValue: { fontSize: 13, fontWeight: "600", color: "#111" },
  extendPriceDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 10 },
  extendTotalRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  extendTotalLabel: { fontSize: 15, fontWeight: "700", color: "#111" },
  extendTotalValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
  payViaRow:        { alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  payViaText:       { fontSize: 12, color: colors.primary, fontWeight: "600" },

  extendConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  extendConfirmBtnDisabled: { opacity: 0.6 },
  extendConfirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  extendDisclaimer: { fontSize: 11, color: "#9CA3AF", fontStyle: "italic", textAlign: "center", lineHeight: 16 },

  // ── Success state ──────────────────────────────────────────────────────────
  successBox: { alignItems: "center", paddingVertical: 20 },
  successIconWrap: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#10B981",
  },
  successIcon:  { fontSize: 32, color: "#10B981" },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#111", marginBottom: 8 },
  successMsg:   { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 16, lineHeight: 20 },
  successDateChip: {
    backgroundColor: colors.primary + "15",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  successDateText: { fontSize: 15, fontWeight: "700", color: colors.primary },

  cashNote: {
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
    maxWidth: "90%",
  },
  cashNoteText: { fontSize: 12, color: "#92400E", textAlign: "center", lineHeight: 18 },

  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 14,
    marginTop: 4,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});


export default BookingDetailScreen;