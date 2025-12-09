import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from "expo-location";
import axiosInstance from '../../api/axios';
import { images } from '../../assets/images/images';
import colors from '../../assets/color';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = "AIzaSyBn5c5hk6ko6gEwZ3IyWK6AkU4_U_tp_4g";
interface ServiceProvider {
  id: string;
  name: string;
  icon: string;
  pickup: string;
  dropOff: string;
  miles: string;
  time: string;
  deliveryCharge: string;
  status: string;
  orderNumber: string;
  trackingId?: string;
  pickupCoords?: { latitude: number; longitude: number } | null;
  dropoffCoords?: { latitude: number; longitude: number } | null;
  user?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  dryCleaner?: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
  };
  scheduledPickup?: string;
  scheduledDelivery?: string;
  createdAt: string;
  isScheduled?: boolean;
  priority?: string;
}

// const GOOGLE_MAPS_API_KEY = "AIzaSyBn5c5hk6ko6gEwZ3IyWK6AkU4_U_tp_4g";
const DryCleaningLocator = () => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  
  // Get auth token from Redux
  const authToken = useSelector((state: any) => state.auth?.token);
  const user = useSelector((state: any) => state.auth?.user);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverStatus, setDriverStatus] = useState<any>(null);
  
  // Location states
  const [currLoc, setCurrLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  if (!address || address.trim() === '') {
    console.warn('⚠️ Empty address provided for geocoding');
    return null;
  }

  try {
    console.log('🌍 Geocoding address:', address);
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results?.[0]) {
      const location = data.results[0].geometry.location;
      const coords = {
        latitude: location.lat,
        longitude: location.lng,
      };
      console.log('✅ Geocoded successfully:', address, '→', coords);
      return coords;
    } else {
      console.error('❌ Geocoding failed for:', address, 'Status:', data.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Geocoding error for:', address, error);
    return null;
  }
};

// Geocode multiple addresses in batch with rate limiting
const geocodeMultipleAddresses = async (
  providers: ServiceProvider[]
): Promise<ServiceProvider[]> => {
  console.log('🌍 Starting batch geocoding for', providers.length, 'providers...');
  
  const updatedProviders = [...providers];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < updatedProviders.length; i++) {
    const provider = updatedProviders[i];

    // Geocode pickup if needed
    if (!provider.pickupCoords || provider.pickupCoords.needsGeocoding) {
      const address = provider.pickupCoords?.address || provider.pickup;
      const coords = await geocodeAddress(address);
      if (coords) {
        updatedProviders[i].pickupCoords = coords;
      } else {
        console.warn('⚠️ Failed to geocode pickup:', address);
        updatedProviders[i].pickupCoords = null;
      }
      // INCREASED DELAY: 300ms instead of 100ms
      await delay(300);
    }

    // Geocode dropoff if needed
    if (!provider.dropoffCoords || provider.dropoffCoords.needsGeocoding) {
      const address = provider.dropoffCoords?.address || provider.dropOff;
      const coords = await geocodeAddress(address);
      if (coords) {
        updatedProviders[i].dropoffCoords = coords;
      } else {
        console.warn('⚠️ Failed to geocode dropoff:', address);
        updatedProviders[i].dropoffCoords = null;
      }
      // INCREASED DELAY
      await delay(300);
    }
  }

  console.log('✅ Batch geocoding completed');
  return updatedProviders;
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
        accuracy: Location.Accuracy.Balanced,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrLoc(newLocation);

      if (mapRef.current && mapReady) {
        const region: Region = {
          ...newLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        mapRef.current.animateToRegion(region, 1000);
      }
    } catch (err: any) {
      console.error("Location error:", err);
      Alert.alert(
        "Location Error",
        "Unable to get your current location. Please try again."
      );
    } finally {
      setLocationLoading(false);
    }
  }, [mapReady]);

  // Initialize location on mount
  useEffect(() => {
    const initLocation = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();

        if (status === "granted") {
          getCurrentLocation();
        } else {
          // Set default location to India
          const defaultLocation = {
            latitude: 20.5937,
            longitude: 78.9629,
          };
          setCurrLoc(defaultLocation);
        }
      } catch (err) {
        console.error("Permission check error:", err);
      }
    };

    initLocation();
  }, [getCurrentLocation]);

  // Fetch ALL pending driver requests from API
  const fetchDriverRequests = async (isRefresh = false) => {
  try {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    if (!authToken) {
      throw new Error('Authentication token not found. Please login again.');
    }
    
    const response = await axiosInstance.get('/users/driver/requests', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      params: {
        status: 'pending',
        includeAll: true,  
      },
      timeout: 10000,
    });

    const data = response.data;
    
    if (data.success && data.data) {
      if (data.data.driverStatus) {
        setDriverStatus(data.data.driverStatus);
      }

      if (data.data.bookings && Array.isArray(data.data.bookings)) {
        const pendingBookings = data.data.bookings.filter((booking: any) => 
          booking.status === 'pending' || booking.status === 'requested'
        );

        let transformedProviders: ServiceProvider[] = pendingBookings.map((booking: any, index: number) => {
          console.log('🔍 Processing booking:', booking._id);

          // Since backend doesn't provide coordinates, mark for geocoding
          const pickupCoords = { 
            needsGeocoding: true, 
            address: booking.pickupAddress 
          };
          
          const dropoffCoords = { 
            needsGeocoding: true, 
            address: booking.dropoffAddress 
          };

          return {
            id: booking._id,
            name: booking.dryCleaner?.shopname || booking.dryCleaner?.name || `Provider ${index + 1}`,
            icon: 'laundry',
            pickup: booking.pickupAddress || 'Pickup address not specified',
            dropOff: booking.dropoffAddress || 'Drop-off address not specified',
            miles: `${booking.distance || 0} miles`,
            time: `${booking.time || booking.estimatedTime || 0} min`,
            deliveryCharge: `${(booking.deliveryCharge || 0).toFixed(2)}`,
            status: booking.status,
            orderNumber: booking.orderNumber || `ORD-${booking._id.slice(-6)}`,
            trackingId: booking.Tracking_ID || booking.trackingId,
            pickupCoords: pickupCoords as any,
            dropoffCoords: dropoffCoords as any,
            pickupAddress: booking.pickupAddress,
            dropoffAddress: booking.dropoffAddress,
            user: {
              id: booking.user?._id || booking.user?.id || '',
              name: `${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim() || 
                    booking.user?.fullName || booking.user?.name || 'Customer',
              phone: booking.user?.phoneNumber || booking.user?.phone,
              email: booking.user?.email
            },
            dryCleaner: {
              id: booking.dryCleaner?._id || booking.dryCleaner?.id || '',
              name: booking.dryCleaner?.shopname || booking.dryCleaner?.name || 'Dry Cleaner',
              address: booking.dryCleaner?.address,
              phone: booking.dryCleaner?.phoneNumber || booking.dryCleaner?.phone
            },
            scheduledPickup: booking.scheduledPickupDateTime,
            scheduledDelivery: booking.scheduledDeliveryDateTime,
            createdAt: booking.createdAt,
            isScheduled: booking.isScheduled,
            priority: booking.priority || 'normal'
          };
        });

        // GEOCODE ALL ADDRESSES
        console.log('🌍 Geocoding addresses for all providers...');
        transformedProviders = await geocodeMultipleAddresses(transformedProviders);
        
        setServiceProviders(transformedProviders);

        // Fit map to show all markers
        if (transformedProviders.length > 0 && mapRef.current && mapReady) {
          const coords = transformedProviders
            .map(p => p.pickupCoords)
            .filter(c => c && c.latitude && c.longitude) as { latitude: number; longitude: number }[];
          
          if (coords.length > 0) {
            if (currLoc) {
              coords.push(currLoc);
            }
            
            setTimeout(() => {
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                animated: true,
              });
            }, 1000);
          }
        }
      } else {
        setServiceProviders([]);
      }
    } else {
      throw new Error(data.message || 'Invalid response format');
    }
  } catch (err: any) {
    console.error('❌ Error fetching driver requests:', err);
    
    let errorMessage = 'Failed to load service providers';
    
    if (err.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout. Please check your internet connection.';
    } else if (err.message?.includes('Network request failed') || err.message?.includes('Network Error')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (err.response) {
      errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
    } else if (err.request) {
      errorMessage = 'No response from server. Please check if the server is running.';
    } else {
      errorMessage = err.message || 'Unknown error occurred';
    }
    
    setError(errorMessage);
    
    if (!isRefresh) {
      Alert.alert('Error', errorMessage);
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  const onRefresh = useCallback(() => {
    fetchDriverRequests(true);
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchDriverRequests();
    } else {
      setLoading(false);
      setError('Please login to view driver requests');
    }
  }, [authToken]);

  // Auto-refresh every 30 seconds when app is active
  useEffect(() => {
    if (!authToken) return;

    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        console.log('🔄 Auto-refreshing pending orders...');
        fetchDriverRequests(true);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [loading, refreshing, authToken]);

  const handleRetry = () => {
    fetchDriverRequests();
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleProviderPress = (provider: ServiceProvider) => {
  if (!provider || !provider.id) {
    Alert.alert('Error', 'Invalid booking data. Please try again.');
    return;
  }

  if (provider.status !== 'pending' && provider.status !== 'requested') {
    Alert.alert(
      'Booking Unavailable', 
      `This booking is ${provider.status}. Only pending bookings can be accepted.`
    );
    return;
  }

  console.log('📱 Navigating to pickup screen with provider:', {
    id: provider.id,
    name: provider.name,
    status: provider.status,
    orderNumber: provider.orderNumber,
    hasPickupCoords: !!provider.pickupCoords,
    hasDropoffCoords: !!provider.dropoffCoords
  });
  
  // Create complete booking data with all necessary fields
  const bookingData = {
    // IDs and basic info
    id: provider.id,
    _id: provider.id,
    orderNumber: provider.orderNumber,
    trackingId: provider.trackingId,
    status: provider.status,
    
    // Provider/Dry Cleaner info
    name: provider.name,
    dryCleaner: provider.dryCleaner,
    
    // Addresses
    pickupAddress: provider.pickup,
    dropoffAddress: provider.dropOff,
    
    // CRITICAL: Include the geocoded coordinates
    pickupCoords: provider.pickupCoords && 
                  typeof provider.pickupCoords.latitude === 'number' &&
                  typeof provider.pickupCoords.longitude === 'number'
                    ? {
                        latitude: provider.pickupCoords.latitude,
                        longitude: provider.pickupCoords.longitude
                      }
                    : null,
    
    dropoffCoords: provider.dropoffCoords && 
                   typeof provider.dropoffCoords.latitude === 'number' &&
                   typeof provider.dropoffCoords.longitude === 'number'
                     ? {
                         latitude: provider.dropoffCoords.latitude,
                         longitude: provider.dropoffCoords.longitude
                       }
                     : null,
    
    // Pricing info
    deliveryCharge: provider.deliveryCharge,
    price: provider.deliveryCharge,
    pricing: {
      deliveryCharge: provider.deliveryCharge,
      estimatedTip: '5.00',
      totalAmount: (parseFloat(provider.deliveryCharge) + 5).toFixed(2)
    },
    
    // Trip details
    distance: provider.miles,
    time: provider.time,
    calculatedDistance: provider.miles,
    calculatedDuration: provider.time,
    
    // User info
    user: provider.user,
    
    // Scheduling
    scheduledPickup: provider.scheduledPickup,
    scheduledDelivery: provider.scheduledDelivery,
    isScheduled: provider.isScheduled,
    
    // Other fields
    createdAt: provider.createdAt,
    priority: provider.priority,
    
    // Navigation metadata
    navigationTimestamp: new Date().toISOString(),
    sourceScreen: 'DryCleaningLocator'
  };

  console.log('📦 Navigation data prepared:', {
    hasPickupCoords: !!bookingData.pickupCoords,
    hasDropoffCoords: !!bookingData.dropoffCoords,
    pickupCoords: bookingData.pickupCoords,
    dropoffCoords: bookingData.dropoffCoords
  });
  
  router.push({
    pathname: '/dryCleanerDriver/dryCleaningPickup',
    params: {
      providerData: JSON.stringify(bookingData)
    }
  });
};

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    console.log("Map is ready");
  }, []);

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
      case 'in_progress':
        return '#9C27B0';
      default:
        return '#666666';
    }
  };

  // Render map with live location
  const renderMap = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>
            Google Maps not available on web
          </Text>
        </View>
      );
    }

    const initialCoords = currLoc || {
      latitude: 20.5937,
      longitude: 78.9629,
    };

    const initialRegion: Region = {
      latitude: initialCoords.latitude,
      longitude: initialCoords.longitude,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };

    return (
      <MapView
        ref={mapRef}
        style={styles.mapImage}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        showsUserLocation={!!currLoc}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        zoomControlEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {/* Markers for service providers with location data */}
        {serviceProviders.map((provider) => {
          if (provider.pickupCoords) {
            return (
              <Marker
                key={`pickup-${provider.id}`}
                coordinate={provider.pickupCoords}
                title={provider.name}
                description={`Pickup: ${provider.pickup}`}
                onPress={() => handleProviderPress(provider)}
              >
                <View style={styles.markerCircle}>
                  <Image 
                    source={provider.icon === 'person' ? images.man1 : images.washing2} 
                    style={styles.markerIcon}
                    contentFit="cover"
                  />
                </View>
              </Marker>
            );
          }
          return null;
        })}
      </MapView>
    );
  };

  const renderProviderCard = (provider: ServiceProvider) => (
    <TouchableOpacity
      key={provider.id}
      style={[
        styles.providerCard,
        provider.priority === 'high' && styles.highPriorityCard,
        provider.status !== 'pending' && provider.status !== 'requested' && styles.unavailableCard
      ]}
      onPress={() => handleProviderPress(provider)}
      activeOpacity={0.7}
      disabled={provider.status !== 'pending' && provider.status !== 'requested'}
    >
      <View style={styles.providerHeader}>
        <View style={styles.providerIconContainer}>
          <Image
            source={provider.icon === 'person' ? images.man2 : images.washing}
            style={styles.providerIcon}
            contentFit="cover"
          />
        </View>
        <View style={styles.providerNameContainer}>
          <Text style={styles.providerName}>{provider.name}</Text>
          <Text style={styles.orderNumber}>Order: {provider.orderNumber}</Text>
          <View style={styles.statusContainer}>
            <Text style={[styles.status, { color: getStatusColor(provider.status) }]}>
              {provider.status?.toUpperCase()}
            </Text>
            {provider.priority === 'high' && (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>HIGH PRIORITY</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          <Text style={styles.tapToView}>
            {provider.status === 'pending' || provider.status === 'requested' ? 'Tap to view' : 'Unavailable'}
          </Text>
          <MaterialIcons name="chevron-right" size={16} color="#666666" />
        </View>
      </View>

      {provider.user?.name && (
        <View style={styles.customerInfo}>
          <MaterialIcons name="account-circle" size={14} color="#666666" />
          <Text style={styles.customerName}>{provider.user.name}</Text>
        </View>
      )}

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={styles.greenDot} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationType}>Pickup</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {provider.pickup}
            </Text>
          </View>
        </View>

        <View style={styles.locationLine} />

        <View style={styles.locationRow}>
          <View style={styles.locationDot1}>
            <View style={styles.orangeDot} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationType}>Drop Off</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {provider.dropOff}
            </Text>
          </View>
        </View>
      </View>

      {provider.scheduledPickup && (
        <View style={styles.scheduledInfo}>
          <MaterialIcons name="schedule" size={14} color="#FF8C00" />
          <Text style={styles.scheduledText}>
            Scheduled: {new Date(provider.scheduledPickup).toLocaleString()}
          </Text>
        </View>
      )}

      <View style={styles.tripDetails}>
        <View style={styles.tripInfo}>
          <Image source={images.location2} style={styles.tripIcon} contentFit="contain" />
          <Text style={styles.tripText}>{provider.miles}</Text>
        </View>
        <View style={styles.tripInfo}>
          <Image source={images.clock} style={styles.tripIcon1} contentFit="contain" />
          <Text style={styles.tripText}>{provider.time}</Text>
        </View>
        <Text style={styles.priceText}>${provider.deliveryCharge}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Locate Dry Cleaning</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading pending orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && serviceProviders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Locate Dry Cleaning</Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load pending orders</Text>
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.brandColor]}
            tintColor={colors.brandColor}
          />
        }
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Orders</Text>
          
          <TouchableOpacity style={styles.refreshButton} onPress={handleRetry}>
            <MaterialIcons name="refresh" size={24} color={colors.brandColor} />
          </TouchableOpacity>
        </View>

        {driverStatus && (
          <View style={styles.driverStatusContainer}>
            <View style={[
              styles.statusIndicator, 
              { backgroundColor: driverStatus.isBooked ? '#FF8C00' : '#4CAF50' }
            ]} />
            <Text style={styles.driverStatusText}>
              {driverStatus.isBooked ? 'Currently Booked' : 'Available for bookings'}
            </Text>
            {driverStatus.currentBookingId && (
              <Text style={styles.currentBookingText}>
                Current Booking: {driverStatus.currentBookingId}
              </Text>
            )}
          </View>
        )}

        {/* Live Google Map */}
        <View style={[styles.mapContainer, { height: isExpanded ? height : 400 }]}>
          {renderMap()}

          {locationLoading && (
            <View style={styles.locationLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.brandColor} />
            </View>
          )}

          {/* Map controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity onPress={getCurrentLocation} disabled={locationLoading}>
              <Image 
                source={images.currentlocation1} 
                style={[styles.controlIcon1, locationLoading && { opacity: 0.5 }]}
                contentFit="contain"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleExpand}>
              <Image 
                source={images.expand} 
                style={styles.controlIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {!isExpanded && (
          <View style={styles.whitesection}>
            <Image source={images.bar1} style={styles.bar} contentFit="contain" />
            
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                {serviceProviders.length} pending order{serviceProviders.length !== 1 ? 's' : ''} available
              </Text>
              {refreshing && (
                <ActivityIndicator size="small" color={colors.brandColor} style={styles.refreshIndicator} />
              )}
            </View>

            <View style={styles.providersContainer}>
              {serviceProviders.length === 0 ? (
                <View style={styles.noProvidersContainer}>
                  <MaterialIcons name="local-shipping" size={48} color="#CCCCCC" />
                  <Text style={styles.noProvidersText}>No pending orders at the moment</Text>
                  <Text style={styles.noProvidersSubText}>
                    {driverStatus?.message || "Pull down to refresh or check back later"}
                  </Text>
                </View>
              ) : (
                serviceProviders.map((provider) => renderProviderCard(provider))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles (keeping your existing styles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginTop: -20,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    marginLeft: 3,
    color: '#000000',
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  driverStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  driverStatusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  currentBookingText: {
    fontSize: 12,
    color: '#666666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  errorSubText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  mapContainer: {
    width: '100%',
    position: 'relative',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',

  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
  },
  locationLoadingOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 20,
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerCircle: {
  },
  markerIcon: {
    width: 35,
    height: 40,
    borderRadius: 3,
  },
  mapControls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    alignItems: 'center',
  },
  controlIcon: {
    width: 110,
    height: 110,
    top: 30,
    left: 20,
  },
  controlIcon1: {
    width: 110,
    height: 110,
    top: 60,
    left: 20,
  },
  providersContainer: {
    flex: 1,
    paddingHorizontal: 19,
    marginTop: 5,
  },
  whitesection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    marginTop: -10,
  },
  bar: {
    borderRadius: 20,
    height: 5,
    width: 60,
    alignSelf: 'center',
  },
  countContainer: {
    paddingHorizontal: 19,
    marginTop: 10,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  refreshIndicator: {
    marginLeft: 8,
  },
  noProvidersContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noProvidersText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  noProvidersSubText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  providerCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  highPriorityCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF0000',
  },
  unavailableCard: {
    opacity: 0.6,
    backgroundColor: '#F0F0F0',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  providerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerIcon: {
    width: 20,
    height: 23,
    tintColor: '#FFFFFF',
    borderRadius: 4,
  },
  providerNameContainer: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },
  orderNumber: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  priorityBadge: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  cardActions: {
    alignItems: 'flex-end',
  },
  tapToView: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  customerName: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  locationContainer: {
    marginLeft: 8,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationDot: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#58B466',
  },
  locationDot1: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F99026',
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
    height: 35,
    backgroundColor: '#CCCCCC',
    marginLeft: 11,
    top: -10,
  },
  locationInfo: {
    marginLeft: 8,
    flex: 1,
  },
  locationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  locationAddress: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  scheduledText: {
    fontSize: 12,
    color: '#FF8C00',
    marginLeft: 4,
    fontWeight: '500',
  },
  tripDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripIcon: {
    width: 12,
    height: 18,
    tintColor: '#666666',
    left:15,
  },
  tripIcon1: {
    width: 18,
    height: 18,
    tintColor: '#666666',
    left:20,
  },
  tripText: {
    fontSize: 12,
    color: '#666666',
    left:30,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF8C00',
  },
});

export default DryCleaningLocator;