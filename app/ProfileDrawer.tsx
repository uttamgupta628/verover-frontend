import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import colors from '../assets/color';
import { useAppDispatch, useAppSelector } from '../components/redux/hooks';
import { logout } from '../components/redux/authSlice';
import { clearProfile } from '../components/redux/profileSlice';

// EXPO-SPECIFIC IMPORTS
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons'; 
import { useRouter } from 'expo-router';

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  visible,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const router = useRouter(); // Expo Router hook

  const { user: authUser, isAuthenticated } = useAppSelector(state => state.auth);
  const { firstName, lastName, profileImage } = useAppSelector(state => state.profile);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -300,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('User is logged out, navigating to Login...');
      router.replace('/login'); // Use router.replace instead of StackActions
    }
  }, [isAuthenticated, router]);

  const handleCloseWithHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const menuItems = [
    { icon: 'home', label: 'Home', route: '/userHome' }, // Use path strings
    { icon: 'user', label: 'My Profile', route: '/profile' },
    { icon: 'credit-card', label: 'Payment Methods', route: '/fareCard' },
    { icon: 'help-circle', label: 'Tips and Info', route: '/faq' },
    { icon: 'settings', label: 'Settings', route: '/settings' },
    { icon: 'lock', label: 'Reset Password', route: '/reset-password' },
  ];

  const handleNavigation = async (route: string) => {
    await Haptics.selectionAsync();
    router.push(route); // Use router.push instead of navigation.navigate
    onClose();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => Haptics.selectionAsync()
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            console.log('Logging out...');
            dispatch(logout());
            dispatch(clearProfile()); 
            router.replace('/login'); // Navigate to login after logout
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCloseWithHaptic}
      statusBarTranslucent
    >
      <BlurView
        intensity={80}
        tint="dark"
        style={[styles.overlay, { paddingTop: insets.top }]}
      >
        <TouchableOpacity 
          style={styles.overlayTouch} 
          onPress={handleCloseWithHaptic} 
          activeOpacity={1} 
        />
        
        <Animated.View style={[
          styles.drawer, 
          { 
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + 20,
          }
        ]}>
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FA']}
            style={styles.gradientBackground}
          >
            {/* Profile Section */}
            <View style={styles.profileSection}>
              {profileImage ? (
                <View style={styles.profileImageContainer}>
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileInitials}>
                      {firstName?.[0]?.toUpperCase() || 'G'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Feather name="user" size={40} color={colors.primary} />
                </View>
              )}
              
              <Text style={styles.profileName} numberOfLines={1}>
                {firstName && lastName ? `${firstName} ${lastName}` : 'Guest User'}
              </Text>
              
              <Text style={styles.profileEmail} numberOfLines={1}>
                {authUser?.email ?? 'No email available'}
              </Text>
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
                >
                  <View style={styles.menuIconContainer}>
                    <Feather
                      name={item.icon as any}
                      size={22}
                      color={item.label === 'Home' ? colors.primary : colors.darkGray}
                    />
                  </View>
                  <Text style={[
                    styles.menuText, 
                    item.label === 'Home' && styles.activeMenuText
                  ]}>
                    {item.label}
                  </Text>
                  <Feather 
                    name="chevron-right" 
                    size={18} 
                    color={colors.lightGray} 
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Logout Button */}
            <TouchableOpacity 
              onPress={handleLogout} 
              style={styles.logoutButton}
            >
              <View style={styles.menuIconContainer}>
                <Feather name="log-out" size={22} color={colors.error} />
              </View>
              <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  overlayTouch: {
    flex: 1,
  },
  drawer: {
    width: 300,
    backgroundColor: 'transparent',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  gradientBackground: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lightPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary + '20',
  },
  profileInitials: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primary,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
    textAlign: 'center',
    maxWidth: '100%',
  },
  profileEmail: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    maxWidth: '100%',
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.ultraLightGray,
  },
  menuIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: colors.darkGray,
    marginLeft: 10,
  },
  activeMenuText: {
    color: colors.primary,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    backgroundColor: 'rgba(248, 215, 218, 0.3)',
  },
  logoutText: {
    color: colors.error,
    fontWeight: '600',
  },
});

export default ProfileDrawer;