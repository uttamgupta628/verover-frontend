import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  Image,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import * as WebBrowser from "expo-web-browser";
import { useAppSelector } from "../components/redux/hooks";
import colors from "../assets/color";
import { images } from "../assets/images/images";
import CarRentalSlider from "../components/CarRentalSlider";

// ─── Vercel dashboard URL ─────────────────────────────────────────────────────
const DASHBOARD_URL = "https://vervoer-merchant-dashboad.vercel.app/";
const API_BASE = "https://vervoer-backend2.onrender.com/api";

// ─── Payout status types ──────────────────────────────────────────────────────
type PayoutStatus = "loading" | "not_connected" | "pending" | "active";

// ─── Status badge config ──────────────────────────────────────────────────────
const PAYOUT_STATUS_CONFIG: Record<
  PayoutStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  loading: {
    label: "Checking…",
    color: "#9CA3AF",
    bg: "#F3F4F6",
    dot: "#9CA3AF",
  },
  not_connected: {
    label: "Not Connected",
    color: "#EF4444",
    bg: "#FEE2E2",
    dot: "#EF4444",
  },
  pending: {
    label: "Setup Needed",
    color: "#D97706",
    bg: "#FEF3C7",
    dot: "#F59E0B",
  },
  active: { label: "Active", color: "#16A34A", bg: "#DCFCE7", dot: "#22C55E" },
};

export default function MerchantHome() {
  const router = useRouter();
  const { user, token } = useAppSelector((state) => state.auth);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>("loading");

  // Subtle pulse animation for the dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (user?.userType !== "merchant") {
      router.replace("/userHome");
    }
  }, [user]);

  // ── Block Android hardware back button ────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true // returning true prevents going back
    );
    return () => backHandler.remove();
  }, []);

  // ── Pulse animation (runs when active) ───────────────────────────────────
  useEffect(() => {
    if (payoutStatus === "active") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [payoutStatus]);

  // ── Fetch payout status ───────────────────────────────────────────────────
  const fetchPayoutStatus = useCallback(async () => {
    if (!token) {
      setPayoutStatus("not_connected");
      return;
    }
    try {
      setPayoutStatus("loading");
      const res = await fetch(`${API_BASE}/merchants/connect/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const d = data.data;
      if (!d.connected) setPayoutStatus("not_connected");
      else if (d.chargesEnabled) setPayoutStatus("active");
      else setPayoutStatus("pending");
    } catch (err) {
      console.warn("[fetchPayoutStatus] error:", err);
      setPayoutStatus("not_connected");
    }
  }, [token]);

  useEffect(() => {
    fetchPayoutStatus();
  }, [fetchPayoutStatus]);

  // ── Open merchant dashboard ───────────────────────────────────────────────
  const openMerchantDashboard = async () => {
    const url = `${DASHBOARD_URL}?token=${token}&merchantId=${user?._id ?? ""}`;
    await WebBrowser.openBrowserAsync(url);
  };

  // ── Navigate to Stripe Payouts screen ────────────────────────────────────
  const openStripePayouts = () => {
    router.push("/drawer/Stripepayouts" as any);
  };

  // ── Status badge helper ───────────────────────────────────────────────────
  const statusCfg = PAYOUT_STATUS_CONFIG[payoutStatus];

  const StatusBadge = () => (
    <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
      {payoutStatus === "loading" ? (
        <ActivityIndicator
          size={8}
          color={statusCfg.color}
          style={{ marginRight: 4 }}
        />
      ) : (
        <View style={styles.statusDotWrapper}>
          {payoutStatus === "active" && (
            <Animated.View
              style={[
                styles.statusDotPulse,
                {
                  backgroundColor: statusCfg.dot,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          )}
          <View
            style={[styles.statusDot, { backgroundColor: statusCfg.dot }]}
          />
        </View>
      )}
      <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
        {statusCfg.label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated={true}
        backgroundColor="transparent"
        translucent={Platform.OS === "android"}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color={colors.brandColor} />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Merchants - Home</Text>
          </View>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push("/scan")}
          >
            <Image source={images.Scanner} style={styles.scanImage} />
            <Text style={styles.scanLabel}>Scan QBR</Text>
          </TouchableOpacity>
        </View>

        {/* ── Slider ── */}
        <View style={styles.sliderContainer}>
          <CarRentalSlider />
        </View>

        {/* ── Services Title ── */}
        <View style={styles.servicesTitleContainer}>
          <Text style={styles.servicesTitle}>Merchant Services</Text>
          <Text style={styles.servicesSubtitle}>Manage your business</Text>
        </View>

        {/* ── Parking Section ── */}
        <View style={styles.sectionLabelRow}>
          <View
            style={[styles.sectionDot, { backgroundColor: colors.brandColor }]}
          />
          <Text style={styles.sectionLabel}>Parking</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.servicesContainer}>
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() =>
              router.push("/parkingMerchent/merchantParkinglotList")
            }
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <Image
                source={images.MerchantParkLot}
                style={styles.parkLotImage}
              />
            </View>
            <Text style={styles.serviceCardText}>Parking Lot</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/parkingMerchent/merchantGarageList")}
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Parking} style={styles.parkingImage} />
            </View>
            <Text style={styles.serviceCardText}>Parking Garage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() =>
              router.push("/parkingMerchent/merchantResidenceList")
            }
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Parking} style={styles.parkingImage} />
            </View>
            <Text style={styles.serviceCardText}>Residence Parking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/parkingMerchent/order")}
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <Ionicons
                name="time-outline"
                size={responsiveWidth(10)}
                color={colors.brandColor}
              />
            </View>
            <Text style={styles.serviceCardText}>Parking History</Text>
          </TouchableOpacity>

          <View style={styles.ghostCard} />
          <View style={styles.ghostCard} />
        </View>

        {/* ── Dry Cleaning Section ── */}
        <View style={styles.sectionLabelRow}>
          <View
            style={[styles.sectionDot, { backgroundColor: colors.brandColor }]}
          />
          <Text style={styles.sectionLabel}>Dry Cleaning</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.servicesContainer}>
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() =>
              router.push("/dryCleanerMerchant/merchantAddDryCleaner")
            }
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Cleaning} style={styles.cleaningImage} />
            </View>
            <Text style={styles.serviceCardText}>Add Dry Cleaner</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/dryCleanerMerchant/myDryCleaners")}
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Cleaning} style={styles.myCleaningImage} />
            </View>
            <Text style={styles.serviceCardText}>My Dry Cleaners</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/dryCleanerMerchant/orderHistory")}
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialCommunityIcons
                name="washing-machine"
                size={responsiveWidth(10)}
                color={colors.brandColor}
              />
            </View>
            <Text style={styles.serviceCardText}>Laundry History</Text>
          </TouchableOpacity>
        </View>

        {/* ── Overview Section ── */}
        <View style={styles.sectionLabelRow}>
          <View
            style={[styles.sectionDot, { backgroundColor: colors.brandColor }]}
          />
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.servicesContainer}>
          {/* Merchant Dashboard card */}
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={openMerchantDashboard}
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialCommunityIcons
                name="view-dashboard-outline"
                size={responsiveWidth(10)}
                color={colors.brandColor}
              />
            </View>
            <Text style={styles.serviceCardText}>Merchant Dashboard</Text>
          </TouchableOpacity>

          {/* ── Setup Payouts card ── */}
          <TouchableOpacity
            style={[
              styles.serviceCard,
              payoutStatus === "pending" && styles.serviceCardWarning,
              payoutStatus === "active" && styles.serviceCardSuccess,
            ]}
            onPress={openStripePayouts}
            activeOpacity={0.75}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialCommunityIcons
                name="bank-transfer"
                size={responsiveWidth(10)}
                color={
                  payoutStatus === "active"
                    ? "#16A34A"
                    : payoutStatus === "pending"
                      ? "#D97706"
                      : colors.brandColor
                }
              />
            </View>
            <Text style={styles.serviceCardText}>Payment Setup</Text>
            {/* Live status badge */}
            <StatusBadge />
          </TouchableOpacity>

          <View style={styles.ghostCard} />
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── card width: 3 per row with equal gaps ────────────────────────────────────
const HORIZONTAL_PADDING = responsiveWidth(4) * 2;
const GAP = responsiveWidth(2);
const CARD_W = (responsiveWidth(100) - HORIZONTAL_PADDING - GAP * 2) / 3;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white || "#FFFFFF",
  },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: responsiveHeight(3) },

  // ── Header ──
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: responsiveWidth(5),
    paddingTop:
      Platform.OS === "ios" ? responsiveHeight(2) : responsiveHeight(4),
    paddingBottom: responsiveHeight(2),
  },
  backButton: { padding: responsiveWidth(2) },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: responsiveWidth(2),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.4),
    color: colors.black || "#000000",
    fontWeight: "600",
    textAlign: "center",
  },
  scanButton: { alignItems: "center", padding: responsiveWidth(2) },
  scanImage: {
    width: responsiveWidth(8),
    height: responsiveWidth(8),
    resizeMode: "contain",
  },
  scanLabel: {
    color: colors.text || "#666666",
    fontSize: responsiveFontSize(1.4),
    marginTop: responsiveHeight(0.5),
  },

  // ── Slider ──
  sliderContainer: {
    height: responsiveHeight(22),
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(2),
  },

  // ── Services titles ──
  servicesTitleContainer: {
    paddingHorizontal: responsiveWidth(4),
    marginTop: responsiveHeight(0.5),
    marginBottom: responsiveHeight(1.5),
  },
  servicesTitle: {
    fontSize: responsiveFontSize(2.4),
    color: colors.black || "#000000",
    fontWeight: "700",
    marginBottom: responsiveHeight(0.4),
  },
  servicesSubtitle: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray || "#666666",
    fontWeight: "400",
  },

  // ── Section label row ──
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(4),
    marginBottom: responsiveHeight(1.2),
    marginTop: responsiveHeight(0.5),
    gap: responsiveWidth(2),
  },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionLabel: {
    fontSize: responsiveFontSize(1.6),
    fontWeight: "700",
    color: colors.black || "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray ? colors.gray + "30" : "#66666630",
  },

  // ── Services grid ──
  servicesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: responsiveWidth(4),
    gap: GAP,
    marginBottom: responsiveHeight(1),
  },

  serviceCard: {
    backgroundColor: colors.white || "#FFFFFF",
    width: CARD_W,
    minHeight: responsiveHeight(15),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(1.5),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },

  // Tinted card variants for payout status
  serviceCardWarning: {
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  serviceCardSuccess: {
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },

  ghostCard: { width: CARD_W, minHeight: 0 },

  serviceIconContainer: {
    width: "100%",
    height: responsiveHeight(7.5),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: responsiveHeight(0.8),
  },
  serviceCardText: {
    marginTop: responsiveHeight(0.4),
    fontSize: responsiveFontSize(1.5),
    color: colors.black || "#000000",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: responsiveFontSize(2),
  },

  parkLotImage: { width: "40%", height: "65%", resizeMode: "contain" },
  parkingImage: { width: "60%", height: "80%", resizeMode: "contain" },
  cleaningImage: { width: "50%", height: "70%", resizeMode: "contain" },
  myCleaningImage: { width: "55%", height: "75%", resizeMode: "contain" },

  bottomSpacing: { height: responsiveHeight(2) },

  // ── Status badge ──
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: responsiveHeight(0.8),
    alignSelf: "center",
  },
  statusBadgeText: {
    fontSize: responsiveFontSize(1.2),
    fontWeight: "700",
  },
  statusDotWrapper: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: "absolute",
  },
  statusDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: "absolute",
    opacity: 0.4,
  },
});