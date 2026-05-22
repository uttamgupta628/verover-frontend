import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../assets/color";
import { logout } from "../components/redux/authSlice";
import { useAppDispatch, useAppSelector } from "../components/redux/hooks";
import { clearProfile } from "../components/redux/profileSlice";

import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ visible, onClose }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const dispatch = useAppDispatch();
  const insets   = useRouter();
  const router   = useRouter();
  const safeInsets = useSafeAreaInsets();

  const { user: authUser } = useAppSelector((state) => state.auth);
  const userType = authUser?.userType;
  const { firstName, lastName, profileImage } = useAppSelector(
    (state) => state.profile
  );

  // ── Drawer open/close animation ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0,    tension: 65, friction: 9,  useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,    duration: 300,              useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1,    tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -300, duration: 250,              useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,    duration: 200,              useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 250,              useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleCloseWithHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleNavigation = async (route: string) => {
    try {
      await Haptics.selectionAsync();
      onClose();
      setTimeout(() => { router.push(route as any); }, 250);
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  const handleEditProfileImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setTimeout(() => { router.push("/MyProfile" as any); }, 250);
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel", onPress: () => Haptics.selectionAsync() },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onClose();
              await AsyncStorage.removeItem("loginKey");
              dispatch(logout());
              dispatch(clearProfile());
              setTimeout(() => { router.replace("/login"); }, 300);
            } catch (error) {
              console.error("Logout error:", error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ── Profile data ──────────────────────────────────────────────────────────
  const getProfileImageSource = () => {
    if (profileImage)              return { uri: profileImage };
    if (authUser?.profileImage)    return { uri: authUser.profileImage };
    if (authUser?.driveProfileImage) return { uri: authUser.driveProfileImage };
    return null;
  };

  const displayName  = firstName && lastName ? `${firstName} ${lastName}` : authUser?.name || "User";
  const displayEmail = authUser?.email || "";

  // ── Menu items ────────────────────────────────────────────────────────────
  // Common items for all user types
  const commonItems = [
    { icon: "home",           label: "Home",           route: "/userHome"             },
    { icon: "user",           label: "My Profile",     route: "/MyProfile"            },
    { icon: "credit-card",    label: "Fare Card",      route: "/drawer/fareCard"      },
    { icon: "message-circle", label: "Tips and Info",  route: "/drawer/faq"           },
    { icon: "settings",       label: "Settings",       route: "/drawer/settings"      },
    { icon: "phone",          label: "Contact Us",     route: "/drawer/contact"       },
    { icon: "lock",           label: "Reset Password", route: "/drawer/resetPassword" },
  ];

  // Merchant-only items
  const merchantItems = userType === "merchant"
    ? [
        { icon: "users",    label: "Sub-Accounts",   route: "/drawer/subAccounts"   },
        { icon: "dollar-sign", label: "Payment Setup", route: "/drawer/Stripepayouts" },
      ]
    : [];

  const menuItems = [...commonItems, ...merchantItems];

  if (!visible) return null;

  const imageSource = getProfileImageSource();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCloseWithHaptic}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* ── Drawer ── */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
              opacity:   fadeAnim,
              paddingTop: safeInsets.top,
            },
          ]}
        >
          {/* Header / Profile Section */}
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.profileImageWrapper}
              onPress={handleEditProfileImage}
              activeOpacity={0.85}
            >
              {imageSource ? (
                <Image
                  source={imageSource}
                  style={styles.profileImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileInitials}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.editBadge}>
                <Feather name="edit-2" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            {!!displayEmail && (
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
            )}

            {/* ── Merchant payout status pill ── */}
            {userType === "merchant" && (
              <TouchableOpacity
                style={styles.payoutPill}
                onPress={() => handleNavigation("/drawer/stripePayouts")}
                activeOpacity={0.8}
              >
                <Feather name="dollar-sign" size={11} color="#FFFFFF" />
                <Text style={styles.payoutPillText}>Manage Payouts</Text>
                <Feather name="chevron-right" size={11} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Menu Items */}
          <ScrollView
            style={styles.menuContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuContent}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleNavigation(item.route)}
                style={styles.menuItem}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconContainer}>
                  <Feather
                    name={item.icon as any}
                    size={20}
                    color={item.label === "Home" ? colors.primary : "#666666"}
                  />
                </View>
                <Text
                  style={[
                    styles.menuText,
                    item.label === "Home" && styles.activeMenuText,
                  ]}
                >
                  {item.label}
                </Text>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Logout */}
          <View style={[styles.logoutContainer, { paddingBottom: safeInsets.bottom + 12 }]}>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutButton}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Feather name="log-out" size={20} color="#FF6B6B" />
              </View>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Blur overlay — tap to close */}
        <TouchableOpacity
          style={styles.blurOverlay}
          activeOpacity={1}
          onPress={handleCloseWithHaptic}
        >
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  blurOverlay: { flex: 1 },
  drawer: {
    width: 280,
    backgroundColor: "#FFFFFF",
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },

  // ── Header ──
  headerSection: {
    backgroundColor: colors.primary,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 4,
  },
  profileImageWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  profileImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileImagePlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileInitials: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    maxWidth: "100%",
  },
  profileEmail: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    maxWidth: "100%",
  },

  // ── Payout pill (merchant only) ──
  payoutPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  payoutPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // ── Menu ──
  menuContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  menuContent:   { paddingVertical: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  menuIconContainer: {
    width: 32,
    alignItems: "center",
    marginRight: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: "#333333",
    fontWeight: "400",
  },
  activeMenuText: {
    color: colors.primary,
    fontWeight: "600",
  },

  // ── Logout ──
  logoutContainer: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FAFAFA",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  logoutText: {
    flex: 1,
    fontSize: 15,
    color: "#FF6B6B",
    fontWeight: "600",
  },
});

export default ProfileDrawer;