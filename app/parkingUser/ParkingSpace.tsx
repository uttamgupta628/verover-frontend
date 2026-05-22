import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import axiosInstance from "../../api/axios";
import colors from "../../assets/color";
import {
  generatSpaceID,
  getSpacDetailsFromID,
} from "../../utils/slotIdConverter";

const { width, height } = Dimensions.get("window");

const responsiveWidth    = (p: number) => (width  * p) / 100;
const responsiveHeight   = (p: number) => (height * p) / 100;
const responsiveFontSize = (p: number) => {
  const base = width > 400 ? 16 : 14;
  return (base * p) / 2;
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ParkingSpotItem = { id: string; isOccupied: boolean };
type ParkingSection  = { availableSpots: number; spots: ParkingSpotItem[]; price: number };
type ParkingDataType = { [key: string]: ParkingSection };

type FetchParkingDataType = {
  status: string; message: string; success: boolean;
  data: {
    availableSpace: number;
    bookedSlot: { rentedSlot: string; rentFrom: string; rentTo: string }[];
    isOpen?: boolean;
  };
};

interface DailySlotMeta {
  id: string;
  label: string;
  fromTime: string;
  toTime: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

const generateAvailableSoltList = (
  data: FetchParkingDataType["data"],
  spaceList: { [key: string]: { count: number; price: number } }
): { parkingData: ParkingDataType; availableSlots: string[] } => {
  const res: ParkingDataType = {};
  const availableSlots: string[] = [];
  const occupiedSlots = new Map<string, number[]>();
  const now = new Date();

  data.bookedSlot.forEach((slot) => {
    if (slot.rentTo && new Date(slot.rentTo) < now) return;
    const details = getSpacDetailsFromID(slot.rentedSlot);
    if (!details) return;
    const { zone, slot: slotNumber } = details;
    occupiedSlots.has(zone)
      ? occupiedSlots.get(zone)!.push(slotNumber)
      : occupiedSlots.set(zone, [slotNumber]);
  });

  occupiedSlots.forEach((v, k) => occupiedSlots.set(k, v.sort((a, b) => a - b)));

  Object.keys(spaceList).forEach((key) => {
    const occupiedList = occupiedSlots.get(key) || [];
    const spots: ParkingSpotItem[] = [];
    for (let i = 1, j = 0; i <= spaceList[key].count; i++) {
      if (j < occupiedList.length && occupiedList[j] === i) {
        j++;
        spots.push({ id: generatSpaceID(key, i), isOccupied: true });
      } else {
        spots.push({ id: generatSpaceID(key, i), isOccupied: false });
        availableSlots.push(generatSpaceID(key, i));
      }
    }
    res[key] = {
      availableSpots: spaceList[key].count - occupiedList.length,
      spots,
      price: spaceList[key].price,
    };
  });

  return { parkingData: res, availableSlots };
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ParkingSpace = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading,        setLoading]        = useState(false);
  const [availableSpots, setAvailableSpots] = useState<string[]>([]);
  const [parkingData,    setParkingData]    = useState<ParkingDataType>({});
  const [selectedSpot,   setSelectedSpot]   = useState<string | null>(null);

  // ── Parse all params ───────────────────────────────────────────────────────
  const parsedParams = React.useMemo(() => {
    // daily
    const isDaily = params.isDaily === "true";

    let dailySlotsMeta: DailySlotMeta[] = [];
    try {
      const raw = Array.isArray(params.dailySlotsMeta)
        ? params.dailySlotsMeta[0]
        : params.dailySlotsMeta as string | undefined;
      if (raw) dailySlotsMeta = JSON.parse(raw);
    } catch {}

    const dailyDate      = (Array.isArray(params.dailyDate)      ? params.dailyDate[0]      : params.dailyDate)      as string | undefined;
    const selectedSlotIds = (Array.isArray(params.selectedSlotIds) ? params.selectedSlotIds[0] : params.selectedSlotIds) as string | undefined;
    const dailySlotsMetaRaw = (Array.isArray(params.dailySlotsMeta) ? params.dailySlotsMeta[0] : params.dailySlotsMeta) as string | undefined;

    return {
      type:    params.type    as string,
      lot:     params.lot     ? JSON.parse(params.lot as string) : null,
      endTime: params.endTime as string,
      // monthly
      isMonthly: params.isMonthly === "true",
      months:    parseInt((params.months as string) || "1", 10),
      // daily
      isDaily,
      dailyDate,
      selectedSlotIds,
      dailySlotsMeta,
      dailySlotsMetaRaw,
    };
  }, [params]);

  // ── Fetch availability ─────────────────────────────────────────────────────
  const fetchAvailability = useCallback(async () => {
    if (!parsedParams.lot || !parsedParams.endTime) return;
    try {
      setLoading(true);
      const endpoint =
        parsedParams.type === "L"
          ? "/merchants/parkinglot/getavailable"
          : "/merchants/garage/getavailable";

      const queryParams =
        parsedParams.type === "L"
          ? { lotId: parsedParams.lot._id, startDate: new Date().toISOString(), lastDate: parsedParams.endTime }
          : { garageId: parsedParams.lot._id, startDate: new Date().toISOString(), endDate: parsedParams.endTime };

      const res = await axiosInstance.get<FetchParkingDataType>(endpoint, { params: queryParams });
      const { parkingData: pd, availableSlots } = generateAvailableSoltList(res.data.data, parsedParams.lot.spacesList);

      setParkingData(pd);
      setAvailableSpots(availableSlots);
      setSelectedSpot((prev) => {
        if (prev && !availableSlots.includes(prev)) {
          Alert.alert("Spot No Longer Available", "The spot you selected was just booked. Please choose another.");
          return null;
        }
        return prev;
      });
    } catch (err) {
      if (err instanceof AxiosError) console.log("Fetch error:", err.response?.data?.message || err.message);
      else console.log("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [parsedParams.type, parsedParams.lot?._id, parsedParams.endTime]);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!parsedParams.lot || !parsedParams.endTime) {
      Alert.alert("Error", "Lot Not Selected", [{ text: "OK", onPress: () => router.back() }]);
      return;
    }
    fetchAvailability();
  }, [fetchAvailability]);

  // ── Re-fetch on focus ──────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => { fetchAvailability(); }, [fetchAvailability]));

  // ── Checkout ───────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (!selectedSpot) {
      Alert.alert("No Slot Selected", "Please select a slot.");
      return;
    }

    // Re-validate spot is still free
    try {
      setLoading(true);
      const endpoint =
        parsedParams.type === "L"
          ? "/merchants/parkinglot/getavailable"
          : "/merchants/garage/getavailable";
      const queryParams =
        parsedParams.type === "L"
          ? { lotId: parsedParams.lot._id, startDate: new Date().toISOString(), lastDate: parsedParams.endTime }
          : { garageId: parsedParams.lot._id, startDate: new Date().toISOString(), endDate: parsedParams.endTime };

      const res = await axiosInstance.get<FetchParkingDataType>(endpoint, { params: queryParams });
      const { parkingData: pd, availableSlots } = generateAvailableSoltList(res.data.data, parsedParams.lot.spacesList);

      if (!availableSlots.includes(selectedSpot)) {
        setParkingData(pd);
        setAvailableSpots(availableSlots);
        setSelectedSpot(null);
        Alert.alert("Spot No Longer Available", "This spot was just booked. Please select a different one.");
        return;
      }
    } catch {
      // Network hiccup — backend is the final guard, allow proceeding
      console.log("Pre-checkout availability check failed — proceeding anyway");
    } finally {
      setLoading(false);
    }

    // ── Navigate to Confirmation, forwarding ALL params including daily ──────
    router.push({
      pathname: "/parkingUser/Confirmation",
      params: {
        // Base params (lot, type, endTime come from parsedParams)
        ...params,
        selectedSpot,
        // Explicitly forward daily params (in case spread misses them)
        isDaily:         String(parsedParams.isDaily),
        dailyDate:       parsedParams.dailyDate       ?? "",
        selectedSlotIds: parsedParams.selectedSlotIds ?? "",
        dailySlotsMeta:  parsedParams.dailySlotsMetaRaw ?? "",
      },
    });
  }, [selectedSpot, parsedParams, params, router]);

  // ── Spot selection ─────────────────────────────────────────────────────────
  const handleSpotSelection = (spot: string, isOccupied: boolean) => {
    if (!isOccupied) setSelectedSpot(spot === selectedSpot ? null : spot);
  };

  // ── Full-screen loader on initial load ────────────────────────────────────
  if (loading && Object.keys(parkingData).length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
        <Text style={styles.loadingText}>Loading available spots...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={30} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Parking Spaces</Text>
        <TouchableOpacity onPress={fetchAvailability} disabled={loading}>
          <MaterialCommunityIcons name="refresh" size={24} color={loading ? "#CCC" : colors.brandColor} />
        </TouchableOpacity>
      </View>

      {/* ── Daily Mode Banner ──────────────────────────────────────────────── */}
      {parsedParams.isDaily && parsedParams.dailySlotsMeta.length > 0 && (
        <View style={styles.dailyBanner}>
          {/* Title row */}
          <View style={styles.dailyBannerTitleRow}>
            <Text style={styles.dailyBannerIcon}>📆</Text>
            <Text style={styles.dailyBannerTitle}>Daily Booking</Text>
            {parsedParams.dailyDate ? (
              <View style={styles.dailyBannerDatePill}>
                <Text style={styles.dailyBannerDateText}>
                  {new Date(parsedParams.dailyDate).toLocaleDateString(undefined, {
                    weekday: "short", day: "numeric", month: "short",
                  })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Slot chips */}
          <View style={styles.dailySlotChips}>
            {parsedParams.dailySlotsMeta.map((slot) => {
              const emoji =
                slot.id === "morning"   ? "🌅" :
                slot.id === "afternoon" ? "☀️" :
                slot.id === "evening"   ? "🌆" : "🌙";
              const endLabel = slot.toTime === "00:00" ? "Midnight" : slot.toTime;
              return (
                <View key={slot.id} style={styles.dailySlotChip}>
                  <Text style={styles.dailySlotChipEmoji}>{emoji}</Text>
                  <View>
                    <Text style={styles.dailySlotChipLabel}>{slot.label}</Text>
                    <Text style={styles.dailySlotChipTime}>{slot.fromTime} – {endLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.dailyBannerNote}>
            ⏱ Pricing is time-based — exact fare shown at checkout
          </Text>
        </View>
      )}

      {/* ── Monthly Banner ─────────────────────────────────────────────────── */}
      {parsedParams.isMonthly && (
        <View style={styles.monthlyBanner}>
          <Text style={styles.monthlyBannerText}>
            📅 Monthly Booking · {parsedParams.months}{" "}
            {parsedParams.months === 1 ? "month" : "months"}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F5F5F5", borderColor: "#CCC", borderWidth: 1 }]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.brandColor }]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#FDECEA", borderColor: "#C0392B", borderWidth: 1.5 }]} />
          <Text style={styles.legendText}>Booked</Text>
        </View>
      </View>

      {/* Parking Sections */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.keys(parkingData).map((section) => (
          <View key={section}>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionLetter}>{section}</Text>
              </View>
              <View style={styles.sectionHeaderRight}>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="car-multiple" size={18} color={colors.brandColor} />
                  <Text style={styles.infoLabel}>Available:</Text>
                  <Text style={styles.infoValue}>{parkingData[section].availableSpots}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="currency-inr" size={18} color={colors.brandColor} />
                  <Text style={styles.infoLabel}>Price:</Text>
                  <Text style={styles.infoValue}>
                    {parsedParams.isDaily
                      ? "Time-based"
                      : `₹${parkingData[section].price}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Spots grid */}
            {parkingData[section].spots.map((spot) => (
              <TouchableOpacity
                key={spot.id}
                style={[
                  styles.parkingSpot,
                  selectedSpot === spot.id && !spot.isOccupied && styles.selectedSpot,
                  spot.isOccupied && styles.occupiedSpot,
                ]}
                onPress={() => handleSpotSelection(spot.id, spot.isOccupied)}
                disabled={spot.isOccupied}
                activeOpacity={0.7}
              >
                {spot.isOccupied ? (
                  <>
                    <MaterialCommunityIcons name="lock"         size={28} color="#C0392B" />
                    <Text style={styles.bookedLabel}>Booked</Text>
                    <Text style={styles.bookedSpotId}>{spot.id}</Text>
                  </>
                ) : selectedSpot === spot.id ? (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={30} color="#FFF" />
                    <Text style={styles.selectedText}>Selected</Text>
                    <Text style={styles.selectedSpotId}>{spot.id}</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="car-outline"  size={30} color={colors.gray} />
                    <Text style={styles.spotText}>{spot.id}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}

          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.checkoutButton, (!selectedSpot || loading) && styles.disabledButton]}
          disabled={!selectedSpot || loading}
          onPress={handleCheckout}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.checkoutButtonText}>
              {parsedParams.isDaily ? "Continue to Checkout ⏱" : "Go To Checkout"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.replace("/userHome")}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: responsiveWidth(5),
  },
  loadingContainer: {
    flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF",
  },
  loadingText: {
    marginTop: 12, fontSize: responsiveFontSize(1.8), color: colors.brandColor, fontWeight: "500",
  },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: Platform.OS === "ios" ? responsiveHeight(7) : responsiveHeight(5),
    marginBottom: responsiveHeight(1),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5), color: colors.brandColor,
    fontWeight: "600", flex: 1, marginLeft: responsiveWidth(3),
  },

  // ── Daily Banner ────────────────────────────────────────────────────────
  dailyBanner: {
    backgroundColor: "#EEF4FF",
    borderRadius: 14,
    padding: responsiveWidth(3.5),
    marginBottom: responsiveHeight(1.2),
    borderWidth: 1.5,
    borderColor: colors.brandColor + "44",
  },
  dailyBannerTitleRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, marginBottom: responsiveHeight(1),
  },
  dailyBannerIcon:  { fontSize: responsiveFontSize(2.2) },
  dailyBannerTitle: {
    fontSize: responsiveFontSize(2), fontWeight: "700",
    color: colors.brandColor, flex: 1,
  },
  dailyBannerDatePill: {
    backgroundColor: colors.brandColor + "18",
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.brandColor + "33",
  },
  dailyBannerDateText: {
    fontSize: responsiveFontSize(1.5), fontWeight: "600", color: colors.brandColor,
  },
  dailySlotChips: {
    flexDirection: "row", flexWrap: "wrap",
    gap: responsiveWidth(2), marginBottom: responsiveHeight(0.8),
  },
  dailySlotChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF",
    borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: colors.brandColor + "33",
  },
  dailySlotChipEmoji: { fontSize: responsiveFontSize(1.8) },
  dailySlotChipLabel: {
    fontSize: responsiveFontSize(1.6), fontWeight: "700", color: "#333",
  },
  dailySlotChipTime: {
    fontSize: responsiveFontSize(1.3), color: "#888", marginTop: 1,
  },
  dailyBannerNote: {
    fontSize: responsiveFontSize(1.4),
    color: colors.brandColor + "BB",
    fontStyle: "italic",
  },

  // ── Monthly Banner ──────────────────────────────────────────────────────
  monthlyBanner: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: responsiveHeight(1),
  },
  monthlyBannerText: { color: "#FFF", fontSize: responsiveFontSize(1.7), fontWeight: "600" },

  // ── Legend ──────────────────────────────────────────────────────────────
  legend: {
    flexDirection: "row", justifyContent: "center", gap: 20,
    paddingVertical: responsiveHeight(1.2),
    marginBottom: responsiveHeight(0.5),
    backgroundColor: "#FAFAFA", borderRadius: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:  { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: responsiveFontSize(1.5), color: colors.gray, fontWeight: "500" },

  // ── Section header ───────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: responsiveHeight(3), marginBottom: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(2), paddingVertical: responsiveHeight(1.5),
    backgroundColor: "#F8F9FA", borderRadius: 12,
    borderLeftWidth: 4, borderLeftColor: colors.brandColor,
  },
  sectionHeaderLeft:  { flexDirection: "row", alignItems: "center" },
  sectionHeaderRight: { flexDirection: "column", gap: 6 },
  sectionLetter: {
    fontSize: responsiveFontSize(3.2), fontWeight: "bold", color: colors.brandColor,
  },
  infoRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { fontSize: responsiveFontSize(1.6), color: colors.gray, fontWeight: "500" },
  infoValue: { fontSize: responsiveFontSize(1.8), color: colors.black, fontWeight: "700" },

  // ── Parking spots ────────────────────────────────────────────────────────
  parkingSpot: {
    backgroundColor: "#F5F5F5",
    margin: responsiveWidth(2),
    padding: responsiveWidth(5),
    borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    minHeight: responsiveHeight(12),
    borderWidth: 2, borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  selectedSpot: {
    backgroundColor: colors.brandColor, borderColor: colors.brandColor,
    shadowColor: colors.brandColor, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  occupiedSpot: { backgroundColor: "#FDECEA", borderColor: "#C0392B", borderWidth: 2 },

  spotText:      { fontSize: responsiveFontSize(2),   color: colors.black,  fontWeight: "500", marginTop: 4 },
  selectedText:  { fontSize: responsiveFontSize(2.2), color: "#FFF",         fontWeight: "bold",  marginTop: 8 },
  selectedSpotId:{ fontSize: responsiveFontSize(1.6), color: "#FFF",         opacity: 0.9,        marginTop: 4 },
  bookedLabel:   { fontSize: responsiveFontSize(1.8), color: "#C0392B",      fontWeight: "700",   marginTop: 6 },
  bookedSpotId:  { fontSize: responsiveFontSize(1.4), color: "#C0392B",      opacity: 0.8,        marginTop: 2 },

  // ── Bottom buttons ───────────────────────────────────────────────────────
  bottomContainer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(2),
    backgroundColor: "#FFF",
    borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  checkoutButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    flex: 1, marginRight: responsiveWidth(2),
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 5,
  },
  disabledButton:     { backgroundColor: "#CCCCCC", opacity: 0.6 },
  checkoutButtonText: { color: "#FFF", fontSize: responsiveFontSize(2), fontWeight: "bold" },

  cancelButton: {
    backgroundColor: "#5E5E5E",
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    flex: 1, marginLeft: responsiveWidth(2),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  cancelButtonText: { color: "#FFF", fontSize: responsiveFontSize(2), fontWeight: "bold" },
});

export default ParkingSpace;