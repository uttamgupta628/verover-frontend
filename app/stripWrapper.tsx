import React, { useState, useCallback, useRef } from 'react';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

const STRIPE_KEY =
  Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY ||
  Constants.manifest?.extra?.STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_KEY) {
  console.error('❌ Stripe Publishable Key is missing in app.json');
}

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StripeProvider
      publishableKey={STRIPE_KEY}
      merchantIdentifier="merchant.com.vervoer"
      urlScheme="vervoer"
      setUrlSchemeOnAndroid
    >
      {children}
    </StripeProvider>
  );
}

export const useStripeWrapper = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const isReadyRef = useRef(false);

  const initializedPaymentSheet = useCallback(async (
    paymentIntent: string,
    ephemeralKeySecret: string,
    customer: string
  ) => {
    try {
      setLoading(true);
      isReadyRef.current = false;

      console.log('🔄 Initializing payment sheet');

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'Vervoer Pvt. Ltd.',
        paymentIntentClientSecret: paymentIntent,
        customerEphemeralKeySecret: ephemeralKeySecret,
        customerId: customer,
        allowsDelayedPaymentMethods: false,
      });

      if (error) {
        throw new Error(error.message);
      }

      isReadyRef.current = true;
      console.log('✅ Payment sheet ready');
      return true;

    } catch (error: any) {
      console.error('❌ Payment init failed:', error.message);
      Alert.alert('Payment Error', error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [initPaymentSheet]);

  const openPayment = useCallback(async () => {
    try {
      if (!isReadyRef.current) {
        throw new Error('Payment sheet not ready');
      }

      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === 'Canceled') return false;
        throw new Error(error.message);
      }

      console.log('✅ Payment Successful');
      return true;

    } catch (error: any) {
      Alert.alert('Payment Failed', error.message);
      return false;
    }
  }, [presentPaymentSheet]);

  const resetPaymentState = useCallback(() => {
    isReadyRef.current = false;
    setLoading(false);
  }, []);

  return {
    initializedPaymentSheet,
    openPayment,
    resetPaymentState,
    loading,
    isReadyForPayment: isReadyRef.current,
  };
};
