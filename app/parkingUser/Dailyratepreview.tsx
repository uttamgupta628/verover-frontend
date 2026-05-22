/**
 * DailyRatePreview.tsx
 *
 * Reusable component that shows the merchant's daily-rate slots and,
 * when start/end times are provided, shows the full cost breakdown.
 *
 * Props:
 *   slots        – DailyRateSlot[] from useDailyRate
 *   enabled      – boolean from useDailyRate
 *   loading      – boolean from useDailyRate
 *   bookingFrom  – (optional) Date  → triggers cost breakdown display
 *   bookingTo    – (optional) Date
 *   breakdown    – (optional) SlotBreakdown[] from computeCost()
 *   totalAmount  – (optional) number from computeCost()
 *   compact      – render a smaller version (for ParkingSpotCard)
 */

import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import colors from "../../assets/color"; // adjust path if needed
import { DailyRateSlot, SlotBreakdown } from "./Usedailyrate"; // adjust path

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0 && m === 0) return "Midnight";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const SLOT_COLORS = [
  { bg: "#EEF4FF", border: "#BFD4FF", text: "#2563EB" },
  { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  { bg: "#FDF4FF", border: "#E9D5FF", text: "#7E22CE" },
  { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C" },
];

const slotColor = (idx: number) => SLOT_COLORS[idx % SLOT_COLORS.length];

// ── Component ─────────────────────────────────────────────────────────────────

interface DailyRatePreviewProps {
  slots: DailyRateSlot[];
  enabled: boolean;
  loading?: boolean;
  breakdown?: SlotBreakdown[];
  totalAmount?: number;
  compact?: boolean;
}

const DailyRatePreview: React.FC<DailyRatePreviewProps> = ({
  slots,
  enabled,
  loading = false,
  breakdown,
  totalAmount,
  compact = false,
}) => {
  // Nothing to show if daily rate is not enabled
  if (!enabled) return null;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading rate info…</Text>
      </View>
    );
  }

  if (!slots || slots.length === 0) return null;

  // ── Compact badge (used in ParkingSpotCard) ───────────────────────────────
  if (compact) {
    return (
      <View style={styles.compactBadge}>
        <Text style={styles.compactBadgeIcon}>⏱</Text>
        <Text style={styles.compactBadgeText}>Time-based pricing</Text>
      </View>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⏱</Text>
          <Text style={styles.headerTitle}>Time-Based Pricing</Text>
        </View>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>ACTIVE</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Flat fee charged per time slot entered — not per hour.
      </Text>

      {/* Slot chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.slotScroll}
        contentContainerStyle={styles.slotScrollContent}
      >
        {slots.map((slot, idx) => {
          const c = slotColor(idx);
          return (
            <View
              key={slot._id}
              style={[
                styles.slotChip,
                { backgroundColor: c.bg, borderColor: c.border },
              ]}
            >
              <Text style={[styles.slotLabel, { color: c.text }]}>
                {slot.label}
              </Text>
              <Text style={[styles.slotTime, { color: c.text + "CC" }]}>
                {fmt12(slot.fromTime)} – {fmt12(slot.toTime)}
              </Text>
              <Text style={[styles.slotPrice, { color: c.text }]}>
                ₹{slot.price.toFixed(2)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Cost breakdown (only when booking times are known) */}
      {breakdown && breakdown.length > 0 && (
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownDivider} />
          <Text style={styles.breakdownTitle}>Your Estimated Breakdown</Text>

          {breakdown.map((entry, idx) => {
            const c = slotColor(
              slots.findIndex((s) => s.label === entry.label)
            );
            return (
              <View key={`${entry.label}-${idx}`} style={styles.breakdownRow}>
                <View style={styles.breakdownLeft}>
                  <View
                    style={[styles.breakdownDot, { backgroundColor: c.text }]}
                  />
                  <Text style={styles.breakdownLabel}>{entry.label}</Text>
                  {entry.repetitions > 1 && (
                    <View style={styles.repBadge}>
                      <Text style={styles.repBadgeText}>
                        ×{entry.repetitions}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.breakdownAmount}>
                  ₹{entry.charged.toFixed(2)}
                </Text>
              </View>
            );
          })}

          {/* Total */}
          <View style={styles.breakdownTotalRow}>
            <Text style={styles.breakdownTotalLabel}>Daily Rate Total</Text>
            <Text style={styles.breakdownTotalValue}>
              ₹{(totalAmount ?? 0).toFixed(2)}
            </Text>
          </View>

          <Text style={styles.breakdownNote}>
            * Final amount confirmed at checkout. Taxes & fees apply.
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 13,
    color: colors.primary,
  },

  // Compact
  compactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary + "15",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.primary + "33",
    marginTop: 4,
  },
  compactBadgeIcon: { fontSize: 11 },
  compactBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },

  // Full card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.primary + "30",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerIcon: { fontSize: 18 },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  activeBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#888",
    marginBottom: 14,
    lineHeight: 17,
  },

  // Slot chips
  slotScroll: { marginBottom: 4 },
  slotScrollContent: { gap: 10, paddingRight: 4 },
  slotChip: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: "center",
  },
  slotLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  slotTime: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 5,
    textAlign: "center",
  },
  slotPrice: {
    fontSize: 16,
    fontWeight: "800",
  },

  // Breakdown
  breakdownSection: { marginTop: 14 },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#444",
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  breakdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: "#555",
    flex: 1,
  },
  repBadge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  repBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  breakdownTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  breakdownNote: {
    fontSize: 11,
    color: "#AAAAAA",
    marginTop: 8,
    fontStyle: "italic",
  },
});

export default DailyRatePreview;