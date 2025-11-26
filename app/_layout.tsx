
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Provider } from 'react-redux';
import { store } from '../components/store';
import { useAppSelector, useAppDispatch } from '../components/redux/hooks';
import { initAuthFromStorage } from '../components/redux/authSlice';

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(initAuthFromStorage());
  }, []);

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const onAuthScreen = ['login', 'signup', 'forgot-password', 'forgot-reset-password', 'forgot-success', 'email-otp', 'EmailOTPSuccess'].includes(segments[0] as string);
    const onOnboarding = segments[0] === 'onboarding';
    const onSplash = segments.length === 0 || segments[0] === 'index' || segments[0] === 'splash';

    if (onSplash || onOnboarding) return;

    if (!isAuthenticated && inTabsGroup) {
      router.replace('/login');
    } else if (isAuthenticated && onAuthScreen) {
      router.replace('/userHome');
    }
  }, [isAuthenticated, segments, loading]);

  return <>{children}</>;
}

function RootLayoutNav() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
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
      <Stack.Screen name="EmailOTPSuccess"  />
      <Stack.Screen name="userHome" options={{ headerShown: false }} />
      <Stack.Screen name="dryCleanerUser/myOrder" options={{ headerShown: false }} />
      <Stack.Screen name="dryCleanerUser/allDrycleanerLocation" options={{ headerShown: false }} />
      <Stack.Screen name="dryCleanerUser/dryCleanersList" options={{ headerShown: false }} />
      <Stack.Screen name="dryCleanerUser/noOfItem" options={{ headerShown: false }} />
      <Stack.Screen name="dryCleanerUser/pickUpLocation" options={{ headerShown: false }} />
      <Stack.Screen name="dryCleanerUser/pickUpTimeDate" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <AuthGuard>
        <RootLayoutNav />
      </AuthGuard>
    </Provider>
  );
}