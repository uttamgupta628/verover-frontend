import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { images } from '../../assets/images/images';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

interface Coordinate {
  latitude: number;
  longitude: number;
}

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyBn5c5hk6ko6gEwZ3IyWK6AkU4_U_tp_4g";
const LOCATIONIQ_KEY = "pk.a58eb8dfee07578df85fe6719e6532ff";

// Mock coordinates for testing
const MOCK_COORDINATES = {
  MUMBAI: { latitude: 18.9344, longitude: 72.8309 },
  KOLKATA: { latitude: 22.6431, longitude: 88.4176 },
};

// ============================================================================
// GEOCODING CACHE
// ============================================================================
const geocodeCache = new Map<string, { 
  latitude: number; 
  longitude: number;
  provider: string;
  timestamp: number;
} | null>();

const directionsCache = new Map<string, any>();
let lastDirectionsRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

// Provider preference tracking
let preferredProvider: 'google' | 'locationiq' = 'google';
let googleFailureCount = 0;
const MAX_GOOGLE_FAILURES = 3;

// LocationIQ Geocoding
const geocodeWithLocationIQ = async (address: string): Promise<{ 
  latitude: number; 
  longitude: number 
} | null> => {
  try {
    console.log('🌍 [LocationIQ] Geocoding:', address);
    
    const url = `https://us1.locationiq.com/v1/search.php?` +
      `key=${LOCATIONIQ_KEY}` +
      `&q=${encodeURIComponent(address)}` +
      `&format=json` +
      `&limit=1`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && Array.isArray(data) && data.length > 0) {
      const coords = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
      console.log('✅ [LocationIQ] Success:', coords);
      return coords;
    }
    
    console.log('❌ [LocationIQ] No results found');
    return null;
  } catch (error) {
    console.error('❌ [LocationIQ] Exception:', error);
    return null;
  }
};

// Google Geocoding
const geocodeWithGoogle = async (
  address: string, 
  retryCount = 0
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    console.log(`🌍 [Google] Geocoding (attempt ${retryCount + 1}):`, address);
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(address)}` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OVER_QUERY_LIMIT") {
      console.warn(`⚠️ [Google] Rate limit hit`);
      googleFailureCount++;
      
      if (googleFailureCount >= MAX_GOOGLE_FAILURES) {
        preferredProvider = 'locationiq';
      }
      
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return geocodeWithGoogle(address, retryCount + 1);
      }
      
      return null;
    }

    if (data.status === "OK" && data.results?.[0]) {
      const location = data.results[0].geometry.location;
      googleFailureCount = 0;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Google] Exception:', error);
    return null;
  }
};

const DryCleaningDropoff = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);
  
  // Redux auth state
  const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);
  
  // Parse booking data
  const [bookingData, setBookingData] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (params.bookingData && typeof params.bookingData === 'string') {
        const parsed = JSON.parse(params.bookingData);
        console.log('📦 Parsed booking data:', parsed);
        setBookingData(parsed);
      } else if (params.bookingData && typeof params.bookingData === 'object') {
        setBookingData(params.bookingData);
      } else {
        setParseError('No booking data provided');
      }
    } catch (error) {
      console.error('❌ Error parsing booking data:', error);
      setParseError('Failed to parse booking data');
    }
  }, [params.bookingData]);
  
  // State management
  const [isCompleting, setIsCompleting] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  
  // Map and location states
  const [currLoc, setCurrLoc] = useState<Coordinate | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Coordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');
  const [isGeocodingDropoff, setIsGeocodingDropoff] = useState(false);

  const hasFetchedRoute = useRef(false);

  // Fetch booking details from backend
  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (!bookingData?.id && !bookingData?._id) return;
      
      try {
        setLoadingBooking(true);
        const bookingId = bookingData.id || bookingData._id;
        
        console.log('📡 Fetching booking details from backend:', bookingId);
        
        const response = await axiosInstance.get(`/users/bookings/${bookingId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.data.success) {
          console.log('✅ Booking details fetched:', response.data.data);
          setBookingDetails(response.data.data);
        } else {
          console.warn('⚠️ Backend returned no data, using local data');
          setBookingDetails(bookingData);
        }
      } catch (error: any) {
        console.error('❌ Error fetching booking details:', error);
        console.log('Using local booking data as fallback');
        setBookingDetails(bookingData);
      } finally {
        setLoadingBooking(false);
      }
    };

    fetchBookingDetails();
  }, [bookingData, token]);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert(
        'Authentication Required',
        'Please log in to continue',
        [{ text: 'OK', onPress: () => router.push('/login') }]
      );
    }
  }, [isAuthenticated, token]);

  // Geocode address with caching
  const geocodeAddress = async (address: string): Promise<{ 
    latitude: number; 
    longitude: number 
  } | null> => {
    if (!address || address.trim() === '') {
      console.warn('⚠️ Empty address provided for geocoding');
      return null;
    }

    const cacheKey = address.toLowerCase().trim();
    const cached = geocodeCache.get(cacheKey);
    
    if (cached && cached.latitude) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_EXPIRY) {
        console.log(`✅ [Cache] Using cached result from ${cached.provider}`);
        return { latitude: cached.latitude, longitude: cached.longitude };
      }
      geocodeCache.delete(cacheKey);
    }

    let result: { latitude: number; longitude: number } | null = null;
    let usedProvider = '';

    if (preferredProvider === 'google') {
      result = await geocodeWithGoogle(address);
      if (result) {
        usedProvider = 'Google';
      } else {
        result = await geocodeWithLocationIQ(address);
        if (result) usedProvider = 'LocationIQ';
      }
    } else {
      result = await geocodeWithLocationIQ(address);
      if (result) {
        usedProvider = 'LocationIQ';
      } else {
        result = await geocodeWithGoogle(address);
        if (result) usedProvider = 'Google';
      }
    }

    if (result) {
      geocodeCache.set(cacheKey, {
        ...result,
        provider: usedProvider,
        timestamp: Date.now()
      });
      console.log(`✅ Successfully geocoded "${address}" using ${usedProvider}`);
    } else {
      geocodeCache.set(cacheKey, null as any);
      console.error(`❌ All providers failed for: "${address}"`);
    }

    return result;
  };

  // Extract dropoff location from booking details
  useEffect(() => {
    if (!bookingDetails) return;

    console.log('📦 Processing booking details for dropoff coordinates');
    console.log('dropoffCoords:', bookingDetails.dropoffCoords);
    console.log('dropoffAddress:', bookingDetails.dropoffAddress);

    // PRIORITY 1: Use dropoffCoords if valid
    if (bookingDetails.dropoffCoords) {
      const coords = bookingDetails.dropoffCoords;
      
      if (typeof coords.latitude === 'number' && 
          typeof coords.longitude === 'number' &&
          !isNaN(coords.latitude) && 
          !isNaN(coords.longitude) &&
          coords.latitude !== 0 && 
          coords.longitude !== 0) {
        
        console.log('✅ Using valid dropoffCoords from booking');
        setDropoffLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        return;
      }
    }

    // FALLBACK: Geocode dropoff address
    if (bookingDetails.dropoffAddress || bookingDetails.dropOff) {
      const address = bookingDetails.dropoffAddress || bookingDetails.dropOff;
      console.log('📍 No valid coordinates, geocoding dropoff address:', address);
      geocodeDropoffAddress(address);
    } else {
      console.warn('⚠️ No dropoff location or address found');
      Alert.alert(
        'Location Missing',
        'No dropoff location available for this booking.',
        [{ text: 'OK' }]
      );
    }
  }, [bookingDetails]);

  // Geocode dropoff address
  const geocodeDropoffAddress = async (address: string) => {
    try {
      setIsGeocodingDropoff(true);
      console.log('📍 Starting dropoff address geocoding...');
      const coords = await geocodeAddress(address);
      
      if (coords) {
        setDropoffLocation(coords);
        console.log('✅ Set dropoff location:', coords);
      } else {
        Alert.alert(
          'Location Not Found',
          'Unable to find coordinates for the dropoff address.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Dropoff geocoding error:', error);
      Alert.alert(
        'Geocoding Error',
        'An error occurred while finding the location.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeocodingDropoff(false);
    }
  };

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location permission in settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const newLocation: Coordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log('✅ Got driver location:', newLocation);
      setCurrLoc(newLocation);

    } catch (err: any) {
      console.error("Location error:", err);
      const mockLocation = MOCK_COORDINATES.KOLKATA;
      console.log('⚠️ Using mock location:', mockLocation);
      setCurrLoc(mockLocation);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // Generate cache key
  const getRouteKey = (origin: Coordinate, destination: Coordinate): string => {
    const oLat = origin.latitude.toFixed(4);
    const oLng = origin.longitude.toFixed(4);
    const dLat = destination.latitude.toFixed(4);
    const dLng = destination.longitude.toFixed(4);
    return `${oLat},${oLng}->${dLat},${dLng}`;
  };

  // Fetch route from Google Directions API
  const fetchGoogleDirectionsRoute = useCallback(async (origin: Coordinate, destination: Coordinate) => {
    try {
      setIsRouteLoading(true);
      console.log('🗺️ Fetching route to dropoff location...');

      const cacheKey = getRouteKey(origin, destination);
      const cached = directionsCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < 3600000) {
        console.log('✅ Using cached route');
        
        const points = decodePolyline(cached.routes.overview_polyline.points);
        setRouteCoordinates(points);
        setRouteDistance(cached.distance);
        setRouteDuration(cached.duration);
        
        setTimeout(() => {
          if (mapRef.current && points.length > 1) {
            mapRef.current.fitToCoordinates(points, {
              edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
              animated: true,
            });
          }
        }, 1000);

        setIsRouteLoading(false);
        return;
      }

      const timeSinceLastRequest = now - lastDirectionsRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      lastDirectionsRequestTime = Date.now();
      
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        directionsCache.set(cacheKey, {
          routes: route,
          timestamp: Date.now(),
          distance: leg.distance.text,
          duration: leg.duration.text,
        });

        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
        setRouteDistance(leg.distance.text);
        setRouteDuration(leg.duration.text);

        setTimeout(() => {
          if (mapRef.current && points.length > 1) {
            mapRef.current.fitToCoordinates(points, {
              edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
              animated: true,
            });
          }
        }, 1500);

      } else if (data.status === 'OVER_QUERY_LIMIT') {
        console.error('❌ API quota exceeded');
        generateFallbackRoute(origin, destination);
      } else {
        console.error('❌ Directions API error:', data.status);
        generateFallbackRoute(origin, destination);
      }

    } catch (error) {
      console.error('❌ Route fetch error:', error);
      generateFallbackRoute(origin, destination);
    } finally {
      setIsRouteLoading(false);
    }
  }, []);

  // Fetch route when conditions are met
  useEffect(() => {
    if (!currLoc || !dropoffLocation || !mapReady || hasFetchedRoute.current) {
      return;
    }

    console.log("🗺 Fetching route to dropoff...");
    hasFetchedRoute.current = true;
    fetchGoogleDirectionsRoute(currLoc, dropoffLocation);
  }, [currLoc, dropoffLocation, mapReady, fetchGoogleDirectionsRoute]);

  // Decode polyline
  const decodePolyline = (encoded: string): Coordinate[] => {
    const points: Coordinate[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  // Fallback route
  const generateFallbackRoute = (start: Coordinate, end: Coordinate) => {
    console.log('⚠️ Using fallback route');
    const route: Coordinate[] = [start];
    const pointsCount = 50;
    
    for (let i = 1; i < pointsCount - 1; i++) {
      const progress = i / (pointsCount - 1);
      const lat = start.latitude + (end.latitude - start.latitude) * progress;
      const lng = start.longitude + (end.longitude - start.longitude) * progress;
      
      route.push({
        latitude: lat + (Math.random() - 0.5) * 0.002,
        longitude: lng + (Math.random() - 0.5) * 0.002,
      });
    }
    
    route.push(end);
    setRouteCoordinates(route);

    const distance = calculateDistance(start, end);
    setRouteDistance(formatDistance(distance));
    setRouteDuration(estimateDuration(distance));
  };

  // Calculate distance
  const calculateDistance = (start: Coordinate, end: Coordinate) => {
    const R = 6371;
    const dLat = (end.latitude - start.latitude) * Math.PI / 180;
    const dLon = (end.longitude - start.longitude) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(start.latitude * Math.PI / 180) * 
      Math.cos(end.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const estimateDuration = (km: number) => {
    const hours = km / 40;
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}min`;
  };

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    console.log('✅ Map ready');
  }, []);

  // Send notification to user
  const sendNotificationToUser = async (notificationType: string) => {
    try {
      console.log('📲 Sending notification to user...');
      
      const response = await axiosInstance.post('/users/notifications/send', {
        userId: bookingDetails?.userId || bookingDetails?.user?._id,
        bookingId: bookingDetails?.id || bookingDetails?._id,
        type: notificationType,
        title: notificationType === 'dropoff_completed' ? 'Delivery Completed' : 'Driver Update',
        message: notificationType === 'dropoff_completed' 
          ? 'Your laundry has been delivered to the dry cleaning center!'
          : 'Your driver has started the delivery.',
        driverName: `${user.firstName} ${user.lastName}`.trim() || user.fullName,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.data.success) {
        console.log('✅ Notification sent successfully');
      }
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      // Don't block the flow if notification fails
    }
  };

  // Add this helper function at the top of your DryCleaningDropoff component
// (after the imports and before the component)

// Define this OUTSIDE the component (after the geocoding functions, around line 130)
const progressBookingToDropoffReady = async (
  currentStatus: string, 
  bookingId: string, 
  token: string,
  user: any
): Promise<boolean> => {
  console.log('📋 Starting status progression from:', currentStatus);
  
  const statusFlow = [
    'accepted',
    'in_progress',
    'pickup_completed',
    'en_route_to_dropoff',
    'arrived_at_dropoff'
  ];
  
  const currentIndex = statusFlow.indexOf(currentStatus);
  const targetIndex = statusFlow.indexOf('arrived_at_dropoff');
  
  if (currentIndex === -1) {
    console.warn(`⚠️ Unknown status: ${currentStatus}, starting from accepted`);
    // Start from beginning if unknown status
    const startIndex = 0;
    for (let i = startIndex; i <= targetIndex; i++) {
      await updateBookingStatus(statusFlow[i], bookingId, token, user);
    }
    return true;
  }
  
  if (currentIndex >= targetIndex) {
    console.log('✅ Already at or past arrived_at_dropoff');
    return true;
  }
  
  // Progress through each status
  for (let i = currentIndex + 1; i <= targetIndex; i++) {
    await updateBookingStatus(statusFlow[i], bookingId, token, user);
  }
  
  console.log('✅ Successfully progressed to arrived_at_dropoff');
  return true;
};

const updateBookingStatus = async (
  status: string,
  bookingId: string,
  token: string,
  user: any
): Promise<void> => {
  console.log(`⏳ Updating to: ${status}`);
  
  const payload: any = {
    bookingId: bookingId,
    status: status,
    driverId: user._id,
    driverName: `${user.firstName} ${user.lastName}`.trim() || user.fullName || 'Driver',
  };
  
  // Add timestamps for specific statuses
  const now = new Date().toISOString();
  switch (status) {
    case 'in_progress':
      payload.startedAt = now;
      break;
    case 'pickup_completed':
      payload.pickupCompletedAt = now;
      break;
    case 'arrived_at_dropoff':
      payload.arrivedAt = now;
      break;
  }
  
  try {
    const response = await axiosInstance.put('/users/update-status', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
    });
    
    if (!response.data.success) {
      throw new Error(`Failed to update to ${status}: ${response.data.message || 'Unknown error'}`);
    }
    
    console.log(`✅ Updated to: ${status}`);
    
    // Small delay between updates
    await new Promise(resolve => setTimeout(resolve, 300));
    
  } catch (error: any) {
    console.error(`❌ Failed to update to ${status}:`, error.message);
    throw error;
  }
};

// Now update your handleCompleteDropoff function:
const handleCompleteDropoff = async () => {
  if (!bookingDetails?.id && !bookingDetails?._id) {
    Alert.alert('Error', 'Invalid booking data - no booking ID found');
    return;
  }

  if (!isAuthenticated || !user?._id) {
    Alert.alert('Error', 'Authentication required. Please log in again.');
    return;
  }

  Alert.alert(
    'Complete Dropoff',
    'Have you successfully dropped off the items at the dry cleaning center?',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            setIsCompleting(true);
            
            const bookingId = bookingDetails.id || bookingDetails._id;
            const currentStatus = bookingDetails.status || 'accepted';
            
            console.log('📋 Starting dropoff completion process');
            console.log('📋 Booking ID:', bookingId);
            console.log('📋 Current status:', currentStatus);
            
            // Step 1: Progress to arrived_at_dropoff if needed
            if (currentStatus !== 'arrived_at_dropoff' && currentStatus !== 'dropped_at_center') {
              console.log('⚠️ Booking not at dropoff location yet');
              console.log('📋 Auto-progressing through required statuses...');
              
              try {
                await progressBookingToDropoffReady(
                  currentStatus,
                  bookingId,
                  token,
                  user
                );
                console.log('✅ Booking ready for dropoff completion');
              } catch (progressError: any) {
                console.error('❌ Status progression failed:', progressError);
                throw new Error(`Failed to prepare booking: ${progressError.message}`);
              }
            }
            
            // Step 2: Mark as dropped_at_center
            console.log('📤 Marking booking as dropped at center...');
            
            const completionPayload = {
              bookingId: bookingId,
              status: 'dropped_at_center',
              dropoffCompletedAt: new Date().toISOString(),
              driverId: user._id,
              driverName: `${user.firstName} ${user.lastName}`.trim() || user.fullName || 'Driver',
              routeDistance: routeDistance || bookingDetails.calculatedDistance || 'N/A',
              routeDuration: routeDuration || bookingDetails.calculatedDuration || 'N/A',
            };
            
            const response = await axiosInstance.put(
              '/users/update-status',
              completionPayload,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                timeout: 15000,
              }
            );
            
            if (!response.data.success) {
              throw new Error(response.data.message || 'Failed to complete dropoff');
            }
            
            console.log('✅ Dropoff marked as complete');
            
            // Step 3: Send notification to customer
            try {
              await sendNotificationToUser('dropoff_completed');
              console.log('✅ Customer notification sent');
            } catch (notifError) {
              console.warn('⚠️ Notification failed (non-critical):', notifError);
            }
            
            // Step 4: Prepare receipt data
            const receiptData = {
              ...bookingDetails,
              id: bookingId,
              _id: bookingId,
              status: 'dropped_at_center',
              dropoffCompletedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              deliveryCharge: bookingDetails.deliveryCharge || 
                             bookingDetails.pricing?.deliveryCharge || 
                             getDeliveryCharge(),
              estimatedTip: bookingDetails.estimatedTip || 
                           bookingDetails.pricing?.estimatedTip || 
                           getEstimatedTip(),
              totalEarnings: getTotalEarnings(),
              calculatedDistance: routeDistance || bookingDetails.calculatedDistance || 'N/A',
              calculatedDuration: routeDuration || bookingDetails.calculatedDuration || 'N/A',
              routeDistance: routeDistance,
              routeDuration: routeDuration,
              driver: {
                id: user._id,
                _id: user._id,
                name: `${user.firstName} ${user.lastName}`.trim() || user.fullName || 'Driver',
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                email: user.email,
              },
              completedBy: user._id,
            };
            
            console.log('✅ Dropoff completed successfully!');
            console.log('📄 Receipt data prepared');
            
            // Step 5: Navigate to receipt
            setTimeout(() => {
              console.log('📄 Navigating to receipt page...');
              router.replace({
                pathname: '/dryCleanerDriver/recipet',
                params: {
                  bookingData: JSON.stringify(receiptData),
                  success: 'true',
                }
              });
            }, 500);

          } catch (error: any) {
            console.error('❌ Complete dropoff error:', error);
            
            let errorMessage = 'Failed to complete dropoff';
            
            if (error.response?.status === 400) {
              errorMessage = error.response.data?.message || 
                           error.response.data?.error || 
                           'Invalid booking status. Please contact support.';
            } else if (error.response?.status === 404) {
              errorMessage = 'Booking not found. Please refresh and try again.';
            } else if (error.response?.data?.message) {
              errorMessage = error.response.data.message;
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            Alert.alert(
              'Error Completing Dropoff',
              errorMessage,
              [
                {
                  text: 'Retry',
                  onPress: handleCompleteDropoff
                },
                {
                  text: 'Go Back',
                  style: 'cancel',
                  onPress: () => router.back()
                }
              ]
            );
          } finally {
            setIsCompleting(false);
          }
        }
      }
    ]
  );
};

  // Render map
  const renderMap = () => {
    if (Platform.OS === "web") {
      return (
        <Image source={images.BookingConfirmationMap} style={styles.mapImage} />
      );
    }

    const defaultCoords = currLoc || MOCK_COORDINATES.KOLKATA;

    const initialRegion: Region = {
      latitude: defaultCoords.latitude,
      longitude: defaultCoords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    return (
      <MapView
        ref={mapRef}
        style={styles.mapImage}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        mapPadding={{
          top: 50,
          right: 0,
          bottom: height * 0.5,
          left: 0,
        }}
      >
        {/* Route polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FF8C00"
            strokeWidth={6}
            lineDashPattern={[0]}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        )}

        {/* Driver marker */}
        {currLoc && (
          <Marker
            coordinate={currLoc}
            title="Your Location"
            description="Driver's current position"
            identifier="driver"
            zIndex={2}
          >
            <View style={styles.driverMarker}>
              <View style={styles.driverMarkerInner}>
                <MaterialIcons name="directions-car" size={20} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}

        {/* Dropoff marker */}
        {dropoffLocation && (
          <Marker
            coordinate={dropoffLocation}
            title="Dropoff Location"
            description={bookingDetails?.dropoffAddress || 'Dry Cleaning Center'}
            identifier="dropoff"
            zIndex={2}
          >
            <View style={styles.dropoffMarker}>
              <MaterialIcons name="store" size={40} color="#FF8C00" />
            </View>
          </Marker>
        )}
      </MapView>
    );
  };

  // Get pricing
  const getDeliveryCharge = () => {
    if (bookingDetails?.pricing?.deliveryCharge) {
      return parseFloat(bookingDetails.pricing.deliveryCharge).toFixed(2);
    }
    if (bookingDetails?.deliveryCharge) {
      return parseFloat(bookingDetails.deliveryCharge).toFixed(2);
    }
    if (bookingDetails?.price) {
      return parseFloat(bookingDetails.price).toFixed(2);
    }
    return '0.00';
  };

  const getEstimatedTip = () => {
    if (bookingDetails?.pricing?.estimatedTip) {
      return parseFloat(bookingDetails.pricing.estimatedTip).toFixed(2);
    }
    if (bookingDetails?.estimatedTip) {
      return parseFloat(bookingDetails.estimatedTip).toFixed(2);
    }
    return '5.00';
  };

  const getTotalEarnings = () => {
    const deliveryCharge = parseFloat(getDeliveryCharge());
    const tip = parseFloat(getEstimatedTip());
    return (deliveryCharge + tip).toFixed(2);
  };

  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Drop Off Dry Cleaning</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Authentication required</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookingDetails && !loadingBooking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Drop Off Dry Cleaning</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No booking details found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drop Off Dry Cleaning</Text>
      </View>

      {/* Geocoding loading */}
      {isGeocodingDropoff && (
        <View style={styles.geocodingOverlay}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.geocodingText}>Finding dropoff location...</Text>
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer}>
        {renderMap()}

        {/* Distance and Duration Info */}
        {routeDistance && (
          <View style={styles.routeInfoContainer}>
            <View style={styles.routeInfoCard}>
              <MaterialIcons name="directions" size={20} color="#FF8C00" />
              <Text style={styles.routeInfoText}>{routeDistance}</Text>
              <Text style={styles.routeInfoSeparator}>•</Text>
              <Text style={styles.routeInfoText}>{routeDuration}</Text>
            </View>
          </View>
        )}

        {/* Map controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity 
            style={styles.mapControlButton}
            onPress={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#FF8C00" />
            ) : (
              <MaterialIcons name="my-location" size={24} color="#FF8C00" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.mapControlButton}
            onPress={() => {
              if (routeCoordinates.length > 1 && mapRef.current) {
                mapRef.current.fitToCoordinates(routeCoordinates, {
                  edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
                  animated: true,
                });
              }
            }}
          >
            <MaterialIcons name="zoom-out-map" size={24} color="#FF8C00" />
          </TouchableOpacity>
        </View>

        {/* Route Loading */}
        {(isRouteLoading || loadingBooking) && (
          <View style={styles.routeLoadingContainer}>
            <ActivityIndicator size="large" color="#FF8C00" />
            <Text style={styles.routeLoadingText}>
              {loadingBooking ? 'Loading booking...' : 'Calculating route...'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Service Info */}
          <View style={styles.providerSection}>
            <View style={styles.providerInfoRow}>
              <View style={styles.providerIconContainer}>
                <Image source={images.washing} style={styles.providerIcon} />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {bookingDetails?.dryCleaner?.shopname || 'Dry Cleaning Service'}
                </Text>
                <Text style={styles.orderNumber}>
                  Order: {bookingDetails?.orderNumber || bookingDetails?.id || 'N/A'}
                </Text>
                <Text style={[styles.status, { color: '#FF8C00' }]}>
                  Status: IN TRANSIT TO CENTER
                </Text>
              </View>
            </View>
          </View>

          {/* Location Info */}
          <View style={styles.locationContainer}>
            {/* Current Location */}
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.blueDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Current Location</Text>
                <Text style={styles.locationAddress}>Your current position</Text>
              </View>
            </View>

            <View style={styles.locationLine} />

            {/* Dropoff */}
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.orangeDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Drop Off Center</Text>
                <Text style={styles.locationAddress}>
                  {bookingDetails?.dropoffAddress || bookingDetails?.dropOff || 'Dry Cleaning Center'}
                </Text>
              </View>
            </View>
          </View>

          {/* Trip Details */}
          <View style={styles.tripDetails}>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="directions" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDistance || 'Calculating...'}
              </Text>
            </View>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDuration || 'Calculating...'}
              </Text>
            </View>
            <View style={styles.tripDetailItem}>
              <Text style={styles.priceText}>${getDeliveryCharge()}</Text>
            </View>
          </View>

          {/* Cost Breakdown */}
          <View style={styles.costContainer}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Delivery Charge</Text>
              <Text style={styles.costValue}>${getDeliveryCharge()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Estimated Tip</Text>
              <Text style={styles.costValue}>${getEstimatedTip()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={[styles.costRow, styles.totalCostRow]}>
              <Text style={styles.totalLabel}>Total Earnings</Text>
              <Text style={styles.totalValue}>${getTotalEarnings()}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Complete Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.completeButton, isCompleting && styles.disabledButton]} 
            onPress={handleCompleteDropoff}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Complete Dropoff</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : (StatusBar.currentHeight || 0),
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: -60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  geocodingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -50 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 1000,
    width: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  geocodingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  driverMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  dropoffMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeInfoContainer: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  routeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },
  routeInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  routeInfoSeparator: {
    fontSize: 14,
    color: '#666666',
    marginHorizontal: 4,
  },
  mapControls: {
    position: 'absolute',
    bottom: height * 0.5 + 20,
    right: 16,
    gap: 12,
    zIndex: 10,
  },
  mapControlButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  routeLoadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 100,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  providerSection: {
    marginBottom: 20,
  },
  providerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerIcon: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationContainer: {
    marginBottom: 20,
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  blueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
  },
  orangeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF8C00',
  },
  locationLine: {
    width: 2,
    height: 30,
    backgroundColor: '#DDD',
    marginLeft: 11,
    marginTop: -10,
    marginBottom: -10,
  },
  locationInfo: {
    flex: 1,
  },
  locationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  tripDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripDetailText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF8C00',
  },
  costContainer: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  costLabel: {
    fontSize: 16,
    color: '#666666',
  },
  costValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  totalCostRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#FFFFFF',
  },
  completeButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF0000',
    textAlign: 'center',
  },
});

export default DryCleaningDropoff;