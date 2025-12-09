import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Provider } from 'react-redux';
import { store } from '../components/store';
import { useAppSelector, useAppDispatch } from '../components/redux/hooks';
import { initAuthFromStorage } from '../components/redux/authSlice';
import Header from './Header';
import { View } from 'react-native';
import StripeWrapper from './stripWrapper';

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, user } = useAppSelector((state) => state.auth);
  const [isRouterReady, setIsRouterReady] = useState(false);

  useEffect(() => {
    dispatch(initAuthFromStorage());
  }, []);

  useEffect(() => {
    if (!loading) {
      setIsRouterReady(true);
    }
  }, [loading]);

  useEffect(() => {
    if (loading || !isRouterReady) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const onAuthScreen = ['login', 'signup', 'forgot-password', 'forgot-reset-password', 'forgot-success', 'email-otp', 'EmailOTPSuccess'].includes(segments[0] as string);
    const onOnboarding = segments[0] === 'onboarding';
    const onSplash = segments.length === 0 || segments[0] === 'index' || segments[0] === 'splash';

    if (onSplash || onOnboarding) return;

    if (!isAuthenticated && inTabsGroup) {
      router.replace('/login');
    } else if (isAuthenticated && onAuthScreen) {
      // Redirect to appropriate home based on user type
      if (user?.userType === 'merchant') {
        router.replace('/merchantHome');
      } else if (user?.userType === 'driver') {
        router.replace('/driverHome');
      } else {
        // Default to user home
        router.replace('/userHome');
      }
    }
  }, [isAuthenticated, segments, loading, isRouterReady, user]);

  return <>{children}</>;
}

function RootLayoutNav() {
  // Move ALL hooks to the TOP before any conditional logic
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Now you can do conditional rendering
  if (!isReady) {
    return null;
  }

  // Check if we should hide header
  const hideHeaderScreens = [
    'login', 'signup', 'forgot-password', 'forgot-success', 
    'forgot-reset-password', 'email-otp', 'EmailOTPSuccess', 
    'onboarding', 'index', 'splash'
  ];
  
  const shouldShowHeader = !hideHeaderScreens.includes(segments[0] as string);

  return (
    <View style={{ flex: 1 }}>
      {shouldShowHeader && <Header notificationCount={3} />}
      
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="forgot-success" />
        <Stack.Screen name="forgot-reset-password" />
        <Stack.Screen name="email-otp" />
        <Stack.Screen name="EmailOTPSuccess" />
        <Stack.Screen name="userHome" />
        <Stack.Screen name="merchantHome" /> 
        <Stack.Screen name="driverHome" />
        
        {/* Driver Screens */}
        <Stack.Screen name="dryCleanerDriver/driverHistory" />
        <Stack.Screen name="QRCode" />
        <Stack.Screen name="RideTrackingLocate" />
        <Stack.Screen name="LocateDryCleaning1" />
        <Stack.Screen name="FoodDeliveryHome" />
        <Stack.Screen name="Vehicleinfo" />
        <Stack.Screen name="MicroMobility" />
        
        {/* Merchant Screens */}
        <Stack.Screen name="parkingMerchent/merchantParkinglotList" />
        <Stack.Screen name="parkingMerchent/registerParkingLot" />
        <Stack.Screen name="parkingMerchant/merchantGarageList" />
        <Stack.Screen name="parkingMerchant/merchantResidenceList" />
        <Stack.Screen name="merchant/dryClean" />
        <Stack.Screen name="merchant/merchantGarageForm" />
        <Stack.Screen name="merchant/merchantBookingHistoryScreen" />
        
        {/* Dry Cleaner User Screens */}
        <Stack.Screen name="dryCleanerUser/myOrder" />
        <Stack.Screen name="dryCleanerUser/allDrycleanerLocation" />
        <Stack.Screen name="dryCleanerUser/dryCleanersList" />
        <Stack.Screen name="dryCleanerUser/noOfItem" />
        <Stack.Screen name="dryCleanerUser/pickUpLocation" />
        <Stack.Screen name="dryCleanerUser/pickUpTimeDate" />
        <Stack.Screen name="dryCleanerUser/payment" />
        
        {/* Parking User Screens */}
        <Stack.Screen name="parkingUser/parking" />
        <Stack.Screen name="parkingUser/historyScreen" />
        <Stack.Screen name="parkingUser/LiveSessionScreen" />
        <Stack.Screen name="parkingUser/FindParking" />
        <Stack.Screen name="parkingUser/ParkingSlot" />
        <Stack.Screen name="parkingUser/payment" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <StripeWrapper>
        <AuthGuard>
          <RootLayoutNav />
        </AuthGuard>
      </StripeWrapper>
    </Provider>
  );
}