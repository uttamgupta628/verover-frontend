import React, { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Badge, IconButton } from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import colors from "../assets/color";
import { images } from "../assets/images/images";
import { setProfileImage } from "../components/redux/profileSlice";
import { RootState } from "../components/redux/store";
import NotificationView from "./NotificationView";
import ProfileDrawer from "./ProfileDrawer";
import SearchView from "./SearchView";
import WalletView from "./WalletView";

// EXPO-SPECIFIC IMPORTS
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axiosInstance from "../api/axios";

interface HeaderProps {
  renderContent?: () => React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ renderContent }) => {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const baseUrl = "https://vervoer-backend2.onrender.com/api";

  // Get auth data from Redux state
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { profileImage } = useSelector((state: RootState) => state.profile);

  const [isProfileDrawerVisible, setIsProfileDrawerVisible] = useState(false);
  const [activeView, setActiveView] = useState<
    "none" | "search" | "wallet" | "notifications"
  >("none");

  // Real unread count fetched from backend — NOT a prop
  const [unreadCount, setUnreadCount] = useState(0);

  // Don't render if we're on an auth screen
  const hideHeaderOnScreens = [
    "index",
    "splash",
    "onboarding",
    "login",
    "signup",
    "forgot-password",
    "forgot-success",
    "forgot-reset-password",
    "email-otp",
    "EmailOTPSuccess",
  ];

  const shouldHideHeader = hideHeaderOnScreens.includes(segments[0] as string);

  // Fetch profile AND unread notification count every time the header gains focus
  useFocusEffect(
    useCallback(() => {
      if (shouldHideHeader) return;

      // ── Profile fetch ──────────────────────────────────────────────────────
      const fetchProfile = async () => {
        if (!token) return;
        try {
          const response = await fetch(`${baseUrl}/users/get-profile`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            // Fall back to Redux user data
            const fallback = user?.profileImage || user?.driveProfileImage;
            if (fallback && fallback !== profileImage) {
              dispatch(setProfileImage(fallback));
            }
            return;
          }

          const data = await response.json();
          const img = data?.data?.profileImage || data?.profileImage;
          if (response.ok && img) {
            dispatch(setProfileImage(img));
          } else {
            const fallback = user?.profileImage || user?.driveProfileImage;
            if (fallback && fallback !== profileImage) {
              dispatch(setProfileImage(fallback));
            }
          }
        } catch {
          const fallback = user?.profileImage || user?.driveProfileImage;
          if (fallback && fallback !== profileImage) {
            dispatch(setProfileImage(fallback));
          }
        }
      };

      // ── Unread notification count fetch ────────────────────────────────────
      // Backend route: GET /notifications  (axiosInstance auto-attaches Bearer token)
      const fetchUnreadCount = async () => {
        try {
          const response = await axiosInstance.get("notifications");
          const payload = response.data?.data ?? response.data;
          const list: any[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.notifications)
              ? payload.notifications
              : [];

          const count = list.filter((n: any) => !n.isRead).length;
          setUnreadCount(count);
        } catch {
          // Silently fail — don't show stale or wrong count
          setUnreadCount(0);
        }
      };

      fetchProfile();
      fetchUnreadCount();
    }, [token, user, profileImage, dispatch, shouldHideHeader]),
  );

  if (shouldHideHeader) {
    return null;
  }

  const isOverlayActive = activeView !== "none";

  const getNotificationBadgeText = (count: number): string => {
    return count > 9 ? "9+" : count.toString();
  };

  const handleViewChange = async (
    view: "none" | "search" | "wallet" | "notifications",
  ): Promise<void> => {
    await Haptics.selectionAsync();
    setActiveView((prevView) => (prevView === view ? "none" : view));
  };

  const handleCloseView = (): void => {
    setActiveView("none");
  };

  // When the user closes the NotificationView, re-fetch the count
  // so the badge immediately reflects any reads/deletes they performed
  const handleNotificationsClose = async (): Promise<void> => {
    handleCloseView();
    try {
      const response = await axiosInstance.get("notifications");
      const payload = response.data?.data ?? response.data;
      const list: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : [];
      setUnreadCount(list.filter((n: any) => !n.isRead).length);
    } catch {
      setUnreadCount(0);
    }
  };

  const renderActiveContent = () => {
    switch (activeView) {
      case "search":
        return (
          <SearchView onClose={handleCloseView} onBack={handleCloseView} />
        );
      case "wallet":
        return <WalletView onBack={handleCloseView} />;
      case "notifications":
        return (
          <NotificationView
            onBack={handleNotificationsClose}
            onNavigate={(screen) => {
              handleCloseView();
              router.push(screen as any);
            }}
          />
        );
      default:
        return renderContent && renderContent();
    }
  };

  // Determine which profile image to use
  const getDisplayProfileImage = () => {
    if (profileImage) return { uri: profileImage };
    if (user?.driveProfileImage) return { uri: user.driveProfileImage };
    if (user?.profileImage) return { uri: user.profileImage };
    return images.profileImage;
  };

  return (
    <View
      style={[
        styles.container,
        isOverlayActive && styles.overlayContainer,
        { paddingTop: insets.top },
      ]}
    >
      {/* Header Bar */}
      {!isOverlayActive && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setIsProfileDrawerVisible(true)}
            style={styles.profileContainer}
          >
            <Image
              source={getDisplayProfileImage()}
              style={styles.profileImage}
              contentFit="cover"
              transition={300}
            />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image
              source={images.Logo}
              style={styles.logo}
              contentFit="contain"
              transition={300}
            />
          </View>

          <View style={styles.iconsContainer}>
            <IconButton
              icon="magnify"
              size={24}
              onPress={() => handleViewChange("search")}
              style={styles.icon}
              iconColor={colors.black}
            />
            <TouchableOpacity onPress={() => handleViewChange("wallet")}>
              <Image
                source={images.wallet}
                style={styles.iconImage}
                contentFit="contain"
                transition={300}
              />
            </TouchableOpacity>
            <View>
              <IconButton
                icon="bell-outline"
                size={24}
                onPress={() => handleViewChange("notifications")}
                style={styles.icon}
                iconColor={colors.black}
              />
              {/* Badge only renders when there are real unread notifications */}
              {unreadCount > 0 && (
                <Badge size={16} style={styles.badge}>
                  {getNotificationBadgeText(unreadCount)}
                </Badge>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Active Content View */}
      {isOverlayActive && (
        <View style={styles.content}>{renderActiveContent()}</View>
      )}

      {/* Profile Drawer */}
      <ProfileDrawer
        visible={isProfileDrawerVisible}
        onClose={() => setIsProfileDrawerVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
    width: "100%",
    backgroundColor: "transparent",
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    height: 70,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 10,
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  logoContainer: {
    flex: 1,
    alignItems: "flex-start",
    marginHorizontal: 16,
  },
  logo: {
    height: 40,
    width: "70%",
  },
  iconsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    margin: 0,
    marginLeft: 8,
  },
  iconImage: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 4,
    backgroundColor: colors.primary,
  },
});

export default Header;
