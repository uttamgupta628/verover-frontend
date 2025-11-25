import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import SplashScreen from '../components/SplashScreen';
import { useAppSelector } from '../components/redux/hooks';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Wait for auth state to be loaded
    if (loading) return;

    const timer = setTimeout(() => {
      // Navigate based on authentication status
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }, 3000); // Reduced to 3 seconds for better UX

    return () => clearTimeout(timer);
  }, [loading, isAuthenticated]);

  return <SplashScreen />;
}