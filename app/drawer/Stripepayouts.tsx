import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useAppSelector } from "../../components/redux/hooks";
import colors from "../../assets/color";

// ── Types ──────────────────────────────────────────────────────────────────

type ConnectStatus =
  | "loading" // initial fetch in progress
  | "not_connected" // no Stripe account yet
  | "pending" // account created but KYC not done
  | "active"; // charges_enabled = true

interface StatusData {
  connected: boolean;
  chargesEnabled: boolean;
  stripeAccountId?: string;
  onboardingComplete?: boolean;
}

// ── API base — same pattern as SubAccountsScreen ──────────────────────────
const API_BASE = "https://vervoer-backend2.onrender.com/api";

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

const StripePayoutsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAppSelector((state) => state.auth);

  const [status, setStatus] = useState<ConnectStatus>("loading");
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch current connect status ─────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await fetch(`${API_BASE}/merchants/connect/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      const d: StatusData = data.data;
      setStatusData(d);

      if (!d.connected) {
        setStatus("not_connected");
      } else if (d.chargesEnabled) {
        setStatus("active");
      } else {
        setStatus("pending");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to fetch payout status");
      setStatus("not_connected");
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Start or resume onboarding ────────────────────────────────────────────

  const handleSetupPayouts = async () => {
    try {
      setActionLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const res = await fetch(`${API_BASE}/merchants/connect/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      // If already fully onboarded the server says so — just refresh status
      if (data.data?.alreadyOnboarded) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        await fetchStatus();
        return;
      }

      // Open Stripe KYC page in the in-app browser
      const onboardingUrl: string = data.data?.onboardingUrl;
      if (!onboardingUrl) throw new Error("No onboarding URL returned");

      await WebBrowser.openBrowserAsync(onboardingUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // After returning from the browser, refresh status so the UI updates
      await fetchStatus();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start payout setup");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Disconnect ────────────────────────────────────────────────────────────

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Stripe Account",
      "This will unlink your Stripe payout account. Existing bookings are not affected but future payments will not be automatically split. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              const res = await fetch(
                `${API_BASE}/merchants/connect/disconnect`,
                {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                },
              );
              const data = await res.json();
              if (!data.success) throw new Error(data.message);

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              await fetchStatus();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.message || "Failed to disconnect account",
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── UI helpers ────────────────────────────────────────────────────────────

  const statusConfig = {
    loading: {
      color: "#9CA3AF",
      bg: "#F3F4F6",
      icon: "loader" as const,
      label: "Checking…",
    },
    not_connected: {
      color: "#EF4444",
      bg: "#FEE2E2",
      icon: "x-circle" as const,
      label: "Not Connected",
    },
    pending: {
      color: "#F59E0B",
      bg: "#FEF3C7",
      icon: "clock" as const,
      label: "Setup Incomplete",
    },
    active: {
      color: "#16A34A",
      bg: "#DCFCE7",
      icon: "check-circle" as const,
      label: "Active — Payouts Enabled",
    },
  };

  const cfg = statusConfig[status];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Stripe Payouts</Text>
          <Text style={styles.headerSubtitle}>
            Receive earnings directly to your bank
          </Text>
        </View>
        {/* Refresh button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            fetchStatus();
          }}
          style={styles.refreshButton}
          activeOpacity={0.8}
          disabled={status === "loading"}
        >
          <Feather name="refresh-cw" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status card ── */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: cfg.bg }]}>
            {status === "loading" ? (
              <ActivityIndicator size="small" color={cfg.color} />
            ) : (
              <Feather name={cfg.icon} size={28} color={cfg.color} />
            )}
          </View>

          <View style={styles.statusTextBlock}>
            <Text style={styles.statusTitle}>Payout Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
          </View>

          {statusData?.stripeAccountId && (
            <View style={styles.accountIdRow}>
              <Feather name="link" size={12} color="#9CA3AF" />
              <Text style={styles.accountIdText} numberOfLines={1}>
                {statusData.stripeAccountId}
              </Text>
            </View>
          )}
        </View>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={styles.infoText}>
            Connect a Stripe account so your share of each booking is
            automatically transferred to your bank. Platform fees (service fee +
            taxes) are kept by Vervoer.
          </Text>
        </View>

        {/* ── How it works ── */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How it works</Text>

          {[
            {
              step: "1",
              title: "Connect Stripe",
              desc: "Tap the button below and complete a quick KYC form on Stripe's secure page.",
            },
            {
              step: "2",
              title: "Automatic Splits",
              desc: "When a customer pays, Stripe automatically sends your share to your bank. No manual withdrawals needed.",
            },
            {
              step: "3",
              title: "Platform Fee",
              desc: "Vervoer keeps 5% service fee + 15% taxes + $0.50 transaction fee. You receive the base booking amount.",
            },
          ].map((item) => (
            <View key={item.step} style={styles.stepRow}>
              <View style={styles.stepBubble}>
                <Text style={styles.stepNumber}>{item.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Payout example ── */}
        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Example Payout</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleLabel}>Customer pays</Text>
            <Text style={styles.exampleValue}>$100.00</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={[styles.exampleLabel, { color: "#EF4444" }]}>
              Platform fee (5% + 15% + $0.50)
            </Text>
            <Text style={[styles.exampleValue, { color: "#EF4444" }]}>
              − $20.92
            </Text>
          </View>
          <View style={styles.exampleDivider} />
          <View style={styles.exampleRow}>
            <Text
              style={[
                styles.exampleLabel,
                { fontWeight: "700", color: "#111827" },
              ]}
            >
              You receive
            </Text>
            <Text
              style={[
                styles.exampleValue,
                { fontWeight: "700", color: "#16A34A" },
              ]}
            >
              $79.08
            </Text>
          </View>
        </View>

        {/* ── Action buttons ── */}
        {status !== "loading" && (
          <View style={styles.actionsBlock}>
            {/* Not connected or pending → show setup button */}
            {(status === "not_connected" || status === "pending") && (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  actionLoading && styles.buttonDisabled,
                ]}
                onPress={handleSetupPayouts}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="external-link" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>
                      {status === "pending"
                        ? "Continue Stripe Setup"
                        : "Set Up Stripe Payouts"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Active → show a success message + disconnect option */}
            {status === "active" && (
              <>
                <View style={styles.successBanner}>
                  <Feather name="check-circle" size={20} color="#16A34A" />
                  <Text style={styles.successBannerText}>
                    Your Stripe account is active. Payouts are automatic after
                    each successful booking.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dangerButton,
                    actionLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleDisconnect}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Feather name="link-2" size={16} color="#EF4444" />
                      <Text style={styles.dangerButtonText}>
                        Disconnect Stripe Account
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  // ── Header ──
  header: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextBlock: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // ── Status card ──
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    gap: 12,
  },
  statusIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  statusTextBlock: {
    alignItems: "center",
    gap: 8,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  accountIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  accountIdText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    maxWidth: 220,
  },

  // ── Info banner ──
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: `${colors.primary}12`,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },

  // ── Steps card ──
  stepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    gap: 16,
  },
  stepsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  stepBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },

  // ── Example card ──
  exampleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    gap: 10,
  },
  exampleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  exampleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exampleLabel: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  exampleValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  exampleDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },

  // ── Action buttons ──
  actionsBlock: { gap: 12 },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  successBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  successBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#166534",
    lineHeight: 18,
  },

  dangerButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerButtonText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "600",
  },

  buttonDisabled: { opacity: 0.6 },
});

export default StripePayoutsScreen;
