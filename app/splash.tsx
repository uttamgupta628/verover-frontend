import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import SplashScreen from '../components/SplashScreen';

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, []);

  return <SplashScreen />;
}