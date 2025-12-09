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

// Mock coordinates for testing
const MOCK_COORDINATES = {
  MUMBAI: { latitude: 18.9344, longitude: 72.8309 },
  KOLKATA: { latitude: 22.6431, longitude: 88.4176 },
};


const DryCleaningPickup = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);
  
  // Redux auth state
  const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);
  
  // SAFER PARSING: Get provider data from navigation params
  const [providerData, setProviderData] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse provider data on mount
  useEffect(() => {
    try {
      if (params.providerData && typeof params.providerData === 'string') {
        const parsed = JSON.parse(params.providerData);
        console.log('📦 Parsed provider data:', parsed);
        
        // Validate that we have required fields
        if (!parsed.id && !parsed._id) {
          throw new Error('Missing booking ID');
        }
        
        setProviderData(parsed);
      } else if (params.providerData && typeof params.providerData === 'object') {
        setProviderData(params.providerData);
      } else {
        setParseError('No booking data provided');
      }
    } catch (error) {
      console.error('❌ Error parsing provider data:', error);
      setParseError('Failed to parse booking data');
    }
  }, [params.providerData]);
  
  // State management
  const [isAccepting, setIsAccepting] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  
  // Set booking details when provider data is available
  useEffect(() => {
    if (providerData) {
      setBookingDetails(providerData);
    }
  }, [providerData]);
  
  // Map and location states
  const [currLoc, setCurrLoc] = useState<Coordinate | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Coordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');
  const [isGeocodingPickup, setIsGeocodingPickup] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert(
        'Authentication Required',
        'Please log in to continue',
        [
          {
            text: 'OK',
            onPress: () => router.push('/login')
          }
        ]
      );
      return;
    }
  }, [isAuthenticated, token]);

  // Extract pickup location from booking details
  useEffect(() => {
    if (!bookingDetails) return;

    console.log('📦 Processing booking details for coordinates');
    console.log('pickupCoords:', bookingDetails.pickupCoords);
    console.log('pickupAddress:', bookingDetails.pickupAddress);

    // PRIORITY 1: Use pickupCoords if valid
    if (bookingDetails.pickupCoords) {
      const coords = bookingDetails.pickupCoords;
      
      // Check if coordinates are valid numbers (not null, not needsGeocoding flag)
      if (typeof coords.latitude === 'number' && 
          typeof coords.longitude === 'number' &&
          !isNaN(coords.latitude) && 
          !isNaN(coords.longitude) &&
          coords.latitude !== 0 && 
          coords.longitude !== 0) {
        
        console.log('✅ Using valid pickupCoords from booking');
        setPickupLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        return;
      }
    }

    // FALLBACK: Geocode pickup address
    if (bookingDetails.pickupAddress) {
      console.log('📍 No valid coordinates, geocoding pickup address:', bookingDetails.pickupAddress);
      geocodePickupAddress(bookingDetails.pickupAddress);
    } else {
      console.warn('⚠️ No pickup location or address found in booking details');
      Alert.alert(
        'Location Missing',
        'No pickup location available for this booking.',
        [{ text: 'OK' }]
      );
    }
  }, [bookingDetails]);

  // Geocode pickup address to get coordinates
  const geocodePickupAddress = async (address: string) => {
    try {
      setIsGeocodingPickup(true);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}`;

      console.log('🌍 Geocoding URL:', url);
      const response = await fetch(url);
      const data = await response.json();

      console.log('📊 Geocoding response:', data);

      if (data.status === "OK" && data.results?.[0]) {
        const location = data.results[0].geometry.location;
        const coords = {
          latitude: location.lat,
          longitude: location.lng,
        };
        setPickupLocation(coords);
        console.log('✅ Geocoded pickup location:', coords);
      } else {
        console.error("❌ Geocoding failed:", data.status, data.error_message);
        Alert.alert(
          'Location Error', 
          `Unable to find coordinates for: ${address}\nStatus: ${data.status}`
        );
      }
    } catch (error) {
      console.error("❌ Geocoding error:", error);
      Alert.alert('Error', 'Failed to geocode pickup address');
    } finally {
      setIsGeocodingPickup(false);
    }
  };

  // Get current location (driver's location)
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
      // Use mock location if GPS fails
      const mockLocation = MOCK_COORDINATES.KOLKATA;
      console.log('⚠️ Using mock location:', mockLocation);
      setCurrLoc(mockLocation);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // Fetch route from Google Directions API
  const fetchGoogleDirectionsRoute = async (origin: Coordinate, destination: Coordinate) => {
    try {
      setIsRouteLoading(true);
      console.log('🗺️ Fetching route from Google Directions API...');
      console.log('Origin:', JSON.stringify(origin));
      console.log('Destination:', JSON.stringify(destination));

      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log('📍 Request URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('📊 API Response Status:', data.status);

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        // Decode polyline
        const points = decodePolyline(route.overview_polyline.points);
        console.log('✅ Decoded points count:', points.length);
        
        setRouteCoordinates(points);

        // Set distance and duration
        setRouteDistance(leg.distance.text);
        setRouteDuration(leg.duration.text);

        // Update booking details
        setBookingDetails(prev => ({
          ...prev,
          calculatedDistance: leg.distance.text,
          calculatedDuration: leg.duration.text,
          distanceInKm: (leg.distance.value / 1000).toFixed(2),
        }));

        console.log('✅ Route fetched successfully');
        console.log('Distance:', leg.distance.text);
        console.log('Duration:', leg.duration.text);

        // Fit map to show route
        setTimeout(() => {
          if (mapRef.current && points.length > 1) {
            console.log('🗺️ Fitting map to route...');
            mapRef.current.fitToCoordinates(points, {
              edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
              animated: true,
            });
          }
        }, 1000);

      } else {
        console.error('❌ Directions API error:', data.status, data.error_message);
        Alert.alert('Route Error', `Unable to fetch route: ${data.status}. Using fallback.`);
        generateFallbackRoute(origin, destination);
      }

    } catch (error) {
      console.error('❌ Route fetch error:', error);
      Alert.alert('Route Error', 'Unable to fetch route. Using fallback.');
      generateFallbackRoute(origin, destination);
    } finally {
      setIsRouteLoading(false);
    }
  };

  // Decode Google polyline format
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

  // Fallback route generator
  const generateFallbackRoute = (start: Coordinate, end: Coordinate) => {
    console.log('⚠️ Using fallback route generator');
    const route: Coordinate[] = [start];
    const pointsCount = 50;
    
    for (let i = 1; i < pointsCount - 1; i++) {
      const progress = i / (pointsCount - 1);
      const lat = start.latitude + (end.latitude - start.latitude) * progress;
      const lng = start.longitude + (end.longitude - start.longitude) * progress;
      
      const variation = 0.002;
      route.push({
        latitude: lat + (Math.random() - 0.5) * variation,
        longitude: lng + (Math.random() - 0.5) * variation,
      });
    }
    
    route.push(end);
    setRouteCoordinates(route);

    const distance = calculateDistance(start, end);
    setRouteDistance(formatDistance(distance));
    setRouteDuration(estimateDuration(distance));

    setBookingDetails(prev => ({
      ...prev,
      calculatedDistance: formatDistance(distance),
      calculatedDuration: estimateDuration(distance),
      distanceInKm: distance.toFixed(2),
    }));
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

  // Format distance
  const formatDistance = (km: number) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  // Estimate duration
  const estimateDuration = (km: number) => {
    const hours = km / 40;
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}min`;
  };

  // Update route when both locations are available
  useEffect(() => {
    if (currLoc && pickupLocation && mapReady) {
      console.log('🗺️ Both locations available and map ready, fetching route...');
      console.log('Current Location:', currLoc);
      console.log('Pickup Location:', pickupLocation);
      fetchGoogleDirectionsRoute(currLoc, pickupLocation);
    }
  }, [currLoc, pickupLocation, mapReady]);

  // Initialize location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    console.log('✅ Map ready');
  }, []);

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
  showsTraffic={false}
  showsBuildings={false}
  showsIndoors={false}
  zoomEnabled={true}
  scrollEnabled={true}
  rotateEnabled={true}
  pitchEnabled={true}
  mapPadding={{
    top: 50,
    right: 0,
    bottom: height * 0.5,
    left: 0,
  }}
>
  {/* Route polyline - MUST be rendered before markers */}
  {routeCoordinates.length > 1 && (
    <>
      <Polyline
        coordinates={routeCoordinates}
        strokeColor="#4285F4"
        strokeWidth={6}
        lineDashPattern={[0]}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      {/* Debug: Show route endpoints */}
      <Marker
        coordinate={routeCoordinates[0]}
        title="Route Start"
        pinColor="green"
        zIndex={0}
      />
      <Marker
        coordinate={routeCoordinates[routeCoordinates.length - 1]}
        title="Route End"
        pinColor="red"
        zIndex={0}
      />
    </>
  )}

  {/* Your existing markers */}
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

  {pickupLocation && (
    <Marker
      coordinate={pickupLocation}
      title="Pickup Location"
      description={bookingDetails?.pickupAddress || 'Pickup point'}
      identifier="pickup"
      zIndex={2}
    >
      <View style={styles.pickupMarker}>
        <MaterialIcons name="location-pin" size={40} color="#FF8C00" />
      </View>
    </Marker>
  )}
</MapView>
    );
  };

  // Get auth token from Redux store
  const getAuthToken = () => {
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  };

  // Enhanced handle accepting booking request
  const handleAcceptBooking = async () => {
    if (!bookingDetails?.id && !bookingDetails?._id) {
      Alert.alert('Error', 'Invalid booking data - no booking ID found');
      return;
    }

    if (!isAuthenticated || !user?._id) {
      Alert.alert('Error', 'Authentication required. Please log in again.');
      return;
    }

    try {
      setIsAccepting(true);
      
      const bookingId = bookingDetails.id || bookingDetails._id;
      
      const requestBody = {
        bookingId: bookingId,
        response: 'accept',
        driverId: user._id,
        driverName: `${user.firstName} ${user.lastName}`.trim() || user.fullName || 'Driver',
        routeDistance: bookingDetails.distanceInKm || 0,
        routeDuration: bookingDetails.calculatedDuration || 'N/A',
      };

      const response = await axiosInstance.put('/users/driver/respond', requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.data.success) {
        Alert.alert(
          'Success', 
          'Booking request accepted successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                router.push({
                  pathname: '/DryCleaningDropoff',
                  params: {
                    bookingData: JSON.stringify({
                      ...bookingDetails,
                      status: 'accepted',
                      driverId: user._id,
                      driverName: `${user.firstName} ${user.lastName}`.trim() || user.fullName || 'Driver',
                    })
                  }
                });
              }
            }
          ]
        );
      } else {
        throw new Error(response.data.message || 'Failed to accept booking');
      }

    } catch (error: any) {
      console.error('Accept booking error:', error);
      Alert.alert(
        'Error', 
        `Failed to accept booking: ${error.message}`,
        [
          {
            text: 'Retry',
            onPress: handleAcceptBooking
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } finally {
      setIsAccepting(false);
    }
  };

  // Modified reject booking function
  const handleRejectBooking = () => {
    Alert.alert(
      'Reject Booking',
      'Are you sure you want to reject this booking request?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            router.push({
              pathname: '/CancelBookingScreen',
              params: {
                bookingData: JSON.stringify(bookingDetails),
                rejectionType: 'driver_reject'
              }
            });
          }
        }
      ]
    );
  };

  // Get delivery charge from booking details (from backend)
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
    if (bookingDetails?.pricing?.totalAmount) {
      const total = parseFloat(bookingDetails.pricing.totalAmount);
      const tip = parseFloat(getEstimatedTip());
      return (total - tip).toFixed(2);
    }
    return '0.00';
  };

  // Get estimated tip
  const getEstimatedTip = () => {
    if (bookingDetails?.pricing?.estimatedTip) {
      return parseFloat(bookingDetails.pricing.estimatedTip).toFixed(2);
    }
    if (bookingDetails?.estimatedTip) {
      return parseFloat(bookingDetails.estimatedTip).toFixed(2);
    }
    if (bookingDetails?.tip) {
      return parseFloat(bookingDetails.tip).toFixed(2);
    }
    return '5.00';
  };

  // Calculate total earnings
  const getTotalEarnings = () => {
    const deliveryCharge = parseFloat(getDeliveryCharge());
    const tip = parseFloat(getEstimatedTip());
    return (deliveryCharge + tip).toFixed(2);
  };

  // If not authenticated, show error
  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pick Up Dry Cleaning</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Authentication required</Text>
          <TouchableOpacity 
            style={styles.backToLocatorButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.backToLocatorText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // If no booking details, show error
  if (!bookingDetails && !loadingBooking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pick Up Dry Cleaning</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No booking details found</Text>
          <TouchableOpacity 
            style={styles.backToLocatorButton}
            onPress={() => router.push('/dryCleanerDriver/dryCleaningLocator')}
          >
            <Text style={styles.backToLocatorText}>Back to Locator</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header - Fixed at top */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick Up Dry Cleaning</Text>
      </View>

      {/* ADD THIS: Geocoding loading indicator */}
      {isGeocodingPickup && (
        <View style={styles.geocodingOverlay}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.geocodingText}>Finding location...</Text>
        </View>
      )}
      
      {/* Map View - Takes remaining space */}
      <View style={styles.mapContainer}>
        {renderMap()}

        {/* Distance and Duration Info */}
        {(routeDistance || bookingDetails?.calculatedDistance) && (
          <View style={styles.routeInfoContainer}>
            <View style={styles.routeInfoCard}>
              <MaterialIcons name="directions" size={20} color="#4285F4" />
              <Text style={styles.routeInfoText}>
                {routeDistance || bookingDetails.calculatedDistance}
              </Text>
              <Text style={styles.routeInfoSeparator}>•</Text>
              <Text style={styles.routeInfoText}>
                {routeDuration || bookingDetails.calculatedDuration}
              </Text>
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
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <MaterialIcons name="my-location" size={24} color="#4A90E2" />
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
            <MaterialIcons name="zoom-out-map" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        {/* Route Loading Indicator */}
        {(isRouteLoading || loadingBooking) && (
          <View style={styles.routeLoadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.routeLoadingText}>
              {loadingBooking ? 'Loading booking details...' : 'Calculating route...'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Card - Fixed at bottom */}
      <View style={styles.bottomCard}>
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Provider Info */}
          <View style={styles.providerSection}>
            <View style={styles.providerInfoRow}>
              <View style={styles.providerIconContainer}>
                <Image 
                  source={images.washing} 
                  style={styles.providerIcon} 
                />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {bookingDetails?.dryCleaner?.shopname || bookingDetails?.name || 'Dry Cleaning Service'}
                </Text>
                <Text style={styles.orderNumber}>
                  Order: {bookingDetails?.orderNumber || bookingDetails?.id || 'N/A'}
                </Text>
                <Text style={[styles.status, { color: getStatusColor(bookingDetails?.status) }]}>
                  Status: {bookingDetails?.status?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.orderDetailsButton}
                onPress={() => {
                  router.push({
                    pathname: '/OrderDetailes',
                    params: {
                      bookingData: JSON.stringify(bookingDetails)
                    }
                  });
                }}
              >
                <Text style={styles.orderDetailsText}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup and Dropoff */}
          <View style={styles.locationContainer}>
            {/* Pickup */}
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.greenDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Pickup</Text>
                <Text style={styles.locationAddress}>
                  {bookingDetails?.pickupAddress || 'Pickup location'}
                </Text>
              </View>
            </View>

            {/* Connecting Line */}
            <View style={styles.locationLine} />

            {/* Dropoff */}
            <View style={styles.locationRow}>
              <View style={styles.locationIconContainer}>
                <View style={styles.orangeDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationType}>Drop Off</Text>
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
                {routeDistance || bookingDetails?.calculatedDistance || 'Calculating...'}
              </Text>
            </View>
            <View style={styles.tripDetailItem}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.tripDetailText}>
                {routeDuration || bookingDetails?.calculatedDuration || 'Calculating...'}
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
              <Text style={styles.totalValue}>
                ${getTotalEarnings()}
              </Text>
            </View>
            <View style={styles.pricingInfo}>
              <Text style={styles.pricingInfoText}>
                Route via Google Maps • Distance: {bookingDetails?.distanceInKm || '0'} km
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {bookingDetails?.status === 'pending' || bookingDetails?.status === 'requested' ? (
            <>
              <TouchableOpacity 
                style={[styles.acceptButton, isAccepting && styles.disabledButton]} 
                onPress={handleAcceptBooking}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept Booking</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.rejectButton} 
                onPress={handleRejectBooking}
                disabled={isAccepting}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.acceptButton} 
                onPress={() => {
                  router.push({
                    pathname: '/DryCleaningPickup',
                    params: {
                      bookingData: JSON.stringify(bookingDetails)
                    }
                  });
                }}
              >
                <Text style={styles.acceptButtonText}>Start Trip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.newPickupButton} 
                onPress={() => {
                  router.push('/dryCleanerDriver/dryCleaningLocator');
                }}
              >
                <Text style={styles.newPickupButtonText}>New Pickup</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'accepted':
      return '#4CAF50';
    case 'pending':
    case 'requested':
      return '#FF8C00';
    case 'rejected':
      return '#FF0000';
    case 'completed':
      return '#2196F3';
    default:
      return '#666666';
  }
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
    backgroundColor: '#4A90E2',
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
  pickupMarker: {
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
  mockBadge: {
    fontSize: 12,
    color: '#FF8C00',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
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
    justifyContent: 'space-between',
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
    textTransform: 'uppercase',
  },
  orderDetailsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  orderDetailsText: {
    fontSize: 14,
    color: '#666666',
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
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
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
  pricingInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  pricingInfoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#FFFFFF',
  },
  acceptButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#FF8C00',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rejectButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  newPickupButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#6B7280',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6B7280',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  newPickupButtonText: {
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
    marginBottom: 20,
  },
  backToLocatorButton: {
    backgroundColor: colors.brandColor || '#FF8C00',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  backToLocatorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DryCleaningPickup;