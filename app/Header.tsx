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
  
  const baseUrl = 'http://192.168.29.162:5000/api';

  // Get auth data from Redux state
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { profileImage } = useSelector((state: RootState) => state.profile);

  const [isProfileDrawerVisible, setIsProfileDrawerVisible] = useState(false);
  const [activeView, setActiveView] = useState<
    'none' | 'search' | 'wallet' | 'notifications'
  >('none');

  // Don't render if we're on an auth screen
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
        if (!token) {
          console.log('No token available, skipping profile fetch');
          return;
        }

        try {
          console.log('Fetching profile from:', `${baseUrl}/users/get-profile`);
          
          const response = await fetch(`${baseUrl}/users/get-profile`, {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          // Check content type before parsing
          const contentType = response.headers.get('content-type');
          
          if (!contentType || !contentType.includes('application/json')) {
            console.error('Server returned non-JSON response. Content-Type:', contentType);
            
            // If we have user data in Redux, use that profile image instead
            if (user) {
              const userProfileImage = user.profileImage || user.driveProfileImage;
              if (userProfileImage && userProfileImage !== profileImage) {
                console.log('Using profile image from Redux user data');
                dispatch(setProfileImage(userProfileImage));
              }
            }
            return;
          }

          const data = await response.json();
          
          if (response.ok && data?.data?.profileImage) {
            console.log('Profile image fetched successfully');
            dispatch(setProfileImage(data.data.profileImage));
          } else if (response.ok && data?.profileImage) {
            console.log('Profile image found in alternate location');
            dispatch(setProfileImage(data.profileImage));
          } else {
            console.log('No profile image in response, using user data from Redux');
            
            // Fallback to user data from Redux
            if (user) {
              const userProfileImage = user.profileImage || user.driveProfileImage;
              if (userProfileImage && userProfileImage !== profileImage) {
                dispatch(setProfileImage(userProfileImage));
              }
            }
          }
        } catch (error: any) {
          console.error('Header fetch profile error:', error.message);
          
          // Fallback: Use profile image from Redux user data
          if (user) {
            const userProfileImage = user.profileImage || user.driveProfileImage;
            if (userProfileImage && userProfileImage !== profileImage) {
              console.log('Using profile image from Redux user data (fallback)');
              dispatch(setProfileImage(userProfileImage));
            }
          }
        }
      };

      fetchProfile();
    }, [token, user, profileImage, dispatch, shouldHideHeader, baseUrl]),
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

  // Determine which profile image to use
  const getDisplayProfileImage = () => {
    // Priority: profileImage from Redux > user.driveProfileImage > user.profileImage > default
    if (profileImage) return { uri: profileImage };
    if (user?.driveProfileImage) return { uri: user.driveProfileImage };
    if (user?.profileImage) return { uri: user.profileImage };
    return images.profileImage;
  };

  return (
    <View style={[
      styles.container, 
      isOverlayActive && styles.overlayContainer,
      { paddingTop: insets.top }
    ]}>
      {/* Header Bar - Only show when not in overlay mode */}
      {!isOverlayActive && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setIsProfileDrawerVisible(true)}
            style={styles.profileContainer}>
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
        <View style={styles.content}>
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
    width: '100%',
    backgroundColor: 'transparent',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    height: 70,
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
