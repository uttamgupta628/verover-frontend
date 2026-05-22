// app/History.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { AxiosError } from "axios";
import axiosInstance from "../../api/axios";
import { useAppSelector } from "../../components/redux/hooks";
import BookingHistoryCard from "../../components/BookingHistoryCard";
import { BookingData } from "../../types";
import colors from "../../assets/color";

type FilterType = "ALL" | "G" | "L" | "R";

const FILTERS: { key: FilterType; label: string; icon: string }[] = [
  { key: "ALL", label: "All",         icon: "🗂️" },
  { key: "G",   label: "Garage",      icon: "🏢" },
  { key: "L",   label: "Parking Lot", icon: "🅿️" },
  { key: "R",   label: "Residence",   icon: "🏠" },
];

// ── Helper: normalise payment method label ────────────────────────────────────
const normalisePaymentMethod = (raw?: string): string => {
  if (!raw) return "N/A";
  const m = raw.toUpperCase();
  if (m === "STRIPE" || m.includes("CARD") || m.includes("CREDIT")) return "Card";
  if (m === "CASH") return "Cash";
  if (m.includes("UPI")) return "UPI";
  return raw;
};

// ── Helper: build a consistent paymentDetails block ───────────────────────────
const buildPaymentDetails = (b: any) => ({
  status:        b.paymentDetails?.status        || b.status || "",
  method:        normalisePaymentMethod(
                   b.paymentDetails?.paymentMethod ||
                   b.paymentDetails?.method        || ""
                 ),
  paymentMethod: b.paymentDetails?.paymentMethod  ||
                 b.paymentDetails?.method          || "",
  paidAt:        b.paymentDetails?.paidAt         || null,
  amountPaid:    b.paymentDetails?.amountPaid      ||
                 b.paymentDetails?.amountPaidBy    || 0,
  totalAmount:   b.paymentDetails?.totalAmount     || b.totalAmount || 0,
});

const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const authToken = useAppSelector((state) => state.auth.token);
  const [bookingHistory, setBookingHistory] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");

  const fetchBookingHistory = useCallback(async () => {
    if (!authToken) {
      Alert.alert("Error", "Authentication required.");
      return;
    }

    const headers = {
      Authorization: authToken,
      "Content-Type": "application/json",
    };

    try {
      const [garageRes, lotRes, residenceRes] = await Promise.allSettled([
        axiosInstance.get("/merchants/garage/booking",     { headers }),
        axiosInstance.get("/merchants/parkinglot/booking", { headers }),
        axiosInstance.get("/merchants/residence/booking",  { headers }),
      ]);
console.log("LOT fetch URL:", axiosInstance.defaults.baseURL + "/merchants/parkinglot/booking");
      // ── Garage bookings ───────────────────────────────────────────────────
      const garageBookings: BookingData[] =
        garageRes.status === "fulfilled"
          ? (garageRes.value.data?.data?.bookings || []).map((b: any) => ({
              ...b,
              type:          "G",
              bookingId:     b._id,
              vehicleNumber: b.vehicleNumber || "",
              garageName:    b.garage?.name || b.garageName || "",
              slot:          b.bookedSlot   || b.slot       || "",
              bookingPeriod: {
                from: b.bookingPeriod?.from,
                to:   b.bookingPeriod?.to,
              },
              pricing: {
                totalAmount:    b.pricing?.totalAmount    ?? b.paymentDetails?.amountPaid    ?? 0,
                basePrice:      b.pricing?.basePrice      ?? b.paymentDetails?.totalAmount   ?? 0,
                discount:       b.pricing?.discount       ?? b.paymentDetails?.discount      ?? 0,
                serviceFee:     b.pricing?.serviceFee     ?? b.paymentDetails?.serviceFee    ?? 0,
                transactionFee: b.pricing?.transactionFee ?? b.paymentDetails?.transactionFee?? 0,
                estimatedTaxes: b.pricing?.estimatedTaxes ?? b.paymentDetails?.estimatedTaxes?? 0,
                couponApplied:  b.pricing?.couponApplied  ?? false,
                couponDetails:  b.pricing?.couponDetails  ?? null,
              },
              placeInfo: {
                name:    b.placeInfo?.name    || b.garage?.name          || "",
                address: b.placeInfo?.address || b.garage?.address       || "",
                phoneNo: b.placeInfo?.phoneNo || b.garage?.contactNumber || "",
                owner:   b.placeInfo?.owner   || b.garage?.ownerName     || "",
              },
              paymentDetails: buildPaymentDetails(b),
              status: b.status || b.paymentDetails?.status || "",
            }))
          : [];

      // ── Lot bookings ──────────────────────────────────────────────────────
      const lotBookings: BookingData[] =
        lotRes.status === "fulfilled"
          ? (lotRes.value.data?.data?.bookings || []).map((b: any) => ({
              ...b,
              type:          "L",
              bookingId:     b._id,
              vehicleNumber: b.vehicleNumber || b.carLicensePlateImage ||
                             b.renterInfo?.carLicensePlateImage || "",
              garageName:    b.parking?.name || "",
              slot:          b.bookedSlot    || b.slot || "",
              bookingPeriod: {
                from: b.bookingPeriod?.from,
                to:   b.bookingPeriod?.to,
              },
              pricing: {
                totalAmount:    b.paymentDetails?.amountPaid      ?? 0,
                basePrice:      b.paymentDetails?.totalAmount     ?? 0,
                discount:       b.paymentDetails?.discount        ?? 0,
                serviceFee:     b.paymentDetails?.serviceFee      ?? 0,
                transactionFee: b.paymentDetails?.transactionFee  ?? 0,
                estimatedTaxes: b.paymentDetails?.estimatedTaxes  ?? 0,
                couponApplied:  false,
                couponDetails:  null,
              },
              placeInfo: {
                name:    b.parking?.name          || "",
                address: b.parking?.address       || "",
                phoneNo: b.parking?.contactNumber || "",
                owner:   b.parking?.ownerName     || "",
              },
              paymentDetails: buildPaymentDetails(b),
              status: b.status || b.paymentDetails?.status || "",
            }))
          : [];

      // ── Residence bookings ────────────────────────────────────────────────
      const residenceBookings: BookingData[] =
        residenceRes.status === "fulfilled"
          ? (residenceRes.value.data?.data?.bookings || []).map((b: any) => ({
              ...b,
              type:          "R",
              bookingId:     b._id,
              vehicleNumber: b.vehicleNumber || b.carLicensePlateImage || "",
              garageName:    b.residence?.name || "",
              slot:          "N/A",
              bookingPeriod: {
                from: b.bookingPeriod?.from,
                to:   b.bookingPeriod?.to,
              },
              pricing: {
                totalAmount:    b.paymentDetails?.amountPaid      ?? 0,
                basePrice:      b.paymentDetails?.totalAmount     ?? 0,
                discount:       b.paymentDetails?.discount        ?? 0,
                serviceFee:     b.paymentDetails?.serviceFee      ?? 0,
                transactionFee: b.paymentDetails?.transactionFee  ?? 0,
                estimatedTaxes: b.paymentDetails?.estimatedTaxes  ?? 0,
                couponApplied:  false,
                couponDetails:  null,
              },
              placeInfo: {
                name:    b.residence?.name          || "",
                address: b.residence?.address       || "",
                phoneNo: b.residence?.contactNumber || "",
                owner:   b.residence?.ownerName     || "",
              },
              paymentDetails: buildPaymentDetails(b),
              status: b.status || b.paymentDetails?.status || "",
            }))
          : [];

      if (garageRes.status    === "rejected") console.warn("Garage bookings failed:",    garageRes.reason?.message);
      if (lotRes.status       === "rejected") console.warn("Lot bookings failed:",       lotRes.reason?.message);
      if (residenceRes.status === "rejected") console.warn("Residence bookings failed:", residenceRes.reason?.message);

      const allBookings = [
        ...garageBookings,
        ...lotBookings,
        ...residenceBookings,
      ].sort((a, b) => {
        const dateA = new Date(a.bookingPeriod?.from || 0).getTime();
        const dateB = new Date(b.bookingPeriod?.from || 0).getTime();
        return dateB - dateA;
      });

      setBookingHistory(allBookings);
    } catch (err) {
      const error = err as AxiosError;
      Alert.alert("Fetch Error", error.message || "Failed to load history.");
      console.error("History fetch error:", error.response?.data || error.message);
    }
  }, [authToken]);

  React.useEffect(() => {
    fetchBookingHistory().finally(() => setLoading(false));
  }, [fetchBookingHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookingHistory();
    setRefreshing(false);
  }, [fetchBookingHistory]);

  const handleBookingPress = (booking: BookingData) => {
    router.push({
      pathname: "/parkingUser/booking-detail",
      params: { bookingData: JSON.stringify(booking) },
    });
  };

  const filteredHistory =
    activeFilter === "ALL"
      ? bookingHistory
      : bookingHistory.filter((b) => b.type === activeFilter);

  const totalSpent = bookingHistory.reduce(
    (sum, b) => sum + (b.pricing?.totalAmount ?? 0), 0
  );
  const successCount = bookingHistory.filter(
    (b) =>
      (b.status || "").toUpperCase() === "SUCCESS" ||
      (b.status || "").toUpperCase() === "COMPLETED"
  ).length;

  const renderBookingItem = ({ item }: { item: BookingData }) => (
    <BookingHistoryCard booking={item} onPress={() => handleBookingPress(item)} />
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your bookings…</Text>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Booking History</Text>
        <Text style={styles.headerSubtitle}>
          {bookingHistory.length} total booking{bookingHistory.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* ── SUMMARY STATS STRIP ─────────────────────────────────────────── */}
      {bookingHistory.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{bookingHistory.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{successCount}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              ${totalSpent.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>
      )}

      {/* ── FILTER TABS ─────────────────────────────────────────────────── */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const count =
            f.key === "ALL"
              ? bookingHistory.length
              : bookingHistory.filter((b) => b.type === f.key).length;

          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.filterIcon}>{f.icon}</Text>
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── LIST ────────────────────────────────────────────────────────── */}
      <FlatList
        data={filteredHistory}
        renderItem={renderBookingItem}
        keyExtractor={(item) => `${item.type}-${item.bookingId || item._id}`}
        contentContainerStyle={
          filteredHistory.length === 0 ? styles.emptyCentered : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={styles.emptyTitle}>No bookings found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === "ALL"
                ? "You haven't made any bookings yet."
                : `No ${FILTERS.find((f) => f.key === activeFilter)?.label} bookings yet.`}
            </Text>
            {activeFilter !== "ALL" && (
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={() => setActiveFilter("ALL")}
              >
                <Text style={styles.emptyResetBtnText}>Show All</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  centered:  { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.primary, fontWeight: "500" },

  // Header
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
    fontWeight: "500",
  },

  // Stats strip
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem:   { flex: 1, alignItems: "center" },
  statValue:  { fontSize: 20, fontWeight: "800", color: "#111", marginBottom: 2 },
  statLabel:  { fontSize: 11, color: "#9CA3AF", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statDivider:{ width: 1, backgroundColor: "#F0F0F0", marginVertical: 4 },

  // Filter tabs
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    gap: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  filterIcon:           { fontSize: 18 },
  filterLabel:          { fontSize: 10, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.3 },
  filterLabelActive:    { color: "#fff" },
  filterBadge:          { backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center" },
  filterBadgeActive:    { backgroundColor: "rgba(255,255,255,0.25)" },
  filterBadgeText:      { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  filterBadgeTextActive:{ color: "#fff" },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  // Empty state
  emptyCentered:   { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 80 },
  emptyContainer:  { alignItems: "center", paddingTop: 60 },
  emptyIcon:       { fontSize: 52, marginBottom: 16 },
  emptyTitle:      { fontSize: 18, fontWeight: "700", color: "#111", marginBottom: 8 },
  emptySubtitle:   { fontSize: 14, color: "#9CA3AF", textAlign: "center", paddingHorizontal: 32, lineHeight: 20 },
  emptyResetBtn:   { marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 11, borderRadius: 12 },
  emptyResetBtnText:{ color: "#fff", fontSize: 14, fontWeight: "700" },
});

export default HistoryScreen;