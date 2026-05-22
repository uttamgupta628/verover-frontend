// parkingMerchent/merchantBookingHistoryScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
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

const HIDDEN_STATUSES = new Set(["FAILED", "COMPLETED"]);

interface BookingItem {
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
  user?: { firstName: string; lastName: string; phone: string; email?: string };
}

const MerchantParkingOrderHistory = () => {
  const router = useRouter();
  const { isAuthenticated, token } = useSelector((state: any) => state.auth); // ✅ token added
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allBookings, setAllBookings] = useState<BookingItem[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<BookingType | "all">("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("all");
  const [filterApplied, setFilterApplied] = useState(false);

  useEffect(() => {
    if (isAuthenticated) fetchAllBookings();
  }, [isAuthenticated]);

  useEffect(() => {
    filterBookings();
  }, [allBookings, activeFilter, activeStatusFilter]);

  const fetchAllBookings = async () => {
    try {
      setLoading(true);
      const [parkingRes, garageRes, residenceRes] = await Promise.allSettled([
        fetchParkingBookings(),
        fetchGarageBookings(),
        fetchResidenceBookings(),
      ]);
      const combined: BookingItem[] = [];
      if (parkingRes.status === "fulfilled") combined.push(...parkingRes.value);
      if (garageRes.status === "fulfilled") combined.push(...garageRes.value);
      if (residenceRes.status === "fulfilled") combined.push(...residenceRes.value);
      if (parkingRes.status === "rejected")
        console.warn("Parking fetch failed:", parkingRes.reason?.message);
      if (garageRes.status === "rejected")
        console.warn("Garage fetch failed:", garageRes.reason?.message);
      if (residenceRes.status === "rejected")
        console.warn("Residence fetch failed:", residenceRes.reason?.message);
      combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllBookings(combined);
    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      Alert.alert("Error", "Failed to fetch bookings. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const extractVehicleNumber = (b: any): string => {
    const candidates = [
      b.vehicleNumber,
      b.vehicle_number,
      b.licensePlate,
      b.license_plate,
      b.plateNumber,
      b.plate_number,
      b.carNumber,
    ];
    for (const v of candidates) {
      if (v && typeof v === "string" && !v.startsWith("http") && !v.startsWith("/")) {
        return v;
      }
    }
    return "N/A";
  };

  const extractParkingVehicleNumber = (b: any): string => {
    if (
      b.vehicleNumber &&
      typeof b.vehicleNumber === "string" &&
      b.vehicleNumber.trim() !== "" &&
      !b.vehicleNumber.startsWith("http") &&
      !b.vehicleNumber.startsWith("/")
    ) {
      return b.vehicleNumber;
    }
    const fromCustomer = b.customer?.carLicensePlateImage;
    if (
      fromCustomer &&
      typeof fromCustomer === "string" &&
      fromCustomer.trim() !== "" &&
      !fromCustomer.startsWith("http") &&
      !fromCustomer.startsWith("/")
    ) {
      return fromCustomer;
    }
    return "N/A";
  };

  const resolveBookingDate = (b: any): string => {
    return (
      b.createdAt ||
      b.paymentDetails?.paidAt ||
      b.bookingPeriod?.from ||
      new Date().toISOString()
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Fetch functions — all include Authorization header ✅
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchParkingBookings = async (): Promise<BookingItem[]> => {
    const response = await axiosInstance.get("/merchants/parkinglot/booking", {
      params: { page: 1, limit: 100 },
      headers: { Authorization: token }, // ✅
    });
    if (!response.data.success) return [];
    return (response.data.data?.bookings || []).map((b: any) => ({
      _id: b._id,
      bookingId: b._id,
      orderNumber: `PARK-${String(b._id).slice(-6).toUpperCase()}`,
      status: (b.paymentDetails?.status || b.status || "PENDING") as BookingStatus,
      createdAt: resolveBookingDate(b),
      vehicleNumber: extractParkingVehicleNumber(b),
      totalAmount: b.paymentDetails?.totalAmount || b.paymentDetails?.amountPaid || 0,
      bookingPeriod: b.bookingPeriod
        ? { from: b.bookingPeriod.from, to: b.bookingPeriod.to }
        : undefined,
      placeInfo: {
        name: b.parking?.name || "Parking Lot",
        address: b.parking?.address || "N/A",
        phoneNo: b.parking?.contactNumber || "N/A",
      },
      slot: b.bookedSlot || undefined,
      type: "parking" as BookingType,
      paymentMethod: b.paymentDetails?.method || "N/A",   // ✅ maps "method"
      paymentStatus: b.paymentDetails?.status || "N/A",   // ✅ maps "status"
      user: b.customer
        ? {
            firstName: b.customer.name?.split(" ")[0] || "",
            lastName: b.customer.name?.split(" ").slice(1).join(" ") || "",
            phone: b.customer.phone || "",
            email: b.customer.email || "",
          }
        : undefined,
    }));
  };

  const fetchGarageBookings = async (): Promise<BookingItem[]> => {
    const response = await axiosInstance.get("/merchants/garage/booking", {
      params: { page: 1, limit: 100 },
      headers: { Authorization: token }, // ✅
    });
    if (!response.data.success) return [];
    return (response.data.data?.bookings || []).map((b: any) => ({
      _id: b._id,
      bookingId: b._id,
      orderNumber: `GAR-${String(b._id).slice(-6).toUpperCase()}`,
      status: (b.paymentDetails?.status || b.status || "PENDING") as BookingStatus,
      createdAt: resolveBookingDate(b),
      vehicleNumber: extractVehicleNumber(b),
      totalAmount: b.paymentDetails?.totalAmount || b.paymentDetails?.amountPaid || 0,
      bookingPeriod: b.bookingPeriod
        ? { from: b.bookingPeriod.from, to: b.bookingPeriod.to }
        : undefined,
      placeInfo: {
        name: b.garage?.name || "Garage",
        address: b.garage?.address || "N/A",
        phoneNo: b.garage?.contactNumber || "N/A",
      },
      slot: b.bookedSlot || undefined,
      type: "garage" as BookingType,
      paymentMethod: b.paymentDetails?.method || "N/A",   // ✅
      paymentStatus: b.paymentDetails?.status || "N/A",   // ✅
      user: b.customer
        ? {
            firstName: b.customer.name?.split(" ")[0] || "",
            lastName: b.customer.name?.split(" ").slice(1).join(" ") || "",
            phone: b.customer.phone || "",
            email: b.customer.email || "",
          }
        : undefined,
    }));
  };

  const fetchResidenceBookings = async (): Promise<BookingItem[]> => {
    const response = await axiosInstance.get("/merchants/residence/booking", {
      params: { page: 1, limit: 100 },
      headers: { Authorization: token }, // ✅
    });
    if (!response.data.success) return [];
    const bookings = response.data.data?.bookings || response.data.data || [];
    return bookings.map((b: any) => ({
      _id: b._id,
      bookingId: b._id,
      orderNumber: `RES-${String(b._id).slice(-6).toUpperCase()}`,
      status: (b.paymentDetails?.status || b.status || "PENDING") as BookingStatus,
      createdAt: resolveBookingDate(b),
      vehicleNumber: extractVehicleNumber(b),
      totalAmount: b.paymentDetails?.totalAmount || b.paymentDetails?.amountPaid || 0,
      bookingPeriod: b.bookingPeriod
        ? { from: b.bookingPeriod.from, to: b.bookingPeriod.to }
        : undefined,
      placeInfo: {
        name: b.residence?.name || "Residence",
        address: b.residence?.address || "N/A",
        phoneNo: b.residence?.contactNumber || "N/A",
      },
      slot: undefined,
      type: "residence" as BookingType,
      paymentMethod: b.paymentDetails?.method || "N/A",   // ✅
      paymentStatus: b.paymentDetails?.status || "N/A",   // ✅
      user: b.customer
        ? {
            firstName: b.customer.name?.split(" ")[0] || "",
            lastName: b.customer.name?.split(" ").slice(1).join(" ") || "",
            phone: b.customer.phone || "",
            email: b.customer.email || "",
          }
        : undefined,
    }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Filtering
  // ─────────────────────────────────────────────────────────────────────────────

  const filterBookings = () => {
    let filtered = allBookings;

    // Always hide FAILED and COMPLETED
    filtered = filtered.filter(
      (b) => !HIDDEN_STATUSES.has(b.status?.toUpperCase())
    );

    if (activeFilter !== "all") {
      filtered = filtered.filter((b) => b.type === activeFilter);
    }

    if (activeStatusFilter !== "all") {
      filtered = filtered.filter(
        (b) => b.status?.toUpperCase() === activeStatusFilter.toUpperCase()
      );
    }

    setFilteredBookings(filtered);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Display helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
      case "CONFIRMED":
      case "ACTIVE":
        return "#4CAF50";
      case "PENDING":
        return "#FFA500";
      case "IN_PROGRESS":
        return "#2196F3";
      case "COMPLETED":
        return "#666666";
      case "FAILED":
      case "CANCELLED":
        return "#FF0000";
      default:
        return colors.gray;
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      SUCCESS: "Success",
      PENDING: "Pending",
      CONFIRMED: "Confirmed",
      ACTIVE: "Active",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    };
    return map[status?.toUpperCase()] || status;
  };

  const getTypeIcon = (type: BookingType): any => {
    const map = { parking: "car-sport", garage: "construct", residence: "home" };
    return map[type] || "car";
  };

  const getTypeColor = (type: BookingType) => {
    const map = { parking: "#2196F3", garage: "#FF9800", residence: "#4CAF50" };
    return map[type] || colors.gray;
  };

  const getTypeText = (type: BookingType) => {
    const map = { parking: "Parking", garage: "Garage", residence: "Residence" };
    return map[type] || type;
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const formatTime = (d: string) => {
    try {
      return new Date(d).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const formatBookingPeriod = (bp?: { from: string; to: string }) => {
    if (!bp?.from || !bp?.to) return "N/A";
    try {
      const from = new Date(bp.from).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const to = new Date(bp.to).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${from} → ${to}`;
    } catch {
      return "N/A";
    }
  };

  const calculateDuration = (from: string, to: string) => {
    try {
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    } catch {
      return "N/A";
    }
  };

  // ✅ Cash pending badge helper
  const isCashPending = (booking: BookingItem): boolean => {
    return (
      booking.paymentMethod?.toUpperCase() === "CASH" &&
      booking.paymentStatus?.toUpperCase() === "PENDING"
    );
  };

  const handleBookingPress = (booking: BookingItem) => {
    router.push({
      pathname: "/parkingMerchent/BookingDetailScreen",
      params: {
        bookingId: booking.bookingId,
        bookingType: booking.type,
        bookingData: JSON.stringify(booking),
      },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parking Bookings</Text>
        <TouchableOpacity
          style={[styles.filterButton, filterApplied && styles.filterButtonActive]}
          onPress={() => setFilterApplied(!filterApplied)}
        >
          <Ionicons name="filter" size={20} color="#FFF" />
          <Text style={styles.filterText}>FILTERS</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {filterApplied && (
        <View style={styles.filterOptions}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
          >
            {(["all", "parking", "garage", "residence"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(f)}
              >
                {f !== "all" && (
                  <Ionicons
                    name={getTypeIcon(f as BookingType)}
                    size={14}
                    color={activeFilter === f ? "#FFF" : getTypeColor(f as BookingType)}
                  />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === f && styles.filterChipTextActive,
                  ]}
                >
                  {f === "all" ? "All Types" : getTypeText(f as BookingType)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(["all", "SUCCESS", "PENDING", "CANCELLED"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChip,
                  activeStatusFilter === s && styles.filterChipActive,
                ]}
                onPress={() => setActiveStatusFilter(s)}
              >
                {s !== "all" && (
                  <View
                    style={[styles.statusDot, { backgroundColor: getStatusColor(s) }]}
                  />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    activeStatusFilter === s && styles.filterChipTextActive,
                  ]}
                >
                  {s === "all" ? "All Status" : getStatusText(s)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAllBookings();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.countText}>
          {filteredBookings.length}{" "}
          {filteredBookings.length === 1 ? "booking" : "bookings"} found
        </Text>

        {filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={72} color={colors.gray} />
            <Text style={styles.emptyText}>No bookings found</Text>
            <Text style={styles.emptySubText}>
              {activeFilter === "all"
                ? "No active bookings at the moment"
                : `No ${activeFilter} bookings found`}
            </Text>
          </View>
        ) : (
          filteredBookings.map((booking) => (
            <TouchableOpacity
              key={`${booking.type}-${booking._id}`}
              style={[
                styles.card,
                // ✅ Highlight cash-pending cards with an orange left border
                isCashPending(booking) && styles.cardCashPending,
              ]}
              onPress={() => handleBookingPress(booking)}
              activeOpacity={0.7}
            >
              {/* Card header */}
              <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                  <Ionicons
                    name={getTypeIcon(booking.type)}
                    size={14}
                    color={getTypeColor(booking.type)}
                  />
                  <Text style={[styles.typeText, { color: getTypeColor(booking.type) }]}>
                    {getTypeText(booking.type)}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  {/* ✅ Show "Awaiting Cash" badge instead of status dot for pending cash */}
                  {isCashPending(booking) ? (
                    <View style={styles.cashPendingBadge}>
                      <Ionicons name="cash-outline" size={12} color="#795548" />
                      <Text style={styles.cashPendingBadgeText}>Awaiting Cash</Text>
                    </View>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(booking.status) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(booking.status) },
                        ]}
                      >
                        {getStatusText(booking.status)}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {/* Order number + place */}
              <Text style={styles.orderNumber}>{booking.orderNumber}</Text>
              <Text style={styles.placeName}>{booking.placeInfo?.name || "N/A"}</Text>

              {/* Details */}
              <View style={styles.detailsBlock}>
                <DetailRow icon="calendar-outline" text={formatDate(booking.createdAt)} />
                <DetailRow icon="time-outline" text={formatTime(booking.createdAt)} />
                <DetailRow icon="car-outline" text={booking.vehicleNumber || "N/A"} />
                {booking.bookingPeriod && (
                  <DetailRow
                    icon="time"
                    text={`${formatBookingPeriod(booking.bookingPeriod)} (${calculateDuration(
                      booking.bookingPeriod.from,
                      booking.bookingPeriod.to
                    )})`}
                  />
                )}
                <DetailRow icon="cash-outline" text={`$${booking.totalAmount.toFixed(2)}`} />
              </View>

              {/* Customer */}
              {booking.user && (
                <View style={styles.customerRow}>
                  <Ionicons name="person-outline" size={15} color={colors.gray} />
                  <Text style={styles.customerText}>
                    {booking.user.firstName} {booking.user.lastName}
                  </Text>
                </View>
              )}

              {/* Footer */}
              <View style={styles.cardFooter}>
                <Text style={styles.viewDetails}>
                  {isCashPending(booking) ? "Confirm Cash →" : "View Details"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.gray} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const DetailRow = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.detailRow}>
    <Ionicons name={icon} size={15} color={colors.gray} />
    <Text style={styles.detailText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 15, color: colors.gray },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    elevation: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    flex: 1,
    textAlign: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterButtonActive: { backgroundColor: "#1565C0" },
  filterText: { color: "#FFF", fontSize: 13, fontWeight: "600", marginLeft: 4 },
  filterOptions: {
    backgroundColor: "#FFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.gray, marginLeft: 4 },
  filterChipTextActive: { color: "#FFF", fontWeight: "600" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 30 },
  countText: { fontSize: 13, color: colors.gray, marginBottom: 10 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 13,
    color: colors.gray,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  // ✅ Orange left border for cash-pending cards
  cardCashPending: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF8C00",
    borderColor: "#FFE0B2",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: { fontSize: 12, fontWeight: "600", marginLeft: 4 },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusText: { fontSize: 13, fontWeight: "600" },
  orderNumber: { fontSize: 15, fontWeight: "bold", color: "#000", marginBottom: 2 },
  placeName: { fontSize: 13, color: colors.gray, marginBottom: 10 },
  detailsBlock: { marginBottom: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  detailText: { fontSize: 13, color: colors.gray, marginLeft: 8, flex: 1 },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    marginBottom: 8,
  },
  customerText: { fontSize: 13, color: "#000", fontWeight: "500", marginLeft: 6 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  viewDetails: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  // ✅ Cash pending badge styles
  cashPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFEBE9",
    borderWidth: 1,
    borderColor: "#A1887F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  cashPendingBadgeText: { fontSize: 11, fontWeight: "600", color: "#5D4037" },
});

export default MerchantParkingOrderHistory;