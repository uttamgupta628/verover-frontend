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

// EXPO-SPECIFIC IMPORTS
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ visible, onClose }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { user: authUser, isAuthenticated } = useAppSelector(
    (state) => state.auth
  );
  const { firstName, lastName, profileImage } = useAppSelector(
    (state) => state.profile
  );

  useEffect(() => {
    if (visible) {
      // Opening animation - smooth and polished
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Closing animation - quick and responsive
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log("User is logged out, navigating to Login...");
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const handleCloseWithHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const menuItems = [
    { icon: "home", label: "Home", route: "/userHome" },
    { icon: "user", label: "My Profile", route: "/MyProfile" },
    { icon: "credit-card", label: "Fare Card", route: "/drawer/fareCard" },
    // { icon: "file-text", label: "Payment Methods", route: "/payment-methods" },
    { icon: "message-circle", label: "Tips and Info", route: "/drawer/faq" },
    { icon: "settings", label: "Settings", route: "/drawer/settings" },
    { icon: "phone", label: "Contact Us", route: "/drawer/contact" },
    { icon: "lock", label: "Reset Password", route: "/drawer/resetPassword" },
  ];

  const handleNavigation = async (route: string) => {
    await Haptics.selectionAsync();
    router.push(route);
    onClose();
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => Haptics.selectionAsync(),
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
            console.log("Logging out...");
            dispatch(logout());
            dispatch(clearProfile());
            router.replace("/login");
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!visible) return null;

  // Get profile image with fallback
  const getProfileImageSource = () => {
    if (profileImage) return { uri: profileImage };
    if (authUser?.profileImage) return { uri: authUser.profileImage };
    if (authUser?.driveProfileImage) return { uri: authUser.driveProfileImage };
    return null;
  };

  const displayName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : authUser?.name || "John Doe";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCloseWithHaptic}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Drawer - now on the left */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
              opacity: fadeAnim,
              paddingTop: insets.top,
            },
          ]}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.profileSection}>
              {/* Profile Image */}
              <View style={styles.profileImageContainer}>
                {getProfileImageSource() ? (
                  <Image
                    source={getProfileImageSource()}
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
                {/* Edit icon badge */}
                <View style={styles.editBadge}>
                  <Feather name="edit-2" size={12} color="#FFFFFF" />
                </View>
              </View>

              {/* User Info */}
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
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
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Logout Button */}
          <View style={styles.logoutContainer}>
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

        {/* Blur overlay - clickable to close - now after drawer */}
        <TouchableOpacity
          style={styles.blurOverlay}
          activeOpacity={1}
          onPress={handleCloseWithHaptic}
        >
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <BlurView
              intensity={20}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
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
    justifyContent: "flex-start", // Changed from "flex-end" to "flex-start"
  },
  blurOverlay: {
    flex: 1,
  },
  drawer: {
    width: 280,
    backgroundColor: "#FFFFFF",
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 }, // Changed from -4 to 4 for left-side shadow
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  headerSection: {
    backgroundColor: "#FF8C00",
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  profileSection: {
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileInitials: {
    fontSize: 32,
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
    backgroundColor: "#FF8C00",
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
  menuContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  menuContent: {
    paddingVertical: 8,
  },
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
    marginRight: 16,
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
  logoutContainer: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FAFAFA",
    paddingBottom: 20,
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
