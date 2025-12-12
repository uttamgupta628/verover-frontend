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

const DryCleaningLocator = () => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  
  const authToken = useSelector((state: any) => state.auth?.token);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverStatus, setDriverStatus] = useState<any>(null);
  
  const [currLoc, setCurrLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);

  // Get driver's current location
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

      // Get location with Balanced accuracy (faster than Highest)
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 5000, 
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log('📍 Driver location found:', newLocation);
      setCurrLoc(newLocation);

      // Set initial region for map
      const region: Region = {
        ...newLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setInitialRegion(region);

      // Center map on driver's location
      if (mapRef.current && mapReady) {
        setTimeout(() => {
          mapRef.current?.animateToRegion(region, 1000);
        }, 500);
      }

    } catch (err: any) {
      console.error("Location error:", err);
      // Set default location to India
      const defaultLocation = {
        latitude: 20.5937,
        longitude: 78.9629,
      };
      setCurrLoc(defaultLocation);
      
      const region: Region = {
        ...defaultLocation,
        latitudeDelta: 5,
        longitudeDelta: 5,
      };
      setInitialRegion(region);
    } finally {
      setLocationLoading(false);
    }
  }, [mapReady]);

  // Initialize location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Fast fetch - no geocoding
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
      
      // Fast API call with timeout
      const response = await axiosInstance.get('/users/driver/requests', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        params: {
          status: 'pending',
          limit: 20, // Limit results for speed
        },
        timeout: 5000, // 5 second timeout
      });

      const data = response.data;
      
      if (data.success && data.data) {
        if (data.data.driverStatus) {
          setDriverStatus(data.data.driverStatus);
        }

        if (data.data.bookings && Array.isArray(data.data.bookings)) {
          // FILTER: Only show pending or requested bookings
          const pendingBookings = data.data.bookings.filter((booking: any) => 
            booking.status === 'pending' || booking.status === 'requested'
          );

          // SIMPLE TRANSFORMATION - No geocoding
          const transformedProviders: ServiceProvider[] = pendingBookings.map((booking: any, index: number) => ({
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
          }));

          setServiceProviders(transformedProviders);
          console.log(`✅ Loaded ${transformedProviders.length} pending orders`);
          
        } else {
          setServiceProviders([]);
        }
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (err: any) {
      console.error('❌ Error fetching driver requests:', err);
      
      let errorMessage = 'Failed to load pending orders';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection.';
      } else if (err.message?.includes('Network request failed') || err.message?.includes('Network Error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
      } else if (err.response?.status === 404) {
        errorMessage = 'No pending orders available.';
      } else {
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
      
      if (!isRefresh && errorMessage !== 'No pending orders available.') {
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

    const bookingData = {
      id: provider.id,
      _id: provider.id,
      orderNumber: provider.orderNumber,
      trackingId: provider.trackingId,
      status: provider.status,
      name: provider.name,
      dryCleaner: provider.dryCleaner,
      pickupAddress: provider.pickup,
      dropoffAddress: provider.dropOff,
      deliveryCharge: provider.deliveryCharge,
      price: provider.deliveryCharge,
      pricing: {
        deliveryCharge: provider.deliveryCharge,
        estimatedTip: '5.00',
        totalAmount: (parseFloat(provider.deliveryCharge) + 5).toFixed(2)
      },
      distance: provider.miles,
      time: provider.time,
      user: provider.user,
      scheduledPickup: provider.scheduledPickup,
      scheduledDelivery: provider.scheduledDelivery,
      isScheduled: provider.isScheduled,
      createdAt: provider.createdAt,
      priority: provider.priority,
    };
    
    router.push({
      pathname: '/dryCleanerDriver/dryCleaningPickup',
      params: {
        providerData: JSON.stringify(bookingData)
      }
    });
  };

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    console.log('✅ Map ready');
  }, []);

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

    // Default to India if no location yet
    const defaultCoords = {
      latitude: 20.5937,
      longitude: 78.9629,
    };

    const mapRegion: Region = initialRegion || {
      latitude: defaultCoords.latitude,
      longitude: defaultCoords.longitude,
      latitudeDelta: 5,
      longitudeDelta: 5,
    };

    return (
      <MapView
        ref={mapRef}
        style={styles.mapImage}
        provider={PROVIDER_GOOGLE}
        initialRegion={mapRegion}
        onMapReady={handleMapReady}
        showsUserLocation={true}  // This shows the blue dot for current location
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        zoomControlEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
        rotateEnabled={true}
        loadingEnabled={true}
        loadingIndicatorColor={colors.brandColor}
        loadingBackgroundColor="#FFFFFF"
      >
        {/* No markers for orders - only showing driver location */}
        {/* MapView automatically shows user location when showsUserLocation={true} */}
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
            source={images.washing}
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Orders</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading pending orders...</Text>
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

        {/* Live Google Map - Shows driver's current location */}
        <View style={[styles.mapContainer, { height: isExpanded ? height : 300 }]}>
          {renderMap()}

          {locationLoading && (
            <View style={styles.locationLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.brandColor} />
              <Text style={styles.locationLoadingText}>Finding your location...</Text>
            </View>
          )}

          {/* Map controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity onPress={getCurrentLocation} disabled={locationLoading}>
              <Image 
                source={images.currentlocation1} 
                style={[styles.controlIcon, locationLoading && { opacity: 0.5 }]}
                contentFit="contain"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleExpand}>
              <Image 
                source={images.expand} 
                style={styles.controlIcon1}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Location info */}
          {currLoc && (
            <View style={styles.locationInfoCard}>
              <MaterialIcons name="my-location" size={16} color={colors.brandColor} />
              <Text style={styles.locationInfoText}>
                Your location: {currLoc.latitude.toFixed(4)}, {currLoc.longitude.toFixed(4)}
              </Text>
            </View>
          )}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 10,
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
    paddingTop: 100,
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
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
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
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666666',
  },
  locationInfoCard: {
    position: 'absolute',
    bottom: 70,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationInfoText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#666666',
  },
  mapControls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    alignItems: 'center',
  },
  controlIcon: {
    width: 50,
    height: 50,
  },
  controlIcon1: {
    width: 50,
    height: 50,
    marginTop: 10,
  },
  providersContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 5,
  },
  whitesection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },
  bar: {
    height: 5,
    width: 60,
    alignSelf: 'center',
    marginBottom: 10,
  },
  countContainer: {
    paddingHorizontal: 16,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
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
    marginBottom: 12,
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
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
  providerNameContainer: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
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
    marginTop: 2,
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
    marginTop: 2,
  },
  locationDot1: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#CCCCCC',
    marginLeft: 11,
    marginTop: -10,
    marginBottom: -10,
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
    width: 16,
    height: 16,
    marginRight: 6,
  },
  tripIcon1: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  tripText: {
    fontSize: 12,
    color: '#666666',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF8C00',
  },
});

export default DryCleaningLocator;