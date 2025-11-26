import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { images } from '../../assets/images/images';
import { IconButton } from 'react-native-paper';
import colors from '../../assets/color';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserAddress, SavedAddress as ReduxSavedAddress } from '../../components/redux/userSlice';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LocalSavedAddress {
  _id?: string;
  type: 'home' | 'office';
  street: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
}

interface AvailableDriver {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  vehicleInfo: any;
  profileImage?: string;
  rating: number;
}

const US_STATES = [
  { isoCode: 'AL', name: 'Alabama' },
  { isoCode: 'AK', name: 'Alaska' },
  { isoCode: 'AZ', name: 'Arizona' },
  { isoCode: 'AR', name: 'Arkansas' },
  { isoCode: 'CA', name: 'California' },
  { isoCode: 'CO', name: 'Colorado' },
  { isoCode: 'CT', name: 'Connecticut' },
  { isoCode: 'DE', name: 'Delaware' },
  { isoCode: 'FL', name: 'Florida' },
  { isoCode: 'GA', name: 'Georgia' },
  { isoCode: 'HI', name: 'Hawaii' },
  { isoCode: 'ID', name: 'Idaho' },
  { isoCode: 'IL', name: 'Illinois' },
  { isoCode: 'IN', name: 'Indiana' },
  { isoCode: 'IA', name: 'Iowa' },
  { isoCode: 'KS', name: 'Kansas' },
  { isoCode: 'KY', name: 'Kentucky' },
  { isoCode: 'LA', name: 'Louisiana' },
  { isoCode: 'ME', name: 'Maine' },
  { isoCode: 'MD', name: 'Maryland' },
  { isoCode: 'MA', name: 'Massachusetts' },
  { isoCode: 'MI', name: 'Michigan' },
  { isoCode: 'MN', name: 'Minnesota' },
  { isoCode: 'MS', name: 'Mississippi' },
  { isoCode: 'MO', name: 'Missouri' },
  { isoCode: 'MT', name: 'Montana' },
  { isoCode: 'NE', name: 'Nebraska' },
  { isoCode: 'NV', name: 'Nevada' },
  { isoCode: 'NH', name: 'New Hampshire' },
  { isoCode: 'NJ', name: 'New Jersey' },
  { isoCode: 'NM', name: 'New Mexico' },
  { isoCode: 'NY', name: 'New York' },
  { isoCode: 'NC', name: 'North Carolina' },
  { isoCode: 'ND', name: 'North Dakota' },
  { isoCode: 'OH', name: 'Ohio' },
  { isoCode: 'OK', name: 'Oklahoma' },
  { isoCode: 'OR', name: 'Oregon' },
  { isoCode: 'PA', name: 'Pennsylvania' },
  { isoCode: 'RI', name: 'Rhode Island' },
  { isoCode: 'SC', name: 'South Carolina' },
  { isoCode: 'SD', name: 'South Dakota' },
  { isoCode: 'TN', name: 'Tennessee' },
  { isoCode: 'TX', name: 'Texas' },
  { isoCode: 'UT', name: 'Utah' },
  { isoCode: 'VT', name: 'Vermont' },
  { isoCode: 'VA', name: 'Virginia' },
  { isoCode: 'WA', name: 'Washington' },
  { isoCode: 'WV', name: 'West Virginia' },
  { isoCode: 'WI', name: 'Wisconsin' },
  { isoCode: 'WY', name: 'Wyoming' },
];

// Enhanced cities data with proper structure
const US_CITIES: { [key: string]: Array<{name: string, value: string}> } = {
  'NJ': [
    { name: 'Newark', value: 'Newark' },
    { name: 'Jersey City', value: 'Jersey City' },
    { name: 'Paterson', value: 'Paterson' },
    { name: 'Elizabeth', value: 'Elizabeth' },
    { name: 'Edison', value: 'Edison' },
    { name: 'Trenton', value: 'Trenton' },
    { name: 'Clifton', value: 'Clifton' },
    { name: 'Camden', value: 'Camden' }
  ],
  'NY': [
    { name: 'New York', value: 'New York' },
    { name: 'Buffalo', value: 'Buffalo' },
    { name: 'Rochester', value: 'Rochester' },
    { name: 'Yonkers', value: 'Yonkers' },
    { name: 'Syracuse', value: 'Syracuse' },
    { name: 'Albany', value: 'Albany' }
  ],
  'CA': [
    { name: 'Los Angeles', value: 'Los Angeles' },
    { name: 'San Diego', value: 'San Diego' },
    { name: 'San Jose', value: 'San Jose' },
    { name: 'San Francisco', value: 'San Francisco' },
    { name: 'Fresno', value: 'Fresno' },
    { name: 'Sacramento', value: 'Sacramento' }
  ],
  'TX': [
    { name: 'Houston', value: 'Houston' },
    { name: 'San Antonio', value: 'San Antonio' },
    { name: 'Dallas', value: 'Dallas' },
    { name: 'Austin', value: 'Austin' },
    { name: 'Fort Worth', value: 'Fort Worth' }
  ],
  'FL': [
    { name: 'Jacksonville', value: 'Jacksonville' },
    { name: 'Miami', value: 'Miami' },
    { name: 'Tampa', value: 'Tampa' },
    { name: 'Orlando', value: 'Orlando' },
    { name: 'St. Petersburg', value: 'St. Petersburg' }
  ],
  'IL': [
    { name: 'Chicago', value: 'Chicago' },
    { name: 'Aurora', value: 'Aurora' },
    { name: 'Naperville', value: 'Naperville' },
    { name: 'Joliet', value: 'Joliet' },
    { name: 'Rockford', value: 'Rockford' }
  ]
};

const API_BASE_URL = 'http://localhost:5000';

const CustomBackButton = ({ onPress, color = colors.primary }: { onPress: () => void; color?: string }) => (
  <TouchableOpacity onPress={onPress} style={styles.backButton}>
    <Text style={[styles.backButtonText, { color }]}>←</Text>
  </TouchableOpacity>
);

// Memoized selector to fix Redux warning
const selectSavedAddresses = (state: any) => state.user?.addresses || {};

const PickupLocation = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Redux hooks with memoized selector
  const dispatch = useDispatch();
  const savedAddresses = useSelector(selectSavedAddresses);

  const [selectedAddress, setSelectedAddress] = useState<string>('home');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('NJ');
  const [zipCode, setZipCode] = useState<string>('07030');
  const [statesList, setStatesList] = useState<any[]>(US_STATES);
  const [citiesList, setCitiesList] = useState<Array<{name: string, value: string}>>(US_CITIES['NJ'] || []);
  const [loading, setLoading] = useState<boolean>(false);

  // New scheduling states
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [showDriverSelection, setShowDriverSelection] = useState<boolean>(false);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);

  // Get route params
  const { 
    dryCleanerId, 
    driverId, 
    bookingType = 'pickup', 
    distance, 
    time, 
    isScheduled: routeIsScheduled 
  } = params as any;

  // Set initial scheduling state
  useEffect(() => {
    if (routeIsScheduled) {
      setIsScheduled(true);
    }
  }, [routeIsScheduled]);

  // Load cities when state changes - FIXED
  useEffect(() => {
    console.log('State changed to:', state);
    if (state && US_CITIES[state]) {
      const newCities = US_CITIES[state];
      setCitiesList(newCities);
      if (newCities.length > 0) {
        setCity(newCities[0].value);
        console.log('City set to:', newCities[0].value);
      } else {
        setCity('');
      }
    } else {
      setCitiesList([]);
      setCity('');
      console.log('No cities found for state:', state);
    }
  }, [state]);

  // Check available drivers when date/time/dryCleanerId changes
  useEffect(() => {
    if (isScheduled && selectedDate && selectedTime && dryCleanerId) {
      checkAvailableDrivers();
    }
  }, [selectedDate, selectedTime, dryCleanerId, isScheduled]);

  // Generate time slots for the picker
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01 ${time}`).toLocaleTimeString([], { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        slots.push({ value: time, label: displayTime });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Generate dates for the next 7 days
  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dateString = date.toISOString().split('T')[0];
      const displayDate = i === 0 ? 'Today' : 
                         i === 1 ? 'Tomorrow' : 
                         date.toLocaleDateString('en-US', { 
                           weekday: 'short', 
                           month: 'short', 
                           day: 'numeric' 
                         });
      
      dates.push({ value: dateString, label: displayDate });
    }
    return dates;
  };

  const dateOptions = generateDateOptions();

  // Updated authentication token function
  const checkAuthToken = async () => {
    try {
      const loginData = await AsyncStorage.getItem('loginKey');
      
      if (!loginData) {
        console.log('No loginKey found in AsyncStorage');
        return null;
      }
      
      const parsedData = JSON.parse(loginData);
      const token = parsedData.token || parsedData.user?.token;
      
      if (token && token.startsWith('eyJ')) {
        console.log('Found token in loginKey');
        return { key: 'loginKey', value: token };
      }
      
      console.log('No valid JWT token found in loginKey data');
      return null;
    } catch (error) {
      console.error('Error parsing loginKey data:', error);
      return null;
    }
  };

  // Check available drivers for scheduling
  const checkAvailableDrivers = async () => {
    if (!selectedDate || !selectedTime || !dryCleanerId) return;

    setCheckingAvailability(true);
    try {
      const tokenInfo = await checkAuthToken();
      if (!tokenInfo) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const token = tokenInfo.value;
      const url = `${API_BASE_URL}/api/booking/available-drivers?date=${selectedDate}&time=${selectedTime}&dryCleanerId=${dryCleanerId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableDrivers(data.data.drivers || []);
        
        // If a specific driver was pre-selected, check if they're available
        if (driverId) {
          const isDriverAvailable = data.data.drivers.some((driver: AvailableDriver) => driver._id === driverId);
          if (isDriverAvailable) {
            setSelectedDriverId(driverId);
          } else {
            Alert.alert(
              'Driver Unavailable',
              'The selected driver is not available at this time. Please choose another driver.',
              [{ text: 'OK' }]
            );
            setSelectedDriverId('');
          }
        }
      } else {
        const errorData = await response.json();
        console.log('Available drivers error:', errorData);
        Alert.alert('Error', 'Failed to check driver availability');
      }
    } catch (error) {
      console.error('Error checking available drivers:', error);
      Alert.alert('Error', 'Failed to check driver availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Handle state change - FIXED
  const handleStateChange = (stateCode: string) => {
    console.log('State changed to:', stateCode);
    setState(stateCode);
    // The useEffect will handle the cities update
  };

  // Handle city change - FIXED
  const handleCityChange = (cityValue: string) => {
    console.log('City changed to:', cityValue);
    setCity(cityValue);
  };

  // Handle address type selection - FIXED
  const handleAddressSelect = (type: string) => {
    console.log('Address type selected:', type);
    setSelectedAddress(type);
    
    if (type === 'home' && savedAddresses.home) {
      const homeAddr = savedAddresses.home;
      setAddress(homeAddr.street);
      setCity(homeAddr.city);
      setState(homeAddr.state);
      setZipCode(homeAddr.zipCode);
      console.log('Loaded home address:', homeAddr);
    } else if (type === 'office' && savedAddresses.office) {
      const officeAddr = savedAddresses.office;
      setAddress(officeAddr.street);
      setCity(officeAddr.city);
      setState(officeAddr.state);
      setZipCode(officeAddr.zipCode);
      console.log('Loaded office address:', officeAddr);
    } else if (type === 'new') {
      setAddress('');
      setCity(citiesList.length > 0 ? citiesList[0].value : '');
      setState('NJ');
      setZipCode('');
      console.log('Reset to new address form');
    }
  };

  // Save address to Redux store
  const saveAddress = async (addressType: 'home' | 'office') => {
    if (!address || !city || !state || !zipCode) {
      Alert.alert('Error', 'Please fill in all address fields');
      return false;
    }

    try {
      const fullAddress = `${address}, ${city}, ${getStateName(state)}, ${zipCode}`;
      const addressData: ReduxSavedAddress = {
        type: addressType,
        street: address,
        city,
        state,
        zipCode,
        fullAddress,
      };

      // Save to Redux store
      dispatch(saveUserAddress(addressData));
      
      console.log('Address saved to Redux:', addressData);
      return true;
    } catch (error) {
      console.error('Error saving address to Redux:', error);
      return false;
    }
  };

  // Create immediate booking request
  const createBookingRequest = async () => {
    if (!dryCleanerId || !driverId || !distance || !time) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    if (!address || !city || !state || !zipCode) {
      Alert.alert('Error', 'Please complete the address information');
      return;
    }

    setLoading(true);

    try {
      const tokenInfo = await checkAuthToken();
      if (!tokenInfo) {
        Alert.alert('Error', 'Authentication required');
        setLoading(false);
        return;
      }

      const token = tokenInfo.value;
      const fullAddress = `${address}, ${city}, ${getStateName(state)}, ${zipCode}`;
      
      const bookingData = {
        dryCleanerId,
        driverId,
        pickupAddress: fullAddress,
        dropoffAddress: bookingType === 'delivery' ? fullAddress : undefined,
        distance: Number(distance),
        time: Number(time),
        bookingType,
        message: `${bookingType === 'pickup' ? 'Pickup' : 'Delivery'} request from ${selectedAddress} address`,
      };

      console.log('Booking data being sent:', bookingData);

      const response = await fetch(`${API_BASE_URL}/api/users/booking/user/booking-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      const responseData = await response.json();
      console.log('Booking response:', responseData);

      if (response.ok) {
        Alert.alert(
          'Success',
          'Booking request sent to driver successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                if (responseData.data && responseData.data.booking && responseData.data.booking._id) {
                  router.push({
                    pathname: '/BookingStatus',
                    params: { bookingId: responseData.data.booking._id }
                  });
                } else {
                  router.back();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', responseData.message || 'Failed to create booking request');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create scheduled booking request
  const createScheduledBookingRequest = async () => {
    if (!dryCleanerId || !selectedDriverId || !distance || !time) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    if (!address || !city || !state || !zipCode) {
      Alert.alert('Error', 'Please complete the address information');
      return;
    }

    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select date and time for pickup');
      return;
    }

    setLoading(true);

    try {
      const tokenInfo = await checkAuthToken();
      if (!tokenInfo) {
        Alert.alert('Error', 'Authentication required');
        setLoading(false);
        return;
      }

      const token = tokenInfo.value;
      const fullAddress = `${address}, ${city}, ${getStateName(state)}, ${zipCode}`;
      
      const bookingData = {
        dryCleanerId,
        driverId: selectedDriverId,
        pickupAddress: fullAddress,
        distance: Number(distance),
        time: Number(time),
        scheduledPickupDate: selectedDate,
        scheduledPickupTime: selectedTime,
        message: `Scheduled pickup request from ${selectedAddress} address`,
      };

      console.log('Scheduled booking data being sent:', bookingData);

      const response = await fetch(`${API_BASE_URL}/api/users/booking/scheduled-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      const responseData = await response.json();
      console.log('Scheduled booking response:', responseData);

      if (response.ok) {
        Alert.alert(
          'Success',
          'Scheduled booking request sent to driver successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                if (responseData.data && responseData.data.booking && responseData.data.booking._id) {
                  router.push({
                    pathname: '/BookingStatus',
                    params: { bookingId: responseData.data.booking._id }
                  });
                } else {
                  router.back();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', responseData.message || 'Failed to create scheduled booking request');
      }
    } catch (error) {
      console.error('Error creating scheduled booking:', error);
      Alert.alert('Error', 'Failed to create scheduled booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle continue button
  const handleContinue = async () => {
    console.log('Continue pressed with:', { address, city, state, zipCode });
    
    if (!address || !city || !state || !zipCode) {
      Alert.alert('Error', 'Please fill in all address fields');
      return;
    }

    // Save address if it's home or office type
    if (selectedAddress === 'home' || selectedAddress === 'office') {
      try {
        await saveAddress(selectedAddress as 'home' | 'office');
      } catch (error) {
        console.log('Address save failed, but continuing...', error);
      }
    }

    // If we have booking parameters, create the booking
    if (dryCleanerId && (driverId || isScheduled)) {
      if (isScheduled) {
        if (!selectedDriverId) {
          Alert.alert('Error', 'Please select a driver for your scheduled pickup');
          return;
        }
        await createScheduledBookingRequest();
      } else {
        await createBookingRequest();
      }
    } else {
      // Navigate to next step (DropLocation)
      const fullAddress = `${address}, ${city}, ${getStateName(state)}, ${zipCode}`;
      router.push({
        pathname: '/dryCleanerUser/pickUpTimeDate',
        params: {
          pickupAddress: fullAddress,
          selectedAddressType: selectedAddress,
        }
      });
    }
  };

  // Get address title based on selected address type
  const getAddressTitle = () => {
    if (selectedAddress === 'home') return 'Enter Home Address Details';
    if (selectedAddress === 'office') return 'Enter Office Address Details';
    if (selectedAddress === 'new') return 'Enter New Address Details';
    return 'Enter Address Details';
  };

  // Get state name from state code
  const getStateName = (stateCode: string) => {
    const stateObj = statesList.find(state => state.isoCode === stateCode);
    return stateObj ? stateObj.name : '';
  };

  // Check if address is saved and available
  const isAddressAvailable = (type: 'home' | 'office') => {
    return savedAddresses[type] && Object.keys(savedAddresses[type]!).length > 0;
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/userHome');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <CustomBackButton onPress={handleGoBack} />
          <Text style={styles.title}>
            {dryCleanerId && (driverId || isScheduled) ? 'Confirm Pickup Location' : 'Pickup Location'}
          </Text>
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            {dryCleanerId && (driverId || isScheduled) ? 'Enter your pickup address to send booking request' : 'Select Pickup Address'}
          </Text>
        </View>

        {/* Show booking info if available */}
        {dryCleanerId && (driverId || isScheduled) && (
          <View style={styles.bookingInfoContainer}>
            <Text style={styles.bookingInfoTitle}>Booking Details</Text>
            <Text style={styles.bookingInfoText}>Type: {isScheduled ? 'Scheduled' : bookingType}</Text>
            <Text style={styles.bookingInfoText}>Distance: {distance} km</Text>
            <Text style={styles.bookingInfoText}>Time: {time} mins</Text>
            <Text style={styles.bookingInfoText}>Price: ₹{distance ? (Number(distance) * 10) : 0}</Text>
          </View>
        )}

        {/* Scheduling Toggle */}
        {!driverId && dryCleanerId && (
          <View style={styles.schedulingToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !isScheduled && styles.toggleButtonActive
              ]}
              onPress={() => setIsScheduled(false)}
            >
              <Text style={[
                styles.toggleButtonText,
                !isScheduled && styles.toggleButtonTextActive
              ]}>
                Book Now
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                isScheduled && styles.toggleButtonActive
              ]}
              onPress={() => setIsScheduled(true)}
            >
              <Text style={[
                styles.toggleButtonText,
                isScheduled && styles.toggleButtonTextActive
              ]}>
                Schedule Later
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date and Time Selection for Scheduled Bookings */}
        {isScheduled && (
          <View style={styles.schedulingSection}>
            <Text style={styles.schedulingTitle}>Select Pickup Date & Time</Text>
            
            {/* Date Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateTimeButtonText}>
                  {selectedDate ? 
                    dateOptions.find(d => d.value === selectedDate)?.label || selectedDate :
                    'Select Date'
                  }
                </Text>
                <IconButton icon="calendar" size={20} iconColor="#666" />
              </TouchableOpacity>
            </View>

            {/* Time Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Time</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.dateTimeButtonText}>
                  {selectedTime ? 
                    timeSlots.find(t => t.value === selectedTime)?.label || selectedTime :
                    'Select Time'
                  }
                </Text>
                <IconButton icon="clock-outline" size={20} iconColor="#666" />
              </TouchableOpacity>
            </View>

            {/* Available Drivers */}
            {selectedDate && selectedTime && dryCleanerId && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Available Drivers</Text>
                {checkingAvailability ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#F99026" />
                    <Text style={styles.loadingText}>Checking availability...</Text>
                  </View>
                ) : availableDrivers.length > 0 ? (
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowDriverSelection(true)}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      {selectedDriverId ? 
                        availableDrivers.find(d => d._id === selectedDriverId)?.firstName + ' ' +
                        availableDrivers.find(d => d._id === selectedDriverId)?.lastName :
                        'Select Driver'
                      }
                    </Text>
                    <IconButton icon="account" size={20} iconColor="#666" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noDriversText}>No drivers available at this time</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Address Options */}
        <View style={styles.addressOptions}>
          <TouchableOpacity
            style={[
              styles.addressCard, 
              selectedAddress === 'home' && styles.selectedAddressCard
            ]}
            onPress={() => handleAddressSelect('home')}>
            <Image source={images.home} style={styles.addressIcon} resizeMode="cover" />
            <Text style={styles.addressText}>
              Home {isAddressAvailable('home') ? '✓' : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addressCard, 
              selectedAddress === 'office' && styles.selectedAddressCard
            ]}
            onPress={() => handleAddressSelect('office')}>
            <Image source={images.business} style={styles.addressIcon} resizeMode="cover" />
            <Text style={styles.addressText}>
              Office {isAddressAvailable('office') ? '✓' : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addressCard, 
              selectedAddress === 'new' && styles.selectedAddressCard
            ]}
            onPress={() => handleAddressSelect('new')}>
            <Image source={images.business} style={styles.addressIcon} resizeMode="cover" />
            <Text style={styles.addressText}>New Address</Text>
          </TouchableOpacity>
        </View>

        {/* Address Form */}
        {(selectedAddress === 'new' || selectedAddress === 'home' || selectedAddress === 'office') && (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>{getAddressTitle()}</Text>

            {/* Address Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Your Address"
                value={address}
                onChangeText={setAddress}
                editable={!loading}
              />
            </View>

            {/* State Dropdown */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>State</Text>
              <View style={styles.dropdownContainer}>
                <Picker
                  selectedValue={state}
                  onValueChange={handleStateChange}
                  style={styles.picker}
                  enabled={!loading}>
                  {statesList.map((stateItem) => (
                    <Picker.Item 
                      key={stateItem.isoCode} 
                      label={stateItem.name} 
                      value={stateItem.isoCode} 
                    />
                  ))}
                </Picker>
                <Image source={images.dropdownarrow} style={styles.dropdownIcon} resizeMode="cover" />
              </View>
            </View>

            {/* City Dropdown - FIXED */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>City</Text>
              <View style={styles.dropdownContainer}>
                <Picker
                  selectedValue={city}
                  onValueChange={handleCityChange}
                  style={styles.picker}
                  enabled={!loading && citiesList.length > 0}>
                  {citiesList.length > 0 ? (
                    citiesList.map((cityItem, index) => (
                      <Picker.Item 
                        key={index} 
                        label={cityItem.name} 
                        value={cityItem.value} 
                      />
                    ))
                  ) : (
                    <Picker.Item label="No cities available" value="" />
                  )}
                </Picker>
                <Image source={images.dropdownarrow} style={styles.dropdownIcon} resizeMode="cover" />
              </View>
              {citiesList.length === 0 && (
                <Text style={styles.errorText}>No cities available for selected state</Text>
              )}
            </View>

            {/* ZIP Code Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>ZIP Code</Text>
              <TextInput
                style={styles.input}
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="numeric"
                maxLength={5}
                editable={!loading}
              />
            </View>
          </View>
        )}

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity 
            style={[styles.continueButton, loading && { opacity: 0.7 }]} 
            onPress={handleContinue}
            disabled={loading || (isScheduled && !selectedDriverId)}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>
                {dryCleanerId && (driverId || isScheduled) ? 'Send Booking Request' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Only show skip button if not in booking mode */}
          {!dryCleanerId && !driverId && (
            <TouchableOpacity 
              style={[styles.skipButton, loading && { opacity: 0.7 }]} 
              onPress={() => router.push('/DropLocation')}
              disabled={loading}>
              <Text style={styles.skipButtonText}>Skip This Step</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <ScrollView style={styles.optionsList}>
              {dateOptions.map((date) => (
                <TouchableOpacity
                  key={date.value}
                  style={styles.optionItem}
                  onPress={() => {
                    setSelectedDate(date.value);
                    setShowDatePicker(false);
                  }}>
                  <Text style={styles.optionText}>{date.label}</Text>
                  {selectedDate === date.value && (
                    <IconButton icon="check" size={20} iconColor="#F99026" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <ScrollView style={styles.optionsList}>
              {timeSlots.map((time) => (
                <TouchableOpacity
                  key={time.value}
                  style={styles.optionItem}
                  onPress={() => {
                    setSelectedTime(time.value);
                    setShowTimePicker(false);
                  }}>
                  <Text style={styles.optionText}>{time.label}</Text>
                  {selectedTime === time.value && (
                    <IconButton icon="check" size={20} iconColor="#F99026" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTimePicker(false)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Driver Selection Modal */}
      <Modal
        visible={showDriverSelection}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDriverSelection(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Driver</Text>
            <ScrollView style={styles.optionsList}>
              {availableDrivers.map((driver) => (
                <TouchableOpacity
                  key={driver._id}
                  style={styles.driverOptionItem}
                  onPress={() => {
                    setSelectedDriverId(driver._id);
                    setShowDriverSelection(false);
                  }}>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>
                      {driver.firstName} {driver.lastName}
                    </Text>
                    <Text style={styles.driverDetails}>
                      {driver.vehicleInfo?.vehicleNumber} • ⭐ {driver.rating || 0}
                    </Text>
                    <Text style={styles.driverPhone}>{driver.phoneNumber}</Text>
                  </View>
                  {selectedDriverId === driver._id && (
                    <IconButton icon="check" size={20} iconColor="#F99026" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDriverSelection(false)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '400',
  },
  title: {
    fontSize: 18,
    fontWeight: '400',
    marginLeft: 8,
    color: '#000000',
  },
  subtitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#000000',
  },
  bookingInfoContainer: {
    backgroundColor: '#F8F9FA',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F99026',
  },
  bookingInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  bookingInfoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  schedulingToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 21,
  },
  toggleButtonActive: {
    backgroundColor: '#F99026',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  schedulingSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  schedulingTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 16,
  },
  dateTimeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  noDriversText: {
    fontSize: 14,
    color: '#FF6B6B',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  addressOptions: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 12,
    marginBottom: 32,
  },
  addressCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 19,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressIcon: {
    width: 34,
    height: 39,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#000000',
  },
  formSection: {
    paddingHorizontal: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 24,
    color: '#707070',
  },
  inputContainer: {
    marginBottom: 30,
    borderBottomWidth: 0.5,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
    fontSize: 16,
    color: '#000000',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  picker: {
    flex: 1,
    color: '#000000',
    height: 50,
  },
  dropdownIcon: {
    width: 16,
    height: 10,
    left: -10,
    tintColor: '#9D9D9D',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bottomButtons: {
    padding: 16,
    marginTop: 'auto',
  },
  continueButton: {
    backgroundColor: '#F99026',
    borderRadius: 29,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: '#5E5E60',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedAddressCard: {
    backgroundColor: '#FDF1E5',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    color: '#333333',
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionText: {
    fontSize: 16,
    color: '#333333',
  },
  driverOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  driverDetails: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  driverPhone: {
    fontSize: 12,
    color: '#999999',
  },
  modalCloseButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
});

export default PickupLocation;