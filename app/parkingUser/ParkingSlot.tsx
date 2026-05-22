/**
 * ParkingSlot.tsx
 *
 * Booking type toggle:  ⏱ Hourly  |  📆 Daily  |  📅 Monthly
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import colors from "../../assets/color";
import { images } from "../../assets/images/images";
import MapView, { Marker } from "react-native-maps";

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

type BookingMode = "hourly" | "daily" | "monthly";

/**
 * These slots are for UI display / user intent only.
 * They do NOT drive pricing — the merchant's actual configured
 * slot times (fetched in useDailyRate) drive pricing.
 * endTime for daily bookings is always set to midnight of the chosen date.
 */
const TIME_SLOTS = [
  {
    id: "morning",
    label: "Morning",
    icon: "🌅",
    fromTime: "06:00",
    toTime: "12:00",
    fromHour: 6,
    toHour: 12,
    color: { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  },
  {
    id: "afternoon",
    label: "Afternoon",
    icon: "☀️",
    fromTime: "12:00",
    toTime: "18:00",
    fromHour: 12,
    toHour: 18,
    color: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  },
  {
    id: "evening",
    label: "Evening",
    icon: "🌆",
    fromTime: "18:00",
    toTime: "21:00",
    fromHour: 18,
    toHour: 21,
    color: { bg: "#EEF4FF", border: "#BFD4FF", text: "#2563EB" },
  },
  {
    id: "night",
    label: "Night",
    icon: "🌙",
    fromTime: "21:00",
    toTime: "00:00",
    fromHour: 21,
    toHour: 24,
    color: { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
  },
] as const;

type SlotId = (typeof TIME_SLOTS)[number]["id"];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0 && m === 0) return "Midnight";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * For DISPLAY only in the summary card.
 * Shows the earliest start hour of selected slots.
 */
function computeDisplayStart(date: Date, selectedIds: Set<SlotId>): Date | null {
  const selected = TIME_SLOTS.filter((s) => selectedIds.has(s.id));
  if (!selected.length) return null;
  const first = [...selected].sort((a, b) => a.fromHour - b.fromHour)[0];
  const d = new Date(date);
  d.setHours(first.fromHour, 0, 0, 0);
  return d;
}

/**
 * For DISPLAY only in the summary card.
 * Shows the latest end hour of selected slots.
 */
function computeDisplayEnd(date: Date, selectedIds: Set<SlotId>): Date | null {
  const selected = TIME_SLOTS.filter((s) => selectedIds.has(s.id));
  if (!selected.length) return null;
  const last = [...selected].sort((a, b) => a.fromHour - b.fromHour).at(-1)!;
  const d = new Date(date);
  if (last.toHour === 24) {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setHours(last.toHour, 0, 0, 0);
  }
  return d;
}

/**
 * Computes the actual startTime to pass to Confirmation:
 * - Start of the chosen day (midnight) so the pricing engine
 *   evaluates all merchant slots correctly from the beginning of the day.
 * - If the chosen day is today and it's already past midnight,
 *   start from NOW so we don't book into the past.
 */
function computeActualStartTime(date: Date): Date {
  const now = new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  // If the chosen day is today, start from now
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (dayStart.getTime() === todayStart.getTime()) {
    // Today — start from current time
    return now;
  }
  // Future day — start from midnight of that day
  return dayStart;
}

/**
 * Computes the actual endTime to pass to Confirmation:
 * Always midnight of the chosen day (or next day if Night slot selected).
 * This ensures the pricing engine sees the full day and charges
 * exactly the merchant's configured slots that fall within the window.
 */
function computeActualEndTime(date: Date, selectedIds: Set<SlotId>): Date {
  const selected = TIME_SLOTS.filter((s) => selectedIds.has(s.id));
  const hasNight = selected.some((s) => s.id === "night");

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (hasNight) {
    // Night ends at midnight → next day
    d.setDate(d.getDate() + 1);
  } else {
    // Use the end hour of the last selected slot
    const last = [...selected].sort((a, b) => a.fromHour - b.fromHour).at(-1);
    if (last) {
      d.setHours(last.toHour, 0, 0, 0);
    } else {
      // Fallback: end of day
      d.setDate(d.getDate() + 1);
    }
  }

  // Safety: if computed end is in the past, roll to next day
  const now = new Date();
  if (d <= now) {
    d.setDate(d.getDate() + 1);
  }

  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ParkingSlot = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const scale         = (s: number) => (screenWidth  / 375) * s;
  const verticalScale = (s: number) => (screenHeight / 812) * s;
  const moderateScale = (s: number, f = 0.5) => s + (scale(s) - s) * f;

  // ── Location ───────────────────────────────────────────────────────────────
  const parseLocation = (): LocationData | null => {
    try {
      if (params.location) {
        const raw = Array.isArray(params.location) ? params.location[0] : params.location;
        return JSON.parse(raw);
      }
      if (params.latitude && params.longitude) {
        return {
          latitude:  parseFloat(Array.isArray(params.latitude)  ? params.latitude[0]  : params.latitude  as string),
          longitude: parseFloat(Array.isArray(params.longitude) ? params.longitude[0] : params.longitude as string),
          address:   params.address
            ? (Array.isArray(params.address) ? params.address[0] : params.address as string)
            : "Selected Location",
        };
      }
      return null;
    } catch { return null; }
  };

  const [location] = useState<LocationData | null>(() => parseLocation());

  // ── Mode ───────────────────────────────────────────────────────────────────
  const [bookingMode, setBookingMode] = useState<BookingMode>("hourly");

  // ── Hourly — completely unchanged ──────────────────────────────────────────
  const [selectedDate, setSelectedDate]     = useState<Date | null>(null);
  const [selectedTime, setSelectedTime]     = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration]             = useState({ days: 0, hours: 0, minutes: 0 });
  const [dateTimeText, setDateTimeText]     = useState("");

  // ── Monthly — completely unchanged ─────────────────────────────────────────
  const [selectedMonths, setSelectedMonths] = useState(1);

  // ── Daily ──────────────────────────────────────────────────────────────────
  const [dailyDate, setDailyDate]                     = useState<Date | null>(null);
  const [showDailyDatePicker, setShowDailyDatePicker] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds]         = useState<Set<SlotId>>(new Set());

  // ── Guard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!location) {
      Alert.alert("No location selected", "Please select a location first", [
        { text: "Cancel", style: "cancel", onPress: () => router.replace("/userHome") },
        { text: "OK",     onPress: () => router.back() },
      ]);
    }
  }, [location]);

  // ── Hourly: duration calc — completely unchanged ───────────────────────────
  const getHourlyEnd = useCallback(() => {
    if (selectedDate && selectedTime) {
      const d = new Date(selectedDate);
      d.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      return d;
    }
    return new Date();
  }, [selectedDate, selectedTime]);

  useEffect(() => {
    if (!selectedDate || !selectedTime || bookingMode !== "hourly") return;
    const now = new Date();
    const sel = getHourlyEnd();
    if (sel > now) {
      const ms = sel.getTime() - now.getTime();
      setDuration({
        days:    Math.floor(ms / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
      });
      setDateTimeText(
        `${sel.toLocaleDateString()}  ${sel.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      );
    }
  }, [selectedDate, selectedTime, bookingMode]);

  // ── Monthly: end date label — completely unchanged ─────────────────────────
  const monthlyEndLabel = useMemo(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + selectedMonths);
    return end.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }, [selectedMonths]);

  const getMonthlyEnd = () => {
    const end = new Date();
    end.setMonth(end.getMonth() + selectedMonths);
    return end;
  };

  // ── Daily: slot toggle ─────────────────────────────────────────────────────
  const toggleSlot = (id: SlotId) => {
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedSlotsArr = useMemo(
    () => TIME_SLOTS.filter((s) => selectedSlotIds.has(s.id)).sort((a, b) => a.fromHour - b.fromHour),
    [selectedSlotIds]
  );

  // Display-only computed times for the summary card
  const dailyDisplayStart = useMemo(
    () => dailyDate ? computeDisplayStart(dailyDate, selectedSlotIds) : null,
    [dailyDate, selectedSlotIds]
  );
  const dailyDisplayEnd = useMemo(
    () => dailyDate ? computeDisplayEnd(dailyDate, selectedSlotIds) : null,
    [dailyDate, selectedSlotIds]
  );

  // ── Can proceed ────────────────────────────────────────────────────────────
  const canContinue = useMemo(() => {
    if (bookingMode === "hourly")  return !!(selectedDate && selectedTime);
    if (bookingMode === "monthly") return true;
    if (bookingMode === "daily")   return !!(dailyDate && selectedSlotIds.size > 0);
    return false;
  }, [bookingMode, selectedDate, selectedTime, dailyDate, selectedSlotIds]);

  // ── Navigate ───────────────────────────────────────────────────────────────
  const handleContinue = () => {
    let endTime: string;
    let extra: Record<string, string> = {};

    if (bookingMode === "hourly") {
      // ── HOURLY: completely unchanged ──────────────────────────────────────
      endTime = getHourlyEnd().toISOString();

    } else if (bookingMode === "monthly") {
      // ── MONTHLY: completely unchanged ─────────────────────────────────────
      endTime = getMonthlyEnd().toISOString();
      extra   = { isMonthly: "true", months: String(selectedMonths) };

    } else {
      // ── DAILY ─────────────────────────────────────────────────────────────
      //
      // KEY FIX: We do NOT use the display TIME_SLOTS hours as the actual
      // booking window. Instead:
      //
      // • startTime = now (if today) OR midnight of chosen date (future day)
      //   → Confirmation uses this as bookingFrom
      //
      // • endTime = end hour of last selected display slot on chosen date,
      //   rolled +1 day if already past
      //   → This tells the backend "book until this time"
      //
      // The pricing engine (computeDailyRateCost) then runs from startTime
      // to endTime against the MERCHANT'S actual slot config — not against
      // the display TIME_SLOTS. So if the merchant set Morning = 6–10 AM,
      // and the user picks "Morning" (displayed as 6–12 AM in UI),
      // the engine charges only the merchant's 6–10 AM slot = ₹200 × 1.
      //
      // Hourly and Monthly paths above are NOT touched.

      const actualStart = computeActualStartTime(dailyDate!);
      const actualEnd   = computeActualEndTime(dailyDate!, selectedSlotIds);

      endTime = actualEnd.toISOString();
      extra   = {
        isDaily:         "true",
        dailyDate:       dailyDate!.toISOString(),
        startTime:       actualStart.toISOString(),
        selectedSlotIds: JSON.stringify(Array.from(selectedSlotIds)),
        dailySlotsMeta:  JSON.stringify(
          selectedSlotsArr.map((s) => ({
            id:       s.id,
            label:    s.label,
            fromTime: s.fromTime,
            toTime:   s.toTime,
          }))
        ),
      };
    }

    router.push({
      pathname: "/parkingUser/ParkingSpot",
      params: {
        location:  JSON.stringify(location),
        endTime,
        isMonthly: bookingMode === "monthly" ? "true" : "false",
        months:    String(selectedMonths),
        ...extra,
      },
    });
  };

  // ── Date / time picker handlers ────────────────────────────────────────────
  const onDateChange      = (_: any, d?: Date) => { setShowDatePicker(false);      if (d) { setSelectedDate(d); if (Platform.OS === "android") setShowTimePicker(true); } };
  const onTimeChange      = (_: any, t?: Date) => { setShowTimePicker(false);      if (t) setSelectedTime(t); };
  const onDailyDateChange = (_: any, d?: Date) => { setShowDailyDatePicker(false); if (d) { setDailyDate(d); setSelectedSlotIds(new Set()); } };

  // ── Styles — completely unchanged ──────────────────────────────────────────
  const styles = useMemo(() => {
    const mapH = screenHeight * 0.35;
    return StyleSheet.create({
      container:          { flex: 1, backgroundColor: "#FFF" },
      header:             { flexDirection: "row", alignItems: "center", paddingHorizontal: scale(16), marginBottom: verticalScale(10) },
      backArrow:          { fontSize: moderateScale(28), color: colors.primary },
      headerTitle:        { fontSize: moderateScale(20), fontWeight: "600", marginLeft: scale(10), color: "#000" },
      map:                { width: "100%", height: mapH },
      mapPlaceholder:     { width: "100%", height: mapH, justifyContent: "center", alignItems: "center", backgroundColor: "#EEE" },
      placeholderTxt:     { color: "#777", fontSize: moderateScale(16) },
      scrollView:         { flex: 1 },
      scrollContent:      { flexGrow: 1 },
      sheet: {
        backgroundColor: "#FFF",
        padding: scale(20),
        borderTopLeftRadius: scale(25),
        borderTopRightRadius: scale(25),
        marginTop: -scale(20),
        paddingBottom: verticalScale(30),
      },
      sectionTitle:       { fontSize: moderateScale(16), fontWeight: "500", marginBottom: verticalScale(10), color: "#000" },
      textInputRow:       { flexDirection: "row", alignItems: "center", paddingVertical: verticalScale(12), borderBottomWidth: 1.5, borderColor: "#E0E0E0", marginBottom: verticalScale(20) },
      icon:               { width: scale(32), height: scale(32), marginRight: scale(10) },
      textInput:          { flex: 1, fontSize: moderateScale(16), color: "#000" },
      placeholder:        { color: "#999" },
      changeLocText:      { fontSize: moderateScale(14), color: colors.primary, marginBottom: verticalScale(20) },
      toggleRow: {
        flexDirection: "row",
        backgroundColor: "#F0F0F0",
        borderRadius: scale(12),
        padding: scale(4),
        marginBottom: verticalScale(20),
      },
      toggleBtn:          { flex: 1, paddingVertical: verticalScale(10), borderRadius: scale(10), alignItems: "center" },
      toggleBtnActive:    { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
      toggleTxt:          { fontSize: moderateScale(13), fontWeight: "600", color: "#888" },
      toggleTxtActive:    { color: "#FFF" },
      durationRow:        { flexDirection: "row", paddingVertical: verticalScale(12), borderBottomWidth: 1.5, borderColor: "#E0E0E0", marginBottom: verticalScale(20) },
      durationFields:     { flexDirection: "row", flex: 1, justifyContent: "space-between" },
      durationField:      { flexDirection: "row", alignItems: "flex-end" },
      durationVal:        { fontSize: moderateScale(24), fontWeight: "600", marginRight: scale(4) },
      durationLbl:        { fontSize: moderateScale(14), color: "#666", marginBottom: verticalScale(3) },
      monthContainer:     { marginBottom: verticalScale(20) },
      monthRow:           { flexDirection: "row", flexWrap: "wrap", gap: scale(8), marginTop: verticalScale(8) },
      monthChip:          { width: scale(52), height: scale(38), borderRadius: scale(8), borderWidth: 1.5, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAFA", marginBottom: scale(4) },
      monthChipActive:    { borderColor: colors.primary, backgroundColor: colors.primary },
      monthChipTxt:       { fontSize: moderateScale(13), fontWeight: "600", color: "#555" },
      monthChipTxtActive: { color: "#FFF" },
      monthSummaryBox:    { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F8FF", borderRadius: scale(10), padding: scale(14), marginTop: verticalScale(14), borderWidth: 1, borderColor: colors.primary + "44" },
      monthSummaryTxt:    { fontSize: moderateScale(13), color: "#555", flex: 1, lineHeight: moderateScale(20) },
      monthSummaryBold:   { fontWeight: "700", color: colors.primary },
      dateBtnRow:         { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E0E0E0", borderRadius: scale(12), padding: scale(14), marginBottom: verticalScale(22), backgroundColor: "#FAFAFA", gap: scale(10) },
      dateBtnRowActive:   { borderColor: colors.primary, backgroundColor: colors.primary + "09" },
      dateBtnIcon:        { fontSize: moderateScale(20) },
      dateBtnTxt:         { fontSize: moderateScale(15), color: "#999", flex: 1 },
      dateBtnTxtActive:   { color: "#1A1A2E", fontWeight: "600" },
      dateBtnArrow:       { fontSize: moderateScale(18), color: "#CCC" },
      slotsSectionTitle:  { fontSize: moderateScale(14), fontWeight: "700", color: "#444", marginBottom: verticalScale(14) },
      slotGrid:           { flexDirection: "row", flexWrap: "wrap", gap: scale(10), marginBottom: verticalScale(18) },
      slotCard: {
        width: (screenWidth - scale(40) - scale(10)) / 2,
        borderRadius: scale(16),
        borderWidth: 2,
        paddingVertical: verticalScale(16),
        paddingHorizontal: scale(14),
        alignItems: "center",
        position: "relative",
      },
      slotCardEmoji:      { fontSize: moderateScale(28), marginBottom: verticalScale(6) },
      slotCardLabel:      { fontSize: moderateScale(15), fontWeight: "700", marginBottom: verticalScale(4) },
      slotCardTime:       { fontSize: moderateScale(11), fontWeight: "500", textAlign: "center", lineHeight: moderateScale(16) },
      slotCheckBadge: {
        position: "absolute", top: -scale(7), right: -scale(7),
        width: scale(22), height: scale(22),
        borderRadius: scale(11),
        alignItems: "center", justifyContent: "center",
        borderWidth: 2.5, borderColor: "#FFF",
      },
      slotCheckTxt:       { color: "#FFF", fontSize: moderateScale(12), fontWeight: "900" },
      infoBox:            { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#F0F8FF", borderRadius: scale(10), padding: scale(12), marginBottom: verticalScale(16), borderWidth: 1, borderColor: colors.primary + "30", gap: scale(8) },
      infoIcon:           { fontSize: moderateScale(13), marginTop: 1 },
      infoTxt:            { fontSize: moderateScale(12), color: "#555", lineHeight: moderateScale(18), flex: 1 },
      summaryCard:        { backgroundColor: colors.primary + "0C", borderRadius: scale(14), padding: scale(16), marginBottom: verticalScale(16), borderWidth: 1.5, borderColor: colors.primary + "30" },
      summaryTitle:       { fontSize: moderateScale(13), fontWeight: "700", color: colors.primary, marginBottom: verticalScale(12) },
      summaryRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: verticalScale(5) },
      summarySlotChip:    { flexDirection: "row", alignItems: "center", gap: scale(6), flex: 1 },
      summarySlotDot:     { width: scale(8), height: scale(8), borderRadius: scale(4) },
      summarySlotLbl:     { fontSize: moderateScale(13), color: "#444", fontWeight: "500" },
      summarySlotTime:    { fontSize: moderateScale(11), color: "#888", marginLeft: scale(4) },
      summaryDivider:     { height: 1, backgroundColor: colors.primary + "20", marginVertical: verticalScale(10) },
      summaryTotalRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
      summaryTotalLbl:    { fontSize: moderateScale(14), fontWeight: "700", color: "#1A1A2E" },
      summaryTotalVal:    { fontSize: moderateScale(15), fontWeight: "800", color: colors.primary },
      summaryWindowRow:   { flexDirection: "row", justifyContent: "space-between", marginTop: verticalScale(6) },
      summaryWindowLbl:   { fontSize: moderateScale(12), color: "#888" },
      summaryWindowVal:   { fontSize: moderateScale(12), fontWeight: "600", color: "#555" },
      continueBtn:        { backgroundColor: colors.primary, paddingVertical: verticalScale(16), borderRadius: scale(25), alignItems: "center", marginTop: verticalScale(10) },
      continueBtnOff:     { opacity: 0.4 },
      continueBtnTxt:     { color: "#FFF", fontSize: moderateScale(16), fontWeight: "600" },
    });
  }, [screenWidth, screenHeight]);

  // ── Daily mode render — unchanged except display uses dailyDisplayStart/End
  const renderDailyMode = () => (
    <>
      <Text style={styles.sectionTitle}>Select Date</Text>
      <TouchableOpacity
        style={[styles.dateBtnRow, !!dailyDate && styles.dateBtnRowActive]}
        onPress={() => setShowDailyDatePicker(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.dateBtnIcon}>📅</Text>
        <Text style={[styles.dateBtnTxt, !!dailyDate && styles.dateBtnTxtActive]}>
          {dailyDate
            ? dailyDate.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
            : "Tap to pick a date"}
        </Text>
        <Text style={styles.dateBtnArrow}>›</Text>
      </TouchableOpacity>

      {showDailyDatePicker && (
        <DateTimePicker
          value={dailyDate || new Date()}
          mode="date"
          minimumDate={new Date()}
          onChange={onDailyDateChange}
        />
      )}

      {dailyDate && (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoTxt}>
              Pick the time slots you need. You pay a flat fee per slot — exact pricing shown at checkout after you choose a venue.
            </Text>
          </View>

          <Text style={styles.slotsSectionTitle}>
            Choose Time Slots · {selectedSlotIds.size} selected
          </Text>

          <View style={styles.slotGrid}>
            {TIME_SLOTS.map((slot) => {
              const isSelected = selectedSlotIds.has(slot.id);
              const c = slot.color;
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.slotCard,
                    {
                      backgroundColor: isSelected ? c.text : c.bg,
                      borderColor:     isSelected ? c.text : c.border,
                    },
                  ]}
                  onPress={() => toggleSlot(slot.id)}
                  activeOpacity={0.75}
                >
                  {isSelected && (
                    <View style={[styles.slotCheckBadge, { backgroundColor: c.text }]}>
                      <Text style={styles.slotCheckTxt}>✓</Text>
                    </View>
                  )}
                  <Text style={styles.slotCardEmoji}>{slot.icon}</Text>
                  <Text style={[styles.slotCardLabel, { color: isSelected ? "#FFF" : c.text }]}>
                    {slot.label}
                  </Text>
                  <Text style={[styles.slotCardTime, { color: isSelected ? "rgba(255,255,255,0.8)" : c.text + "AA" }]}>
                    {fmt12(slot.fromTime)}{"\n"}– {fmt12(slot.toTime)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedSlotsArr.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📋 Selected Slots</Text>
              {selectedSlotsArr.map((slot) => (
                <View key={slot.id} style={styles.summaryRow}>
                  <View style={styles.summarySlotChip}>
                    <View style={[styles.summarySlotDot, { backgroundColor: slot.color.text }]} />
                    <Text style={styles.summarySlotLbl}>{slot.icon} {slot.label}</Text>
                    <Text style={styles.summarySlotTime}>
                      {fmt12(slot.fromTime)} – {fmt12(slot.toTime)}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={styles.summaryDivider} />

              {/* Display window — for info only, not used for pricing */}
              {dailyDisplayStart && dailyDisplayEnd && (
                <View style={styles.summaryWindowRow}>
                  <Text style={styles.summaryWindowLbl}>Approx. window</Text>
                  <Text style={styles.summaryWindowVal}>
                    {dailyDisplayStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {dailyDisplayEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              )}

              <View style={[styles.summaryWindowRow, { marginTop: 4 }]}>
                <Text style={styles.summaryWindowLbl}>Exact pricing</Text>
                <Text style={[styles.summaryWindowLbl, { color: colors.primary, fontWeight: "600" }]}>
                  Shown at checkout ›
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Parking</Text>
      </View>

      {!location ? (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderTxt}>Loading map…</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
          showsUserLocation
        >
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Selected Location"
            pinColor={colors.primary}
          />
        </MapView>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sheet}>

          {/* Location */}
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.textInputRow}>
            <Image source={images.location} style={styles.icon} />
            <TextInput
              style={styles.textInput}
              placeholder="Your selected location"
              placeholderTextColor="#999"
              value={location ? `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}` : ""}
              editable={false}
            />
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.changeLocText}>Change Location</Text>
          </TouchableOpacity>

          {/* Booking type toggle */}
          <Text style={styles.sectionTitle}>Booking Type</Text>
          <View style={styles.toggleRow}>
            {(["hourly", "daily", "monthly"] as BookingMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.toggleBtn, bookingMode === mode && styles.toggleBtnActive]}
                onPress={() => setBookingMode(mode)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleTxt, bookingMode === mode && styles.toggleTxtActive]}>
                  {mode === "hourly" ? "⏱ Hourly" : mode === "daily" ? "📆 Daily" : "📅 Monthly/Permit"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hourly — completely unchanged */}
          {bookingMode === "hourly" && (
            <>
              <Text style={styles.sectionTitle}>When</Text>
              <TouchableOpacity style={styles.textInputRow} onPress={() => setShowDatePicker(true)}>
                <Image source={images.calender} style={styles.icon} />
                <Text style={[styles.textInput, !dateTimeText && styles.placeholder]}>
                  {dateTimeText || "Select Date & Time"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Duration</Text>
              <View style={styles.durationRow}>
                <Image source={images.calender} style={styles.icon} />
                <View style={styles.durationFields}>
                  {[
                    { val: duration.days,    lbl: "Days"    },
                    { val: duration.hours,   lbl: "Hours"   },
                    { val: duration.minutes, lbl: "Minutes" },
                  ].map(({ val, lbl }) => (
                    <View key={lbl} style={styles.durationField}>
                      <Text style={styles.durationVal}>{val}</Text>
                      <Text style={styles.durationLbl}>{lbl}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker value={selectedDate || new Date()} mode="date" minimumDate={new Date()} onChange={onDateChange} />
              )}
              {showTimePicker && (
                <DateTimePicker value={selectedTime || new Date()} mode="time" is24Hour onChange={onTimeChange} />
              )}
            </>
          )}

          {/* Daily */}
          {bookingMode === "daily" && renderDailyMode()}

          {/* Monthly — completely unchanged */}
          {bookingMode === "monthly" && (
            <View style={styles.monthContainer}>
              <Text style={styles.sectionTitle}>Number of Months</Text>
              <View style={styles.monthRow}>
                {MONTHS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthChip, selectedMonths === m && styles.monthChipActive]}
                    onPress={() => setSelectedMonths(m)}
                  >
                    <Text style={[styles.monthChipTxt, selectedMonths === m && styles.monthChipTxtActive]}>
                      {m}mo
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.monthSummaryBox}>
                <Text style={styles.monthSummaryTxt}>
                  Booking from <Text style={styles.monthSummaryBold}>Today</Text> until{" "}
                  <Text style={styles.monthSummaryBold}>{monthlyEndLabel}</Text>
                  {"  "}({selectedMonths} {selectedMonths === 1 ? "month" : "months"})
                </Text>
              </View>
            </View>
          )}

          {/* Continue button */}
          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && styles.continueBtnOff]}
            disabled={!canContinue}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnTxt}>
              {bookingMode === "daily" && selectedSlotsArr.length > 0
                ? `Continue with ${selectedSlotsArr.length} Slot${selectedSlotsArr.length > 1 ? "s" : ""}`
                : "Pick Parking Slot"}
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ParkingSlot;