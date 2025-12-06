import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import axiosInstance from '../api/axios';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';

// Get Stripe key from Expo config
const STRIPE_KEY = Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY ||
                   Constants.manifest?.extra?.STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_KEY) {
  console.error('❌ STRIPE_PUBLISHABLE_KEY not found in app.json');
  console.error('Please add STRIPE_PUBLISHABLE_KEY to the "extra" section of your app.json');
}

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
    const [publicKey, setPublicKey] = useState<string>(STRIPE_KEY || '');
    const [loading, setLoading] = useState(!STRIPE_KEY);

    useEffect(() => {
        // If we already have a key from config, no need to fetch
        if (STRIPE_KEY) {
            console.log('✅ Using Stripe key from app.json');
            const keyMode = STRIPE_KEY.startsWith('pk_test_') ? 'TEST' : 
                           STRIPE_KEY.startsWith('pk_live_') ? 'LIVE' : 'UNKNOWN';
            console.log(`🔑 Stripe mode: ${keyMode}`);
            setPublicKey(STRIPE_KEY);
            setLoading(false);
            return;
        }

        // Fallback: fetch from server if no key in config
        const fetchPublicKey = async () => {
            try {
                console.log('🔄 Fetching Stripe public key from server...');
                const res = await axiosInstance.get('/getStripePublicKey');
                
                if (res.data?.data?.key) {
                    console.log('✅ Stripe public key fetched from server');
                    setPublicKey(res.data.data.key);
                } else {
                    throw new Error('No Public Key Found in server response');
                }
            } catch (error: any) {
                console.error('❌ Error fetching Stripe public key:', error);
                Alert.alert(
                    'Payment Configuration Error',
                    'Failed to load payment configuration. Please check your app.json.'
                );
            } finally {
                setLoading(false);
            }
        };

        fetchPublicKey();
    }, []);

    if (loading || !publicKey) {
        console.log('⏳ Waiting for Stripe key...');
        return null;
    }

    return (
        <StripeProvider
            publishableKey={publicKey}
            merchantIdentifier="com.vervoer" // Matches your app.json
            urlScheme="vervoer" // Matches your app.json scheme
        >
            {children}
        </StripeProvider>
    );
}

export const useStripeWrapper = () => {
    const { initPaymentSheet, presentPaymentSheet, confirmPayment } = useStripe();
    const [loading, setLoading] = useState(false);
    const [isReadyForPayment, setIsReadyForPayment] = useState(false);

    // CRITICAL FIX: Use refs to persist state across re-renders
    const paymentDataRef = useRef<{
        clientSecret: string;
        customerId: string;
        ephemeralKey: string;
        paymentIntentId: string;
        isInitialized: boolean;
    }>({
        clientSecret: '',
        customerId: '',
        ephemeralKey: '',
        paymentIntentId: '',
        isInitialized: false,
    });

    // Keep state variables for compatibility
    const [clientSecret, setClientSecret] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [ephemeralKey, setEphemeralKey] = useState('');
    const [paymentIntentId, setPaymentIntentId] = useState('');

    const initializedPaymentSheet = useCallback(async (
        paymentIntent: string,
        ephemeralKeySecret: string,
        customer: string,
        intentId?: string
    ): Promise<boolean> => {
        try {
            console.log('🔄 INITIALIZING PAYMENT SHEET');
            console.log('📱 Platform:', Platform.OS, Platform.Version);
            console.log('📱 Expo Version:', Constants.expoConfig?.version);
            console.log('🔍 Payment data received:', {
                hasPaymentIntent: !!paymentIntent,
                paymentIntentPrefix: paymentIntent?.substring(0, 10),
                hasEphemeralKey: !!ephemeralKeySecret,
                hasCustomer: !!customer,
                customerPrefix: customer?.substring(0, 10),
                intentId: intentId || 'not provided',
            });

            // Validate inputs
            if (!paymentIntent) {
                throw new Error('Payment intent client secret is required');
            }
            if (!ephemeralKeySecret) {
                throw new Error('Ephemeral key is required');
            }
            if (!customer) {
                throw new Error('Customer ID is required');
            }

            // Validate payment intent format (should start with "pi_" and contain "_secret_")
            if (!paymentIntent.includes('_secret_')) {
                console.error('❌ Invalid payment intent format:', paymentIntent.substring(0, 20));
                throw new Error('Invalid payment intent format - should contain client secret');
            }

            setLoading(true);
            setIsReadyForPayment(false);

            // CRITICAL: Store in ref FIRST (persists across re-renders)
            paymentDataRef.current = {
                clientSecret: paymentIntent,
                customerId: customer,
                ephemeralKey: ephemeralKeySecret,
                paymentIntentId: intentId || '',
                isInitialized: false,
            };

            // Also set state variables
            setClientSecret(paymentIntent);
            setCustomerId(customer);
            setEphemeralKey(ephemeralKeySecret);
            if (intentId) setPaymentIntentId(intentId);

            console.log('✅ Payment data stored in memory');

            // Initialize payment sheet
            console.log('🔄 Calling initPaymentSheet...');
            const initResult = await initPaymentSheet({
                merchantDisplayName: 'Vervoer Pvt. Ltd.',
                customerId: customer,
                paymentIntentClientSecret: paymentIntent,
                customerEphemeralKeySecret: ephemeralKeySecret,
                allowsDelayedPaymentMethods: false,
                returnURL: 'vervoer://stripe-redirect',
                appearance: {
                    colors: {
                        primary: '#FF8C00',
                        background: '#ffffff',
                        componentBackground: '#f8f9fa',
                        componentBorder: '#e3e3e3',
                        componentDivider: '#e3e3e3',
                        primaryText: '#1a1a1a',
                        secondaryText: '#8a8a8a',
                        componentText: '#1a1a1a',
                        placeholderText: '#a0a0a0'
                    },
                    shapes: {
                        borderRadius: 12,
                        borderWidth: 1,
                    },
                },
                primaryButtonLabel: "Pay Now",
            });

            console.log('🔍 initPaymentSheet result:', {
                hasError: !!initResult.error,
                errorCode: initResult.error?.code,
                errorMessage: initResult.error?.message,
            });

            if (initResult.error) {
                console.error('❌ Payment sheet initialization error:', {
                    code: initResult.error.code,
                    message: initResult.error.message,
                    type: initResult.error.type,
                    localizedMessage: initResult.error.localizedMessage,
                });
                
                // Reset on error
                paymentDataRef.current = {
                    clientSecret: '',
                    customerId: '',
                    ephemeralKey: '',
                    paymentIntentId: '',
                    isInitialized: false,
                };
                setClientSecret('');
                setCustomerId('');
                setEphemeralKey('');
                setPaymentIntentId('');
                
                const errorMessage = initResult.error.localizedMessage || 
                                   initResult.error.message || 
                                   'Failed to initialize payment';
                
                Alert.alert('Payment Setup Error', errorMessage);
                return false;
            }

            // Mark as successfully initialized
            paymentDataRef.current.isInitialized = true;
            setIsReadyForPayment(true);

            console.log('✅ Payment sheet initialized successfully');
            console.log('✅ Payment ready state set to TRUE');
            
            return true;

        } catch (error: any) {
            console.error('❌ Payment initialization exception:', {
                message: error.message,
                name: error.name,
                stack: error.stack?.split('\n')[0],
            });
            
            // Reset everything
            paymentDataRef.current = {
                clientSecret: '',
                customerId: '',
                ephemeralKey: '',
                paymentIntentId: '',
                isInitialized: false,
            };
            setClientSecret('');
            setCustomerId('');
            setEphemeralKey('');
            setPaymentIntentId('');
            setIsReadyForPayment(false);
            
            Alert.alert(
                'Payment Setup Error',
                error?.message || 'Failed to initialize payment. Please try again.'
            );
            return false;
        } finally {
            setLoading(false);
        }
    }, [initPaymentSheet]);

    const openPayment = useCallback(async (): Promise<boolean> => {
        try {
            console.log('📱 OPENING PAYMENT SHEET');
            console.log('⏰ Time:', new Date().toISOString());

            // Use ref data as primary source of truth
            const refData = paymentDataRef.current;
            
            console.log('🔍 Current state check:', {
                stateClientSecret: !!clientSecret,
                stateCustomerId: !!customerId,
                stateEphemeralKey: !!ephemeralKey,
                stateIsReady: isReadyForPayment,
                stateLoading: loading,
            });

            console.log('🔍 Ref state check (source of truth):', {
                refClientSecret: !!refData.clientSecret,
                refCustomerId: !!refData.customerId,
                refEphemeralKey: !!refData.ephemeralKey,
                refIsInitialized: refData.isInitialized,
            });

            // Check readiness using ref data
            const hasRefData = refData.clientSecret && 
                              refData.customerId && 
                              refData.ephemeralKey && 
                              refData.isInitialized;
            
            const hasStateData = clientSecret && 
                                customerId && 
                                ephemeralKey && 
                                isReadyForPayment;

            console.log('🔍 Readiness determination:', {
                hasRefData: !!hasRefData,
                hasStateData: !!hasStateData,
                willProceed: !!(hasRefData || hasStateData),
            });

            if (!hasRefData && !hasStateData) {
                console.error('❌ Payment sheet not ready');
                console.error('❌ Missing data:', {
                    clientSecret: !refData.clientSecret && !clientSecret,
                    customerId: !refData.customerId && !customerId,
                    ephemeralKey: !refData.ephemeralKey && !ephemeralKey,
                    initialized: !refData.isInitialized && !isReadyForPayment,
                });
                Alert.alert(
                    'Payment Not Ready',
                    'Payment sheet is not ready yet. Please wait a moment and try again.'
                );
                return false;
            }

            if (loading) {
                console.warn('⚠️ Still loading, waiting 1 second...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('💳 Presenting payment sheet to user...');
            const presentResult = await presentPaymentSheet();

            console.log('💳 presentPaymentSheet completed:', {
                hasError: !!presentResult.error,
                errorCode: presentResult.error?.code,
                errorMessage: presentResult.error?.message,
            });

            if (presentResult.error) {
                const error = presentResult.error;
                console.error('❌ Payment sheet presentation error:', {
                    code: error.code,
                    message: error.message,
                    type: error.type,
                    localizedMessage: error.localizedMessage,
                });

                // Handle different error codes
                switch (error.code) {
                    case 'Canceled':
                        console.log('ℹ️ User cancelled payment sheet');
                        return false;
                    
                    case 'Failed':
                        console.error('💥 Payment sheet failed:', error.message);
                        // Don't show alert for "Failed" with cancellation message
                        if (!error.message.toLowerCase().includes('cancel')) {
                            Alert.alert(
                                'Payment Failed',
                                error.localizedMessage || error.message || 'Payment failed'
                            );
                        }
                        return false;
                    
                    case 'Timeout':
                        console.error('⏰ Payment sheet timed out');
                        Alert.alert('Payment Timeout', 'Payment timed out. Please try again.');
                        return false;
                    
                    default:
                        console.error('🔥 Unknown payment error:', error.code);
                        Alert.alert(
                            'Payment Error',
                            error.localizedMessage || error.message || 'An error occurred during payment'
                        );
                        return false;
                }
            }

            console.log('✅ Payment completed successfully!');
            return true;

        } catch (error: any) {
            console.error('❌ Payment presentation exception:', {
                message: error.message,
                name: error.name,
                stack: error.stack?.split('\n')[0],
            });
            
            Alert.alert(
                'Payment Error',
                error?.message || 'Failed to present payment sheet. Please try again.'
            );
            return false;
        }
    }, [presentPaymentSheet, isReadyForPayment, loading, clientSecret, customerId, ephemeralKey]);

    const confirmMyPayment = useCallback(async (): Promise<boolean> => {
        try {
            const secretToUse = paymentDataRef.current.clientSecret || clientSecret;
            
            if (!secretToUse) {
                console.error('❌ No payment to confirm');
                Alert.alert('Payment Error', 'No payment to confirm');
                return false;
            }

            console.log('🔄 Confirming payment...');
            setLoading(true);

            const confirmResult = await confirmPayment(secretToUse);

            if (confirmResult.error) {
                console.error('❌ Payment confirmation error:', confirmResult.error);
                Alert.alert(
                    'Payment Confirmation Error',
                    confirmResult.error?.message || 'Failed to confirm payment'
                );
                return false;
            }

            console.log('✅ Payment confirmed successfully');
            return true;

        } catch (error: any) {
            console.error('❌ Payment confirmation exception:', error);
            Alert.alert(
                'Payment Error',
                error?.message || 'Payment confirmation failed. Please try again.'
            );
            return false;
        } finally {
            setLoading(false);
        }
    }, [confirmPayment, clientSecret]);

    const resetPaymentState = useCallback(() => {
        console.log('🔄 Resetting payment state...');
        
        paymentDataRef.current = {
            clientSecret: '',
            customerId: '',
            ephemeralKey: '',
            paymentIntentId: '',
            isInitialized: false,
        };
        
        setClientSecret('');
        setCustomerId('');
        setEphemeralKey('');
        setPaymentIntentId('');
        setIsReadyForPayment(false);
        setLoading(false);
        
        console.log('✅ Payment state reset completed');
    }, []);

    const debugPaymentState = useCallback(() => {
        const state = {
            timestamp: new Date().toISOString(),
            state: {
                clientSecret: !!clientSecret,
                customerId: !!customerId,
                ephemeralKey: !!ephemeralKey,
                paymentIntentId: !!paymentIntentId,
                isReadyForPayment: isReadyForPayment,
                loading: loading,
            },
            ref: {
                clientSecret: !!paymentDataRef.current.clientSecret,
                customerId: !!paymentDataRef.current.customerId,
                ephemeralKey: !!paymentDataRef.current.ephemeralKey,
                paymentIntentId: !!paymentDataRef.current.paymentIntentId,
                isInitialized: paymentDataRef.current.isInitialized,
            },
            platform: {
                os: Platform.OS,
                version: Platform.Version,
                expo: Constants.expoConfig?.version || 'Unknown',
                stripeKey: STRIPE_KEY?.substring(0, 10) + '...',
            },
        };
        
        console.log('🔍 PAYMENT STATE DEBUG:', state);
        return state;
    }, [clientSecret, customerId, ephemeralKey, paymentIntentId, isReadyForPayment, loading]);

    return {
        initializedPaymentSheet,
        openPayment,
        confirmMyPayment,
        resetPaymentState,
        debugPaymentState,
        loading,
        clientSecret,
        customerId,
        ephemeralKey,
        paymentIntentId,
        isReadyForPayment,
    };
};