import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { IconButton, Badge } from 'react-native-paper';
import colors from '../assets/color';
import { images } from '../assets/images/images';
import ProfileDrawer from './ProfileDrawer';
import NotificationView from './NotifivationView';
import WalletView from './WalletView';
import SearchView from './SearchView';
import { responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../components/redux/store';
import { setProfileImage } from '../components/redux/profileSlice';

// EXPO-SPECIFIC IMPORTS
import { useRouter, useSegments, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

interface HeaderProps {
  notificationCount?: number;
  renderContent?: () => React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  notificationCount = 0,
  renderContent,
}) => {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  
  const baseUrl = 'https://vervoer-backend2.onrender.com';

  // Get auth token and profile image from Redux state
  const { token } = useSelector((state: RootState) => state.auth);
  const { profileImage } = useSelector((state: RootState) => state.profile);

  const [isProfileDrawerVisible, setIsProfileDrawerVisible] = useState(false);
  const [activeView, setActiveView] = useState<
    'none' | 'search' | 'wallet' | 'notifications'
  >('none');

  // Don't render if we're on an auth screen - CHECK THIS FIRST BEFORE HOOKS
  const hideHeaderOnScreens = [
    'index', 'splash', 'onboarding', 'login', 'signup', 
    'forgot-password', 'forgot-success', 'forgot-reset-password', 
    'email-otp', 'EmailOTPSuccess'
  ];

  const shouldHideHeader = hideHeaderOnScreens.includes(segments[0] as string);

  // Fetch profile on component focus to keep image updated
  useFocusEffect(
    useCallback(() => {
      if (shouldHideHeader) return; // Don't fetch if header is hidden

      const fetchProfile = async () => {
        if (!token) return;

        try {
          const response = await fetch(`${baseUrl}/api/users/get-profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const data = await response.json();
          if (response.ok && data?.data?.profileImage) {
            dispatch(setProfileImage(data.data.profileImage));
          }
        } catch (error) {
          console.error('Header fetch profile error:', error);
        }
      };

      fetchProfile();
    }, [token, dispatch, shouldHideHeader]),
  );

  if (shouldHideHeader) {
    return null;
  }

  const isOverlayActive = activeView !== 'none';

  const getNotificationBadgeText = (count: number): string => {
    return count > 9 ? '9+' : count.toString();
  };

  const handleViewChange = async (
    view: 'none' | 'search' | 'wallet' | 'notifications',
  ): Promise<void> => {
    await Haptics.selectionAsync();
    setActiveView(prevView => (prevView === view ? 'none' : view));
  };

  const handleCloseView = (): void => {
    setActiveView('none');
  };

  const renderActiveContent = () => {
    switch (activeView) {
      case 'search':
        return (
          <SearchView 
            onClose={handleCloseView} 
            onBack={handleCloseView} 
          />
        );
      case 'wallet':
        return <WalletView onBack={handleCloseView} />;
      case 'notifications':
        return (
          <NotificationView
            onBack={handleCloseView}
            onNavigate={screen => {
              handleCloseView();
              // Convert screen navigation to Expo Router format
              router.push(screen as any);
            }}
          />
        );
      default:
        return renderContent && renderContent();
    }
  };

  return (
    <View style={[
      styles.container, 
      isOverlayActive && styles.overlayContainer,
      { top: insets.top }
    ]}>
      {/* Header Bar - Only show when not in overlay mode */}
      {!isOverlayActive && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setIsProfileDrawerVisible(true)}
            style={styles.profileContainer}>
            <Image
              source={profileImage ? { uri: profileImage } : images.profileImage}
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
              onPress={() => handleViewChange('search')}
              style={styles.icon}
              iconColor={colors.black}
            />
            <TouchableOpacity onPress={() => handleViewChange('wallet')}>
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
                onPress={() => handleViewChange('notifications')}
                style={styles.icon}
                iconColor={colors.black}
              />
              {notificationCount > 0 && (
                <Badge size={16} style={styles.badge}>
                  {getNotificationBadgeText(notificationCount)}
                </Badge>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Active Content View */}
      {isOverlayActive && (
        <View style={[styles.content, { marginTop: insets.top }]}>
          {renderActiveContent()}
        </View>
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
    position: 'absolute',
    width: responsiveWidth(100),
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    height: responsiveHeight(100),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    height: 80,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'flex-start',
    marginHorizontal: 16,
  },
  logo: {
    height: 40,
    width: '70%',
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    position: 'absolute',
    top: 2,
    right: 4,
    backgroundColor: colors.primary,
  },
});

export default Header;