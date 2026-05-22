/**
 * ParkingSpotCard.tsx
 *
 * Shows a parking/garage/residence card.
 * Pricing:
 *   - Hourly  → lot.price  (₹X/hr)
 *   - Monthly → lot.monthlyRate (₹X/mo)
 *   - Daily   → fetches daily-rate slots via useDailyRate, computes total
 */

import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import colors from "../../assets/color";
import { useDailyRate, computeDailyRateCost } from "../parkingUser/Usedailyrate";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailySlotMeta {
  id: string;
  label: string;
  fromTime: string;
  toTime: string;
}

interface ParkingSpotCardProps {
  id: string;
  type: "G" | "L" | "R";
  title: string;
  address: string;
  duration?: string;
  rating?: string;
  price: string;            // hourly rate from lot.price
  monthlyRate?: number;     // from lot.monthlyRate
  selected: boolean;
  onSelect: () => void;
  isMonthly?: boolean;
  isDaily?: boolean;
  dailySlotsMeta?: DailySlotMeta[];
  bookingFrom?: string;     // ISO
  bookingTo?: string;       // ISO
}

// ── Slot colour palette ───────────────────────────────────────────────────────

const SLOT_COLORS = [
  { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  { bg: "#EEF4FF", border: "#BFD4FF", text: "#2563EB" },
  { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
  { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
];

const slotEmoji: Record<string, string> = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌆",
  night: "🌙",
};

function fmt12(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0 && m === 0) return "12:00 AM";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// ── FIX: convert "HH:MM" to total minutes for correct sort ordering
function toTotalMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function venueTypeFromCardType(type: "G" | "L" | "R") {
  if (type === "G") return "garage";
  if (type === "L") return "parking";
  return "residence";
}

// ── Component ─────────────────────────────────────────────────────────────────

const ParkingSpotCard: React.FC<ParkingSpotCardProps> = ({
  id,
  type,
  title,
  address,
  duration,
  rating,
  price,
  monthlyRate,
  selected,
  onSelect,
  isMonthly = false,
  isDaily = false,
  dailySlotsMeta = [],
  bookingFrom,
  bookingTo,
}) => {
  const venueType = venueTypeFromCardType(type);

  // Only fetch daily rates when in daily mode
  const {
    dailyRateEnabled,
    dailyRates,
    loading: rateLoading,
  } = useDailyRate(isDaily ? venueType : null, isDaily ? id : null);

  // ── Compute daily cost ────────────────────────────────────────────────────
  const costResult = useMemo(() => {
    if (!isDaily || !dailyRateEnabled || dailyRates.length === 0) return null;

    // Primary path: use the real bookingFrom / bookingTo passed from parent
    if (bookingFrom && bookingTo) {
      const from = new Date(bookingFrom);
      const to   = new Date(bookingTo);
      if (to > from) return computeDailyRateCost(from, to, dailyRates);
    }

    // Fallback: synthesise window from slot meta
    if (dailySlotsMeta.length === 0) return null;

    // FIX: use toTotalMins() instead of parseInt() so "06:00" → 360, not 6
    const sorted = [...dailySlotsMeta].sort(
      (a, b) => toTotalMins(a.fromTime) - toTotalMins(b.fromTime)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [fH, fM] = sorted[0].fromTime.split(":").map(Number);
    const from = new Date(today.getTime() + (fH * 60 + fM) * 60_000);

    const last = sorted[sorted.length - 1];
    const [tH, tM] = last.toTime.split(":").map(Number);
    const to = (tH === 0 && tM === 0)
      ? new Date(today.getTime() + 24 * 60 * 60_000)
      : new Date(today.getTime() + (tH * 60 + tM) * 60_000);

    return computeDailyRateCost(from, to, dailyRates);
  }, [isDaily, dailyRateEnabled, dailyRates, bookingFrom, bookingTo, dailySlotsMeta]);

  const slotRows = useMemo(() => {
    if (!costResult || dailySlotsMeta.length === 0) return [];
    return dailySlotsMeta.map((meta) => {
      const entry = costResult.breakdown.find(
        (b) => b.label.toLowerCase() === meta.label.toLowerCase()
      );
      return { meta, price: entry ? entry.price : null };
    });
  }, [costResult, dailySlotsMeta]);

  const hasPriceData = slotRows.some((r) => r.price !== null);
  const totalAmount  = costResult?.totalAmount ?? 0;

  // ── Price badge label ─────────────────────────────────────────────────────
  const priceBadgeText = useMemo(() => {
    if (isMonthly) {
      return monthlyRate ? `₹${monthlyRate}/mo` : "Monthly";
    }
    if (isDaily) {
      if (rateLoading) return "...";
      if (totalAmount > 0) return `₹${totalAmount.toFixed(0)}`;
      return "Daily";
    }
    // Hourly
    return price ? `₹${price}/hr` : "—";
  }, [isMonthly, isDaily, monthlyRate, price, rateLoading, totalAmount]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.82}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.address} numberOfLines={1}>{address}</Text>
        </View>

        <View style={[styles.priceBadge, selected && styles.priceBadgeSelected]}>
          {isDaily && rateLoading ? (
            <ActivityIndicator size="small" color={selected ? "#fff" : colors.primary} />
          ) : (
            <Text style={[styles.priceBadgeLabel, selected && styles.priceBadgeLabelSelected]}>
              {priceBadgeText}
            </Text>
          )}
        </View>
      </View>

      {/* Meta chips */}
      <View style={styles.metaRow}>
        {rating && (
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="star" size={12} color="#F59E0B" />
            <Text style={styles.metaChipText}>{rating}</Text>
          </View>
        )}
        {duration && (
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="map-marker-distance" size={12} color={colors.primary} />
            <Text style={styles.metaChipText}>{duration}</Text>
          </View>
        )}
        <View style={styles.metaChip}>
          <MaterialCommunityIcons
            name={type === "G" ? "garage" : type === "L" ? "parking" : "home"}
            size={12}
            color={colors.primary}
          />
          <Text style={styles.metaChipText}>
            {type === "G" ? "Garage" : type === "L" ? "Lot" : "Residence"}
          </Text>
        </View>

        {isMonthly && (
          <View style={[styles.metaChip, styles.monthlyChip]}>
            <Text style={styles.monthlyChipText}>📅 Monthly</Text>
          </View>
        )}
        {isDaily && (
          <View style={[styles.metaChip, styles.dailyChip]}>
            <Text style={styles.dailyChipText}>⏱ Daily</Text>
          </View>
        )}
      </View>

      {/* ── Monthly pricing info ─────────────────────────────────────────── */}
      {isMonthly && (
        <View style={styles.monthlySection}>
          <View style={styles.monthlyRow}>
            <MaterialCommunityIcons name="calendar-month" size={16} color={colors.primary} />
            <Text style={styles.monthlyLabel}>Monthly Rate</Text>
            <Text style={styles.monthlyValue}>
              {monthlyRate ? `₹${monthlyRate}/month` : "Contact for rate"}
            </Text>
          </View>
          <Text style={styles.disclaimer}>* Taxes & service fees added at checkout</Text>
        </View>
      )}

      {/* ── Hourly pricing info ──────────────────────────────────────────── */}
      {!isMonthly && !isDaily && (
        <View style={styles.hourlySection}>
          <View style={styles.hourlyRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
            <Text style={styles.hourlyLabel}>Hourly Rate</Text>
            <Text style={styles.hourlyValue}>
              {price ? `₹${price}/hr` : "—"}
            </Text>
          </View>
          <Text style={styles.disclaimer}>* Taxes & service fees added at checkout</Text>
        </View>
      )}

      {/* ── Daily rate section ───────────────────────────────────────────── */}
      {isDaily && (
        <View style={styles.dailySection}>
          {rateLoading ? (
            <View style={styles.dailyLoadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.dailyLoadingText}>Loading slot prices…</Text>
            </View>

          ) : dailySlotsMeta.length === 0 ? (
            <Text style={styles.dailyNoSlotText}>No time slots selected</Text>

          ) : (
            <>
              <View style={styles.dailyHeaderRow}>
                <Text style={styles.dailySectionTitle}>Applicable Shifts</Text>
                {dailyRateEnabled && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Time-Based</Text>
                  </View>
                )}
              </View>

              {slotRows.map(({ meta, price: slotPrice }, idx) => {
                const c     = SLOT_COLORS[idx % SLOT_COLORS.length];
                const emoji = slotEmoji[meta.id] ?? "⏱";
                return (
                  <View
                    key={meta.id}
                    style={[styles.slotRow, { backgroundColor: c.bg, borderColor: c.border }]}
                  >
                    <View style={styles.slotLeft}>
                      <Text style={styles.slotEmoji}>{emoji}</Text>
                      <View style={styles.slotTextBlock}>
                        <Text style={[styles.slotLabel, { color: c.text }]}>{meta.label}</Text>
                        <Text style={[styles.slotTime, { color: c.text + "BB" }]}>
                          {fmt12(meta.fromTime)} – {fmt12(meta.toTime)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.slotRight}>
                      {slotPrice !== null ? (
                        <Text style={[styles.slotPrice, { color: c.text }]}>
                          ₹{slotPrice.toFixed(0)}
                        </Text>
                      ) : (
                        <Text style={[styles.slotPriceTbd, { color: c.text + "99" }]}>—</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {hasPriceData && (
                <View style={[styles.totalRow, selected && styles.totalRowSelected]}>
                  <View style={styles.totalLeft}>
                    <MaterialCommunityIcons
                      name="calculator-variant-outline"
                      size={14}
                      color={selected ? "#fff" : colors.primary}
                    />
                    <Text style={[styles.totalLabel, selected && styles.totalLabelSelected]}>
                      Est. Total (before fees)
                    </Text>
                  </View>
                  <Text style={[styles.totalAmount, selected && styles.totalAmountSelected]}>
                    ₹{totalAmount.toFixed(0)}
                  </Text>
                </View>
              )}

              <Text style={styles.disclaimer}>* Taxes & service fees added at checkout</Text>
            </>
          )}
        </View>
      )}

      {selected && (
        <View style={styles.selectedBanner}>
          <MaterialCommunityIcons name="check-circle" size={13} color="#fff" />
          <Text style={styles.selectedBannerText}>Selected</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#EBEBEB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
  },

  topRow:     { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  titleBlock: { flex: 1, marginRight: 10 },
  title:      { fontSize: 15, fontWeight: "700", color: "#1A1A2E", marginBottom: 2 },
  address:    { fontSize: 12, color: "#888", lineHeight: 16 },

  priceBadge:              { backgroundColor: colors.primary + "12", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.primary + "30", alignItems: "center", justifyContent: "center", minWidth: 70 },
  priceBadgeSelected:      { backgroundColor: colors.primary, borderColor: colors.primary },
  priceBadgeLabel:         { fontSize: 12, fontWeight: "700", color: colors.primary },
  priceBadgeLabelSelected: { color: "#fff" },

  metaRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  metaChip:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F5F5F5", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  metaChipText: { fontSize: 11, color: "#555", fontWeight: "500" },

  monthlyChip:     { backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "33" },
  monthlyChipText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  dailyChip:       { backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA" },
  dailyChipText:   { fontSize: 11, color: "#C2410C", fontWeight: "600" },

  // ── Monthly section ───────────────────────────────────────────────────────
  monthlySection: { borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10, marginTop: 2 },
  monthlyRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.primary + "0F",
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.primary + "28", marginBottom: 6,
  },
  monthlyLabel: { fontSize: 13, fontWeight: "600", color: colors.primary, flex: 1 },
  monthlyValue: { fontSize: 16, fontWeight: "800", color: colors.primary },

  // ── Hourly section ────────────────────────────────────────────────────────
  hourlySection: { borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10, marginTop: 2 },
  hourlyRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F8F9FF",
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "#E0E7FF", marginBottom: 6,
  },
  hourlyLabel: { fontSize: 13, fontWeight: "600", color: "#3730A3", flex: 1 },
  hourlyValue: { fontSize: 16, fontWeight: "800", color: "#3730A3" },

  // ── Daily section ─────────────────────────────────────────────────────────
  dailySection:     { borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10, marginTop: 2 },
  dailyLoadingRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  dailyLoadingText: { fontSize: 12, color: colors.primary },
  dailyNoSlotText:  { fontSize: 12, color: "#AAA", fontStyle: "italic", paddingVertical: 6 },

  dailyHeaderRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  dailySectionTitle: { fontSize: 11, fontWeight: "700", color: "#555", letterSpacing: 0.4, textTransform: "uppercase" },
  activePill:        { backgroundColor: colors.primary + "15", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.primary + "30" },
  activePillText:    { fontSize: 10, color: colors.primary, fontWeight: "700" },

  slotRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 },
  slotLeft:      { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  slotEmoji:     { fontSize: 18 },
  slotTextBlock: { flex: 1 },
  slotLabel:     { fontSize: 13, fontWeight: "700", marginBottom: 1 },
  slotTime:      { fontSize: 11, fontWeight: "500" },
  slotRight:     { marginLeft: 8, alignItems: "flex-end" },
  slotPrice:     { fontSize: 16, fontWeight: "800" },
  slotPriceTbd:  { fontSize: 12, fontWeight: "600", fontStyle: "italic" },

  totalRow:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.primary + "0F", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginTop: 2, marginBottom: 6, borderWidth: 1, borderColor: colors.primary + "28" },
  totalRowSelected:    { backgroundColor: colors.primary, borderColor: colors.primary },
  totalLeft:           { flexDirection: "row", alignItems: "center", gap: 6 },
  totalLabel:          { fontSize: 13, fontWeight: "700", color: colors.primary },
  totalLabelSelected:  { color: "#fff" },
  totalAmount:         { fontSize: 18, fontWeight: "800", color: colors.primary },
  totalAmountSelected: { color: "#fff" },

  disclaimer:         { fontSize: 10, color: "#BBBBBB", fontStyle: "italic", marginTop: 2, marginBottom: 2 },
  selectedBanner:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, alignSelf: "flex-end", marginTop: 8 },
  selectedBannerText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});

export default ParkingSpotCard;