import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useStripeWrapper } from '../stripWrapper';
import axiosInstance from '../../api/axios';
import {
  removeOrderItem,
  updateItemOptions,
  updateItemQuantity,
} from '../../components/redux/userSlice';

const generateFreshOrderNumber = () => {
  const prefix = 'DCS';
  const timestamp = Date.now().toString().slice(-6);
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${timestamp}${randomNum}`;
};

const generateTrackingId = () => {
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  return randomNum.toString();
};

export default function OrderSummaryApp() {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const authToken = useSelector((state) => state.auth?.token);
  const user = useSelector((state) => state.auth.user);
  const scheduling = useSelector((state) => state.user?.scheduling);
  const addresses = useSelector((state) => state.user?.addresses);

  const {
    initializedPaymentSheet,
    openPayment,
    loading: stripeLoading,
  } = useStripeWrapper();

  const paymentReadyRef = useRef(false);
  const [localPaymentReady, setLocalPaymentReady] = useState(false);

  const orderData = useSelector((state) => state.user?.order);

  const hasItems = useMemo(() => {
    return orderData?.items && orderData.items.length > 0;
  }, [orderData?.items]);

  const [showWashOnlyModal, setShowWashOnlyModal] = useState(false);
  const [showStarchLevelModal, setShowStarchLevelModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [globalPricing, setGlobalPricing] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedBookingId, setCompletedBookingId] = useState(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('debit');
  const [cardDetails, setCardDetails] = useState({
    holderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [orderNumber, setOrderNumber] = useState('');
  const [trackingId, setTrackingId] = useState('');

  useEffect(() => {
    if (!orderNumber) {
      const newOrderNumber = generateFreshOrderNumber();
      const newTrackingId = generateTrackingId();
      setOrderNumber(newOrderNumber);
      setTrackingId(newTrackingId);
    }
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log('=== DEBUG ===');
      console.log('Redux order exists:', !!orderData);
      console.log('Redux totalAmount:', orderData?.totalAmount || 0);
      console.log('Items count:', orderData?.items?.length || 0);
      console.log('Order Number:', orderNumber);
      console.log('Payment Ready (Hook):', localPaymentReady);
      console.log('=== END DEBUG ===');
    }
  }, [orderData?.totalAmount, orderNumber, localPaymentReady]);

  const washOnlyOptions = useMemo(
    () => [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    []
  );

  const starchLevelOptions = useMemo(
    () => [
      { label: 'None', value: 1 },
      { label: 'Light', value: 2 },
      { label: 'Medium', value: 3 },
      { label: 'Heavy', value: 4 },
    ],
    []
  );

  const DELIVERY_DISTANCE_KM = 10;

  const fetchGlobalPricing = useCallback(async () => {
    const defaultPricing = {
      deliveryChargePerKm: 25,
      serviceCharge: 0.15,
      platformFee: 2,
    };

    if (!authToken) {
      setGlobalPricing(defaultPricing);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:5000/api/users/admin/get-global-pricing',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const apiResponse = await response.json();
        if (apiResponse.success && apiResponse.data) {
          setGlobalPricing({
            deliveryChargePerKm: apiResponse.data.pricePerKm || 25,
            serviceCharge: 0.15,
            platformFee: 2,
          });
        } else {
          setGlobalPricing(defaultPricing);
        }
      } else {
        setGlobalPricing(defaultPricing);
      }
    } catch (error) {
      setGlobalPricing(defaultPricing);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchGlobalPricing();
  }, [fetchGlobalPricing]);

  const calculations = useMemo(() => {
    if (!orderData?.items || !globalPricing) {
      return {
        subtotal: 0,
        serviceFees: 0,
        deliveryCharge: 0,
        platformFee: 0,
        total: 0,
      };
    }

    const subtotal = orderData.items.reduce((sum, item) => {
      const price = parseFloat(String(item.price || 0));
      const quantity = parseInt(String(item.quantity || 0), 10);
      return sum + price * quantity;
    }, 0);

    const serviceFees = subtotal * globalPricing.serviceCharge;
    const deliveryCharge = globalPricing.deliveryChargePerKm * DELIVERY_DISTANCE_KM;
    const platformFee = globalPricing.platformFee;
    const total = subtotal + serviceFees + deliveryCharge + platformFee;

    return {
      subtotal,
      serviceFees,
      deliveryCharge,
      platformFee,
      total,
    };
  }, [orderData?.items, globalPricing]);

  const handlePayment = async () => {
    if (!orderData || !orderData.selectedCleaner) {
      Alert.alert(
        'Error',
        'Please select a dry cleaner and add items to your order'
      );
      return;
    }

    if (!scheduling) {
      Alert.alert('Error', 'Please schedule your pickup and delivery times');
      return;
    }

    const freshOrderNumber = generateFreshOrderNumber();
    const freshTrackingId = generateTrackingId();
    setOrderNumber(freshOrderNumber);
    setTrackingId(freshTrackingId);

    setPaymentLoading(true);
    setLocalPaymentReady(false);
    paymentReadyRef.current = false;

    let createdBookingId = null;
    let currentStep = '';

    try {
      currentStep = 'Building booking data';
      const monthMap = {
        January: 1,
        February: 2,
        March: 3,
        April: 4,
        May: 5,
        June: 6,
        July: 7,
        August: 8,
        September: 9,
        October: 10,
        November: 11,
        December: 12,
      };

    function buildISODate(date: string, month: string, time: string) {
  if (!date || !month || !time) return null;
  
  const monthMap = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let [hourStr, minuteStr] = time.replace(/AM|PM/i, '').split(':');
  let hours = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  const isPM = time.toUpperCase().includes('PM');

  if (isPM && hours < 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;

  const monthNum = monthMap[month];
  if (!monthNum) return null;

  const day = parseInt(date, 10);
  
  // Start with next year if month is before current month
  let year = currentYear;
  if (monthNum < currentMonth) {
    year = currentYear + 1;
  } else if (monthNum === currentMonth && day < now.getDate()) {
    // If same month but past day, use next year
    year = currentYear + 1;
  }
  
  // Create the date
  const jsDate = new Date(year, monthNum - 1, day, hours, minutes, 0, 0);
  
  // Double check it's in the future
  if (jsDate <= now) {
    // Add a year if still in past
    jsDate.setFullYear(jsDate.getFullYear() + 1);
  }
  
  return jsDate.toISOString();
}

      const scheduledPickupDateTime = buildISODate(
        scheduling?.pickupDate,
        scheduling?.pickupMonth,
        scheduling?.pickupTime
      );

      const scheduledDeliveryDateTime = buildISODate(
        scheduling?.deliveryDate,
        scheduling?.deliveryMonth,
        scheduling?.deliveryTime
      );

      if (!user?._id) {
        throw new Error('User ID is missing');
      }

      if (!orderData.selectedCleaner?._id) {
        throw new Error('Dry cleaner ID is missing');
      }

      if (!scheduledPickupDateTime || !scheduledDeliveryDateTime) {
        throw new Error('Invalid scheduling dates');
      }

      const bookingData = {
  user: user._id,
  dryCleaner: orderData.selectedCleaner._id,
  orderNumber: freshOrderNumber,
  Tracking_ID: freshTrackingId,
  pickupAddress: addresses?.home?.fullAddress || 'Default pickup address',
  dropoffAddress: addresses?.office?.fullAddress || 
                 addresses?.home?.fullAddress || 
                 'Default dropoff address',
  distance: 10,
  time: 30,
  price: Number(calculations.total) || 0,
  
  // FIX 1: ADD THIS - deliveryCharge at top level (required by schema)
  deliveryCharge: Number(calculations.deliveryCharge) || 0,
  
  status: 'pending',
  bookingType: 'pickup',
  message: `Order ${freshOrderNumber} for ${orderData.items.length} items from ${orderData.selectedCleaner.shopname}`,
  
  // Order items
  orderItems: orderData.items.map(item => ({
    itemId: item._id || '',
    name: item.name || '',
    category: item.category || 'general',
    quantity: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
    starchLevel: Math.min(Number(item.starchLevel) || 3, 4),
    washOnly: Boolean(item.washOnly),
    options: item.options || {},
    additionalservice: item.additionalservice || '',
  })),
  
  // Pricing object
  pricing: {
    subtotal: Number(calculations.subtotal) || 0,
    serviceFees: Number(calculations.serviceFees) || 0,
    deliveryCharge: Number(calculations.deliveryCharge) || 0,
    platformFee: Number(calculations.platformFee) || 0,
    totalAmount: Number(calculations.total) || 0,
  },
  
  // Payment info
  paymentMethod: paymentMethod.toUpperCase(),
  paymentStatus: 'pending',
  
  // Scheduling
  isScheduled: true,
  scheduledPickupDateTime,
  scheduledDeliveryDateTime,
  
  // Timestamp
  requestedAt: new Date().toISOString(),
};

      // Add validation before the booking creation
currentStep = 'Validating booking data';

// Validate required fields
const validationErrors = [];

if (!user?._id) validationErrors.push('User ID is missing');
if (!orderData.selectedCleaner?._id) validationErrors.push('Dry cleaner ID is missing');
if (!scheduledPickupDateTime) validationErrors.push('Scheduled pickup date/time is invalid');
if (!scheduledDeliveryDateTime) validationErrors.push('Scheduled delivery date/time is invalid');

// Check if dates are in the future
const now = new Date();
if (scheduledPickupDateTime && new Date(scheduledPickupDateTime) <= now) {
  validationErrors.push('Scheduled pickup date must be in the future');
}
if (scheduledDeliveryDateTime && new Date(scheduledDeliveryDateTime) <= new Date(scheduledPickupDateTime)) {
  validationErrors.push('Scheduled delivery date must be after pickup date');
}

if (!orderData.items || orderData.items.length === 0) {
  validationErrors.push('No items in order');
}

// Check for deliveryCharge
if (!calculations.deliveryCharge && calculations.deliveryCharge !== 0) {
  validationErrors.push('Delivery charge is required');
}

if (validationErrors.length > 0) {
  console.error('Validation errors:', validationErrors);
  throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
}

// Log the validated data
console.log('✅ Validated booking data:', {
  deliveryCharge: calculations.deliveryCharge,
  scheduledPickupDateTime: new Date(scheduledPickupDateTime).toISOString(),
  scheduledDeliveryDateTime: new Date(scheduledDeliveryDateTime).toISOString(),
  isPickupInFuture: new Date(scheduledPickupDateTime) > now,
  isDeliveryAfterPickup: new Date(scheduledDeliveryDateTime) > new Date(scheduledPickupDateTime),
});

      currentStep = 'Creating booking';
      let bookingResponse;
      try {
        console.log("📦 Booking Payload Sent:", bookingData);
        bookingResponse = await axiosInstance.post(
          '/users/create',
          bookingData,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );
      } catch (bookingError) {
        console.error('❌ Booking creation failed:', bookingError);
        throw new Error(`Booking creation failed: ${bookingError.message}`);
      }

      if (!bookingResponse.data.success) {
        throw new Error(bookingResponse.data.message || 'Failed to create booking');
      }

      const createdBooking = bookingResponse.data.data;
      createdBookingId = createdBooking._id;
      setCompletedBookingId(createdBooking._id);

      currentStep = 'Creating payment intent';
      let paymentIntentResponse;
      try {
        paymentIntentResponse = await axiosInstance.post(
          '/users/payment-intent',
          {
            bookingId: createdBooking._id,
            orderNumber: freshOrderNumber,
            amount: Math.round(calculations.total * 100),
            currency: 'usd',
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (paymentError) {
        console.error('❌ Payment intent creation failed:', paymentError);
        throw new Error(`Payment initialization failed: ${paymentError.message}`);
      }

      if (!paymentIntentResponse.data.success) {
        throw new Error('Failed to create payment intent');
      }

      const { paymentIntent, ephemeralKey, customerId, paymentIntentId } =
        paymentIntentResponse.data.data;

      currentStep = 'Initializing payment sheet';
      if (!paymentIntent || !ephemeralKey || !customerId) {
        throw new Error('Missing required payment data from server');
      }

      const initialized = await initializedPaymentSheet(
        paymentIntent,
        ephemeralKey,
        customerId,
        paymentIntentId
      );

      if (!initialized) {
        throw new Error('Failed to initialize payment sheet');
      }

      setLocalPaymentReady(true);
      paymentReadyRef.current = true;

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!paymentReadyRef.current) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!paymentReadyRef.current) {
          throw new Error('Payment sheet failed to become ready');
        }
      }

      currentStep = 'Opening payment sheet';
      let paymentResult;
      try {
        paymentResult = await openPayment();
      } catch (paymentOpenError) {
        console.error('❌ Error opening payment sheet:', paymentOpenError);
        throw new Error(`Failed to open payment sheet: ${paymentOpenError.message}`);
      }

      if (paymentResult === true) {
        currentStep = 'Confirming payment';
        let confirmResponse;
        try {
          confirmResponse = await axiosInstance.post(
            '/users/confirm-payment',
            {
              bookingId: createdBooking._id,
              orderNumber: freshOrderNumber,
              paymentIntentId: paymentIntentId || paymentIntent,
            },
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (confirmError) {
          console.error('❌ Payment confirmation failed:', confirmError);
          throw new Error(`Payment confirmation failed: ${confirmError.message}`);
        }

        if (confirmResponse.data.success) {
          setShowPaymentModal(false);
          setShowSuccessModal(true);
          console.log('✅ Payment completed successfully for order:', freshOrderNumber);
        } else {
          throw new Error('Payment confirmation failed');
        }
      } else if (paymentResult === false) {

        await handleBookingCancellation(createdBookingId, freshOrderNumber);
        Alert.alert(
          'Payment Cancelled',
          `Payment was cancelled for order ${freshOrderNumber}. Your booking has been cancelled.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Payment result unclear');
      }
    } catch (err) {
      console.error('❌ Payment error at step:', currentStep, err);
      
      if (createdBookingId) {
        await handleBookingCancellation(
          createdBookingId,
          freshOrderNumber,
          `Payment failed at: ${currentStep}`
        );
      }

      if (!err.message.includes('cancelled by user')) {
        let errorMessage = 'Payment failed. Please try again.';
        Alert.alert(
          'Payment Failed',
          `${errorMessage}\n\nOrder: ${freshOrderNumber}\nStep: ${currentStep}`
        );
      }
    } finally {
      setPaymentLoading(false);
      setLocalPaymentReady(false);
      paymentReadyRef.current = false;
    }
  };

const handleBookingCancellation = async (
  bookingId: string, 
  orderNumber: string, 
  reason = 'Payment cancelled by user'
) => {
  console.log('🔄 Attempting to cancel booking:', bookingId);
  
  try {
    // CRITICAL FIX: Don't add extra slash, axiosInstance already has baseURL
    // baseURL is: http://YOUR_IP:5000/api/users
    // So just use the route pattern directly
    const response = await axiosInstance.post(
      `/users/${bookingId}/cancel`,  // This becomes /api/users/{bookingId}/cancel
      { 
        orderNumber, 
        reason 
      },
      {
        timeout: 10000,
      }
    );

    console.log('✅ Cancellation response:', response.data);

    if (response.data?.success) {
      console.log('✅ Booking cancelled successfully');
      return true;
    } else {
      console.log('⚠️ Cancellation failed but got response');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Booking cancellation failed:', error.message);
    
    if (error.response) {
      console.error('Error details:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
        fullUrl: error.config?.baseURL + error.config?.url,
      });
    }
    
    // Don't block the flow - payment already failed
    return false;
  }
};



  const toggleOption = useCallback(
    (itemId, optionName) => {
      const item = orderData?.items.find(i => i._id === itemId);
      if (item) {
        const newOptions = {
          ...item.options,
          [optionName]: !item.options[optionName],
        };
        dispatch(
          updateItemOptions({
            itemId: itemId,
            options: newOptions,
            itemName: item.name,
          })
        );
      }
    },
    [orderData?.items, dispatch]
  );

  const deleteItem = useCallback(
    (id) => {
      const item = orderData?.items.find(i => i._id === id);
      Alert.alert(
        'Remove Item',
        `Are you sure you want to remove "${item?.name || 'this item'}" from your order?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              dispatch(removeOrderItem(id));
              Alert.alert(
                'Item Removed',
                `${item?.name || 'Item'} has been removed from your order.`,
                [{ text: 'OK' }]
              );
            },
          },
        ],
        { cancelable: true }
      );
    },
    [dispatch, orderData?.items]
  );

  const updateWashOnly = useCallback(
    (value) => {
      if (selectedItemId) {
        const item = orderData?.items.find(i => i._id === selectedItemId);
        dispatch(
          updateItemOptions({
            itemId: selectedItemId,
            washOnly: value,
            itemName: item?.name,
          })
        );
        setShowWashOnlyModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId, dispatch, orderData?.items]
  );

  const updateStarchLevel = useCallback(
    (value) => {
      if (!selectedItemId) return;
      const itemList = orderData?.items ?? [];
      const item = itemList.find(i => i._id === selectedItemId);
      if (item) {
        dispatch(
          updateItemOptions({
            itemId: selectedItemId,
            starchLevel: value,
            itemName: item.name,
          })
        );
      }
      setShowStarchLevelModal(false);
      setSelectedItemId(null);
    },
    [selectedItemId, dispatch, orderData]
  );

  const updateQuantity = useCallback(
    (itemId, newQuantity) => {
      const item = orderData?.items.find(i => i._id === itemId);
      if (!item) return;
      const validQuantity = Math.max(0, Math.floor(newQuantity));
      if (validQuantity === 0) {
        Alert.alert(
          'Remove Item?',
          `Setting quantity to 0 will remove "${item.name}" from your order. Continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Remove Item',
              style: 'destructive',
              onPress: () => {
                dispatch(removeOrderItem(itemId));
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        dispatch(
          updateItemQuantity({
            itemId,
            quantity: validQuantity,
            itemName: item.name,
          })
        );
      }
    },
    [dispatch, orderData?.items]
  );

  const incrementQuantity = useCallback(
    (itemId) => {
      const item = orderData?.items.find(i => i._id === itemId);
      if (!item) return;
      const currentQuantity = parseInt(String(item.quantity || 0), 10);
      const newQuantity = currentQuantity + 1;
      dispatch(
        updateItemQuantity({
          itemId,
          quantity: newQuantity,
          itemName: item.name,
        })
      );
    },
    [orderData?.items, dispatch]
  );

  const decrementQuantity = useCallback(
    (itemId) => {
      const item = orderData?.items.find(i => i._id === itemId);
      if (!item) return;
      const currentQuantity = parseInt(String(item.quantity || 0), 10);
      if (currentQuantity <= 1) {
        Alert.alert(
          'Remove Item?',
          `This will remove "${item.name}" from your order. Continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                dispatch(removeOrderItem(itemId));
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        const newQuantity = currentQuantity - 1;
        dispatch(
          updateItemQuantity({
            itemId,
            quantity: newQuantity,
            itemName: item.name,
          })
        );
      }
    },
    [orderData?.items, dispatch]
  );

  const getItemTotal = useCallback((item) => {
    const price = parseFloat(String(item.price || 0));
    const quantity = parseInt(String(item.quantity || 0), 10);
    if (isNaN(price) || isNaN(quantity)) return 0;
    return price * quantity;
  }, []);

  const getStarchLevelText = useCallback((level) => {
    switch (level) {
      case 1:
        return 'None';
      case 2:
        return 'Light';
      case 3:
        return 'Medium';
      case 4:
        return 'Heavy';
      default:
        return 'Medium';
    }
  }, []);

  // FIXED: Updated renderAddressText to safely handle cleaner address object
  const renderAddressText = useCallback((address) => {
    if (!address) return 'No address provided';
    
    // If address is a string, return it
    if (typeof address === 'string') {
      return address.trim() || 'No address provided';
    }
    
    // If address is an object (like your cleaner address object)
    if (typeof address === 'object' && address !== null) {
      // Handle your cleaner address structure
      if (address.street || address.city) {
        const street = address.street || '';
        const city = address.city || '';
        const state = address.state || '';
        const country = address.country || '';
        
        // Build address parts
        const parts = [];
        if (street) parts.push(street);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (country) parts.push(country);
        
        return parts.join(', ') || 'No address provided';
      }
      
      // If it has a fullAddress property (like user addresses)
      if (address.fullAddress) {
        return address.fullAddress.trim() || 'No address provided';
      }
    }
    
    return 'No address provided';
  }, []);

  // FIXED: RadioButton component with proper prop handling
  const RadioButton = ({ selected, onPress, label }) => {
    if (!label) return null;
    
    return (
      <TouchableOpacity style={styles.radioContainer} onPress={onPress}>
        <View style={[styles.radioButton, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
        {label && <Text style={styles.radioLabel}>{label}</Text>}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading order summary...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7FA" />
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={35} color="#FF8C00" />
        </TouchableOpacity>
        <Text style={styles.title}>Order Summary</Text>
      </View>

      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>Order Sub-Total</Text>
        <TouchableOpacity>
          <Text style={styles.subtitle2}>ORDER</Text>
        </TouchableOpacity>
      </View>

      {orderNumber ? (
        <View style={styles.orderNumberCard}>
          <Text style={styles.orderNumberLabel}>PAY FOR</Text>
          <Text style={styles.orderNumberValue}>#{orderNumber}</Text>
        </View>
      ) : null}

      {orderData?.selectedCleaner ? (
        <View style={styles.cleanerInfoCard}>
          <Text style={styles.cleanerName}>
            {orderData.selectedCleaner.shopname || 'Unknown Cleaner'}
          </Text>
          <Text style={styles.cleanerAddress}>
            {renderAddressText(orderData.selectedCleaner.address)}
          </Text>
          {orderData.selectedCleaner.rating ? (
            <Text style={styles.cleanerRating}>
              {`Rating: ${String(orderData.selectedCleaner.rating)}★`}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!hasItems ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items in your order</Text>
          <TouchableOpacity
            style={styles.addItemsButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.addItemsButtonText}>Add Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.itemsContainer}
            showsVerticalScrollIndicator={false}>
            {orderData?.items?.map(item => (
              <View key={item._id || item.name} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemNameContainer}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name || 'Unknown Item'}
                    </Text>
                    <Text style={styles.itemSubtotal}>
                      Total: ${getItemTotal(item).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.priceQuantityContainer}>
                    <Text style={styles.itemPrice}>
                      ${parseFloat(String(item.price || 0)).toFixed(2)} each
                    </Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={[
                          styles.quantityButton,
                          parseInt(String(item.quantity || 0)) <= 1 &&
                            styles.quantityButtonDisabled,
                        ]}
                        onPress={() => decrementQuantity(item._id)}
                        activeOpacity={0.7}
                        disabled={parseInt(String(item.quantity || 0)) <= 0}>
                        <Text
                          style={[
                            styles.quantityButtonText,
                            parseInt(String(item.quantity || 0)) <= 1 &&
                              styles.quantityButtonTextDisabled,
                          ]}>
                          −
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>
                        {parseInt(String(item.quantity || 0))}
                      </Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => incrementQuantity(item._id)}
                        activeOpacity={0.7}>
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.optionsContainer}>
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => {
                        setSelectedItemId(item._id);
                        setShowWashOnlyModal(true);
                      }}>
                      <Text style={styles.dropdownText}>
                        Wash Only: {item.washOnly ? 'Yes' : 'No'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => {
                        setSelectedItemId(item._id);
                        setShowStarchLevelModal(true);
                      }}>
                      <Text style={styles.dropdownText}>
                        Starch Level: {getStarchLevelText(item.starchLevel || 3)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.checkboxContainer}>
                    {item.options?.zipper !== undefined ? (
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          item.options.zipper && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleOption(item._id, 'zipper')}>
                        <View style={styles.checkboxInner}>
                          {item.options.zipper ? (
                            <Text style={styles.checkmark}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={styles.checkboxText}>Zipper</Text>
                      </TouchableOpacity>
                    ) : null}
                    {item.options?.button !== undefined ? (
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          item.options.button && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleOption(item._id, 'button')}>
                        <View style={styles.checkboxInner}>
                          {item.options.button ? (
                            <Text style={styles.checkmark}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={styles.checkboxText}>Button</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        item.options?.washAndFold && styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, 'washAndFold')}>
                      <View style={styles.checkboxInner}>
                        {item.options?.washAndFold ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : null}
                      </View>
                      <Text style={styles.checkboxText}>Wash & Fold</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteItem(item._id)}
                    activeOpacity={0.7}>
                    <MaterialIcons name="delete" size={20} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sub Total</Text>
              <Text style={styles.summaryValue}>
                ${calculations?.subtotal?.toFixed(2) ?? '0.00'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Service Fees ({((globalPricing?.serviceCharge ?? 0.15) * 100).toFixed(0)}%)
              </Text>
              <Text style={styles.summaryValue}>
                ${calculations?.serviceFees?.toFixed(2) ?? '0.00'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery Charge ({DELIVERY_DISTANCE_KM}km @ $
                {globalPricing?.deliveryChargePerKm ?? 25}/km)
              </Text>
              <Text style={styles.summaryValue}>
                ${calculations?.deliveryCharge?.toFixed(2) ?? '0.00'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee</Text>
              <Text style={styles.summaryValue}>
                ${calculations?.platformFee?.toFixed(2) ?? '0.00'}
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Payment</Text>
              <Text style={styles.totalValue}>
                ${calculations?.total?.toFixed(2) ?? '0.00'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => setShowPaymentModal(true)}>
              <Text style={styles.continueButtonText}>Place Your Order</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.paymentModalContainer}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentModalHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowPaymentModal(false)}>
                <MaterialIcons name="arrow-back" size={24} color="#FF8C00" />
              </TouchableOpacity>
              <Text style={styles.paymentModalTitle}>Add card</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.paymentScrollView}>
              <Text style={styles.sectionLabel}>Card information</Text>
              <View style={styles.cardInputContainer}>
                <TextInput
                  style={styles.cardNumberInput}
                  placeholder="Card number"
                  placeholderTextColor="#9ca3af"
                  value={cardDetails.cardNumber}
                  onChangeText={text =>
                    setCardDetails({ ...cardDetails, cardNumber: text })
                  }
                  keyboardType="numeric"
                />
                <View style={styles.cardLogos}>
                  <Text style={styles.cardLogo}>VISA</Text>
                  <Text style={styles.cardLogo}>MC</Text>
                  <Text style={styles.cardLogo}>AMEX</Text>
                  <Text style={styles.cardLogo}>JCB</Text>
                </View>
              </View>

              <View style={styles.expiryAndCvcRow}>
                <TextInput
                  style={[styles.cardInput, styles.expiryInput]}
                  placeholder="MM / YY"
                  placeholderTextColor="#9ca3af"
                  value={cardDetails.expiry}
                  onChangeText={text =>
                    setCardDetails({ ...cardDetails, expiry: text })
                  }
                  keyboardType="numeric"
                />
                <View style={styles.cvcContainer}>
                  <TextInput
                    style={styles.cvcInput}
                    placeholder="CVC"
                    placeholderTextColor="#9ca3af"
                    value={cardDetails.cvv}
                    onChangeText={text =>
                      setCardDetails({ ...cardDetails, cvv: text })
                    }
                    keyboardType="numeric"
                    secureTextEntry
                  />
                  <MaterialIcons name="credit-card" size={16} color="#666" />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Billing address</Text>
              <View style={styles.billingAddressContainer}>
                <View style={styles.countrySelector}>
                  <Text style={styles.countryText}>United States</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </View>
                <TextInput
                  style={styles.zipInput}
                  placeholder="ZIP Code"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.cardTypeContainer}>
                <RadioButton
                  selected={paymentMethod === 'debit'}
                  onPress={() => setPaymentMethod('debit')}
                  label="Debit Card"
                />
                <RadioButton
                  selected={paymentMethod === 'credit'}
                  onPress={() => setPaymentMethod('credit')}
                  label="Credit Card"
                />
              </View>

              <TouchableOpacity style={styles.saveDetailsContainer}>
                <View style={styles.checkbox}>
                  <View style={styles.checkboxInner} />
                </View>
                <Text style={styles.saveDetailsText}>
                  Save payment details to Vervoer Pvt. Lmt. for future purchases
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.payButton,
                paymentLoading && styles.disabledButton,
              ]}
              activeOpacity={0.8}
              onPress={handlePayment}
              disabled={paymentLoading}>
              {paymentLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.loadingText}>Processing...</Text>
                </View>
              ) : (
                <View style={styles.payButtonContent}>
                  <Text style={styles.payButtonText}>
                    Pay ${calculations?.total?.toFixed(2) ?? '0.00'}
                  </Text>
                  <MaterialIcons name="lock" size={16} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successModalContent}>
              <View style={styles.successIconContainer}>
                <View style={styles.successIcon}>
                  <MaterialIcons name="check" size={28} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.successTitle}>Submitted Successfully</Text>
              <Text style={styles.successSubtitle}>
                Your Order #{orderNumber} Is Completed
              </Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Navigate to receipt page
                  navigation.navigate('OrderReceiptPage', {
                    orderId: completedBookingId,
                    orderNumber: orderNumber,
                    trackingId: trackingId,
                    totalAmount: calculations.total,
                    orderData: {
                      items: orderData?.items,
                      cleaner: orderData?.selectedCleaner,
                      addresses: addresses,
                      scheduling: scheduling,
                    },
                  });
                }}>
                <Text style={styles.successButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWashOnlyModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Wash Only</Text>
            {washOnlyOptions.map(option => (
              <TouchableOpacity
                key={String(option.value)}
                style={styles.modalOption}
                onPress={() => updateWashOnly(option.value)}>
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowWashOnlyModal(false);
                setSelectedItemId(null);
              }}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStarchLevelModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starch Level</Text>
            {starchLevelOptions.map(option => (
              <TouchableOpacity
                key={String(option.value)}
                style={styles.modalOption}
                onPress={() => updateStarchLevel(option.value)}>
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowStarchLevelModal(false);
                setSelectedItemId(null);
              }}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7FA',
    paddingTop: 60,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 40,
    top: 29,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '400',
    color: '#000000',
    marginLeft: 15,
  },
  subtitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: -20,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#707070',
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C00',
  },
  orderNumberCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4B5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#666',
  },
  orderNumberValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF8C00',
    letterSpacing: 1,
  },
  cleanerInfoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cleanerAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cleanerRating: {
    fontSize: 14,
    color: '#F99026',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  addItemsButton: {
    backgroundColor: '#F99026',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  addItemsButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -10,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 5,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F99026',
  },
  priceQuantityContainer: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F99026',
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginHorizontal: 2,
  },
  quantityButtonDisabled: {
    backgroundColor: '#F0F0F0',
    shadowOpacity: 0.05,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  quantityButtonTextDisabled: {
    color: '#999',
  },
  quantityText: {
    fontSize: 16,
    color: '#333',
    marginHorizontal: 15,
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  optionsContainer: {
    gap: 15,
    position: 'relative',
  },
  dropdownContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdown: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownText: {
    color: '#666',
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    minHeight: 40,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  checkmark: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    color: '#666',
    fontSize: 14,
  },
  deleteButton: {
    position: 'absolute',
    right: 20,
    top: 55,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summary: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 10,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#F99026',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 10,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F99026',
    textAlign: 'right',
  },
  continueButton: {
    backgroundColor: '#F99026',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#F99026',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  paymentModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    marginRight: 15,
  },
  paymentModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  paymentScrollView: {
    paddingHorizontal: 20,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    color: '#CCC',
    marginBottom: 15,
    marginTop: 10,
  },
  cardInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  cardNumberInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 8,
  },
  cardLogos: {
    flexDirection: 'row',
    gap: 8,
  },
  cardLogo: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiryAndCvcRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  cardInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: '#FFF',
    fontSize: 16,
  },
  expiryInput: {
    flex: 1,
  },
  cvcContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  cvcInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 3,
  },
  billingAddressContainer: {
    gap: 15,
    marginBottom: 20,
  },
  countrySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  countryText: {
    color: '#FFF',
    fontSize: 16,
  },
  zipInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: '#FFF',
    fontSize: 16,
  },
  cardTypeContainer: {
    flexDirection: 'row',
    marginBottom: 25,
    gap: 30,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#FF8C00',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF8C00',
  },
  radioLabel: {
    fontSize: 16,
    color: '#FFF',
  },
  saveDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  saveDetailsText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  payButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 18,
    marginHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#555',
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalCloseButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FF4757',
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContainer: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  successModalContent: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 25,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  successButton: {
    backgroundColor: '#FF8C00',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 40,
    minWidth: 100,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});