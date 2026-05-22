import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert, RefreshControl,
  Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import axiosInstance from '../../api/axios';
import colors from '../../assets/color';

const { height } = Dimensions.get('window');

const HIDDEN_STATUSES = [
  'dropped_at_center', 'completed', 'rejected', 'cancelled', 'delivered',
];

const TAPPABLE_STATUSES = [
  'pending', 'requested', 'accepted', 'in_progress', 'pickup_completed',
  'en_route_to_dropoff', 'arrived_at_dropoff', 'ready_for_delivery',
];

interface ServiceProvider {
  id: string;
  name: string;
  pickup: string;
  dropOff: string;
  miles: string;
  time: string;
  deliveryCharge: string;
  status: string;
  orderNumber: string;
  trackingId?: string;
  isReturnDelivery?: boolean;
  user?: { id: string; name: string; phone?: string; email?: string };
  dryCleaner?: { id: string; name: string; address?: any; phone?: string };
  scheduledPickup?: string;
  scheduledDelivery?: string;
  createdAt: string;
  isScheduled?: boolean;
  priority?: string;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'accepted': return '#4CAF50';
    case 'pending':
    case 'requested': return '#FF8C00';
    case 'ready_for_delivery': return '#2196F3';
    case 'in_progress': return '#9C27B0';
    case 'pickup_completed': return '#03A9F4';
    case 'en_route_to_dropoff':
    case 'arrived_at_dropoff': return '#FF5722';
    case 'rejected': return '#FF0000';
    case 'completed': return '#4CAF50';
    default: return '#666666';
  }
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: 'PENDING',
    requested: 'REQUESTED',
    accepted: 'ASSIGNED TO YOU',
    in_progress: 'IN PROGRESS',
    ready_for_delivery: 'RETURN DELIVERY AVAILABLE',
    pickup_completed: 'PICKED UP',
    en_route_to_dropoff: 'EN ROUTE',
    arrived_at_dropoff: 'ARRIVED',
  };
  return map[status] || status?.toUpperCase();
};

const DryCleaningLocator = () => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authToken = useSelector((state: any) => state.auth?.token);

  const [isExpanded, setIsExpanded] = useState(false);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverStatus, setDriverStatus] = useState<any>(null);
  const [currLoc, setCurrLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);

  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permission in settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const newLocation = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setCurrLoc(newLocation);
      const region: Region = { ...newLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };
      setInitialRegion(region);
      if (mapRef.current && mapReady) setTimeout(() => mapRef.current?.animateToRegion(region, 1000), 500);
    } catch {
      const defaultLocation = { latitude: 20.5937, longitude: 78.9629 };
      setCurrLoc(defaultLocation);
      setInitialRegion({ ...defaultLocation, latitudeDelta: 5, longitudeDelta: 5 });
    } finally {
      setLocationLoading(false);
    }
  }, [mapReady]);

  useEffect(() => { getCurrentLocation(); }, []);

  const fetchDriverRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      if (!authToken) throw new Error('Authentication token not found');
      const response = await axiosInstance.get('/users/driver/requests', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { limit: 50 },
        timeout: 8000,
      });
      const data = response.data;
      if (!data.success || !data.data) throw new Error(data.message || 'Invalid response');
      if (data.data.driverStatus) setDriverStatus(data.data.driverStatus);
      if (Array.isArray(data.data.bookings)) {
        const visible = data.data.bookings.filter(
          (b: any) => !HIDDEN_STATUSES.includes(b.status?.toLowerCase()),
        );
        const transformed: ServiceProvider[] = visible.map((b: any, i: number) => {
          const rawCharge =
            b.deliveryCharge ??
            b.pricing?.deliveryCharge ??
            b.pricing?.totalAmount ??
            0;
          const chargeStr = parseFloat(String(rawCharge)).toFixed(2);

          const isReturnDelivery =
            b.status === 'ready_for_delivery' ||
            b.metadata?.isReturnDelivery === true ||
            b.bookingType === 'delivery';

          return {
            id: b._id,
            name: b.dryCleaner?.shopname || b.dryCleaner?.name || `Provider ${i + 1}`,
            pickup: b.pickupAddress || 'Pickup address not specified',
            dropOff: b.dropoffAddress || 'Drop-off address not specified',
            miles: `${b.distance || 0} miles`,
            time: `${b.time || b.estimatedTime || 0} min`,
            deliveryCharge: chargeStr,
            status: b.status,
            orderNumber: b.orderNumber || `ORD-${b._id.slice(-6)}`,
            trackingId: b.Tracking_ID || b.trackingId,
            isReturnDelivery,
            user: {
              id: b.user?._id || b.user?.id || '',
              name:
                `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim() ||
                b.user?.fullName ||
                b.user?.name ||
                'Customer',
              phone: b.user?.phoneNumber || b.user?.phone,
              email: b.user?.email,
            },
            dryCleaner: {
              id: b.dryCleaner?._id || b.dryCleaner?.id || '',
              name: b.dryCleaner?.shopname || b.dryCleaner?.name || 'Dry Cleaner',
              address: b.dryCleaner?.address,
              phone: b.dryCleaner?.phoneNumber || b.dryCleaner?.phone,
            },
            scheduledPickup: b.scheduledPickupDateTime,
            scheduledDelivery: b.scheduledDeliveryDateTime,
            createdAt: b.createdAt,
            isScheduled: b.isScheduled,
            priority: b.priority || 'normal',
          };
        });
        setServiceProviders(transformed);
      } else {
        setServiceProviders([]);
      }
    } catch (err: any) {
      let msg = 'Failed to load pending orders';
      if (err.code === 'ECONNABORTED') msg = 'Request timeout. Check your internet connection.';
      else if (err.response?.status === 401) msg = 'Session expired. Please login again.';
      else if (err.response?.status === 404) msg = 'No pending orders available.';
      else if (err.message) msg = err.message;
      if (!isRefresh && msg !== 'No pending orders available.') Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) { setLoading(false); return; }
    fetchDriverRequests();
    pollRef.current = setInterval(() => fetchDriverRequests(true), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [authToken, fetchDriverRequests]);

  /**
   * FIXED ROUTING LOGIC
   * ─────────────────────────────────────────────────────────────────────────
   * The journey has TWO legs:
   *
   * LEG 1 — Pickup:  customer → dry cleaner
   *   Statuses: pending | requested  → dryCleaningPickup (driver accepts here)
   *   Statuses: accepted | in_progress | pickup_completed
   *             | en_route_to_dropoff | arrived_at_dropoff
   *                                  → dryCleanerDropup  (leg-1 flag: isReturnDelivery=false)
   *
   * LEG 2 — Return delivery: dry cleaner → customer
   *   Status:  ready_for_delivery       → dryCleanerDropup  (leg-2 flag: isReturnDelivery=true)
   */
  const handleProviderPress = (provider: ServiceProvider) => {
    if (!provider?.id) {
      Alert.alert('Error', 'Invalid booking data.');
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
        totalAmount: (parseFloat(provider.deliveryCharge) + 5).toFixed(2),
      },
      distance: provider.miles,
      time: provider.time,
      user: provider.user,
      scheduledPickup: provider.scheduledPickup,
      scheduledDelivery: provider.scheduledDelivery,
      isScheduled: provider.isScheduled,
      isReturnDelivery: provider.isReturnDelivery,
      createdAt: provider.createdAt,
      priority: provider.priority,
    };

    const s = provider.status;

    // ── LEG 1a: New unassigned order — driver reviews & accepts ──
    if (s === 'pending' || s === 'requested') {
      router.push({
        pathname: '/dryCleanerDriver/dryCleaningPickup',
        params: { providerData: JSON.stringify(bookingData) },
      });
      return;
    }

    // ── LEG 2: Clothes ready at dry cleaner — return delivery to customer ──
    if (s === 'ready_for_delivery') {
      router.push({
        pathname: '/dryCleanerDriver/dryCleanerDropup',
        params: {
          bookingData: JSON.stringify({
            ...bookingData,
            isReturnDelivery: true,
            // For leg-2 the "pickup" is the dry cleaner address
            pickupAddress: provider.dryCleaner?.address
              ? typeof provider.dryCleaner.address === 'string'
                ? provider.dryCleaner.address
                : [
                    provider.dryCleaner.address.street,
                    provider.dryCleaner.address.city,
                    provider.dryCleaner.address.state,
                  ]
                    .filter(Boolean)
                    .join(', ')
              : provider.pickup,
            // "dropoff" is the customer's address
            dropoffAddress: provider.dropOff,
          }),
        },
      });
      return;
    }

    // ── LEG 1b: In-progress leg-1 trip (customer → dry cleaner) ──
    if (
      s === 'accepted' ||
      s === 'in_progress' ||
      s === 'pickup_completed' ||
      s === 'en_route_to_dropoff' ||
      s === 'arrived_at_dropoff'
    ) {
      router.push({
        pathname: '/dryCleanerDriver/dryCleanerDropup',
        params: {
          bookingData: JSON.stringify({
            ...bookingData,
            isReturnDelivery: false,
          }),
        },
      });
      return;
    }

    Alert.alert('Unavailable', `This order (${s}) cannot be actioned.`);
  };

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>Google Maps not available on web</Text>
        </View>
      );
    }
    const mapRegion: Region = initialRegion || {
      latitude: 20.5937, longitude: 78.9629,
      latitudeDelta: 5, longitudeDelta: 5,
    };
    return (
      <MapView
        ref={mapRef}
        style={styles.mapImage}
        provider={PROVIDER_GOOGLE}
        initialRegion={mapRegion}
        onMapReady={() => setMapReady(true)}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        showsScale
        zoomControlEnabled
        loadingEnabled
        loadingIndicatorColor={colors.brandColor}
        loadingBackgroundColor="#FFFFFF"
      />
    );
  };

  const renderProviderCard = (provider: ServiceProvider) => {
    const tappable = TAPPABLE_STATUSES.includes(provider.status);
    const isAssigned = provider.status === 'accepted';
    const isReturnTrip = provider.isReturnDelivery || provider.status === 'ready_for_delivery';
    const isActive = ['in_progress', 'pickup_completed', 'en_route_to_dropoff', 'arrived_at_dropoff'].includes(provider.status);
    const isReadyForDelivery = provider.status === 'ready_for_delivery';

    const dryCleanerAddressStr = provider.dryCleaner?.address
      ? typeof provider.dryCleaner.address === 'string'
        ? provider.dryCleaner.address
        : [
            (provider.dryCleaner.address as any).street,
            (provider.dryCleaner.address as any).city,
            (provider.dryCleaner.address as any).state,
          ]
            .filter(Boolean)
            .join(', ') || JSON.stringify(provider.dryCleaner.address)
      : provider.pickup;

    return (
      <TouchableOpacity
        key={provider.id}
        style={[
          styles.providerCard,
          provider.priority === 'high' && styles.highPriorityCard,
          isAssigned && styles.assignedCard,
          isActive && styles.activeCard,
          isReadyForDelivery && styles.returnDeliveryCard,
          !tappable && styles.unavailableCard,
        ]}
        onPress={() => handleProviderPress(provider)}
        activeOpacity={0.75}
        disabled={!tappable}
      >
        {(isAssigned || isActive || isReadyForDelivery) && (
          <View
            style={[
              styles.assignedBanner,
              isActive && { backgroundColor: '#9C27B0' },
              isReadyForDelivery && { backgroundColor: '#2196F3' },
            ]}
          >
            <MaterialIcons
              name={isReadyForDelivery || isReturnTrip ? 'local-shipping' : isActive ? 'directions-car' : 'assignment-ind'}
              size={14}
              color="#fff"
            />
            <Text style={styles.assignedBannerText}>
              {isReadyForDelivery
                ? '🚚 Clothes are clean — pick from dry cleaner & deliver to customer'
                : isActive
                ? '🚗 Your active trip (leg 1) — tap to continue'
                : '✅ Assigned to you — tap to start trip'}
            </Text>
          </View>
        )}

        <View style={styles.providerHeader}>
          <View
            style={[
              styles.providerIconContainer,
              isAssigned && { backgroundColor: '#4CAF50' },
              isActive && { backgroundColor: '#9C27B0' },
              isReadyForDelivery && { backgroundColor: '#2196F3' },
            ]}
          >
            <MaterialIcons
              name={isReturnTrip ? 'local-shipping' : 'local-laundry-service'}
              size={22}
              color="#fff"
            />
          </View>

          <View style={styles.providerNameContainer}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.orderNumber}>Order: {provider.orderNumber}</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusText, { color: getStatusColor(provider.status) }]}>
                {getStatusLabel(provider.status)}
              </Text>
              {provider.priority === 'high' && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>HIGH PRIORITY</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardActions}>
            <Text
              style={[
                styles.tapToView,
                (isAssigned || isActive) && { color: '#4CAF50', fontWeight: '600' },
                isReadyForDelivery && { color: '#2196F3', fontWeight: '600' },
              ]}
            >
              {isActive
                ? 'Continue'
                : isAssigned
                ? 'Start trip'
                : isReadyForDelivery
                ? 'Accept delivery'
                : tappable
                ? 'Tap to view'
                : 'Unavailable'}
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={18}
              color={isAssigned || isActive ? '#4CAF50' : isReadyForDelivery ? '#2196F3' : '#666'}
            />
          </View>
        </View>

        {provider.user?.name && (
          <View style={styles.customerInfo}>
            <MaterialIcons name="account-circle" size={14} color="#666" />
            <Text style={styles.customerName}>{provider.user.name}</Text>
          </View>
        )}

        <View style={styles.locationContainer}>
          {/* ── Leg 1: customer pickup → dry cleaner ─────────────────────── */}
          {/* ── Leg 2 (ready_for_delivery): dry cleaner → customer ────────── */}
          <View style={styles.locationRow}>
            <View style={styles.dotWrap}><View style={styles.greenDot} /></View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationType}>
                {isReadyForDelivery ? 'Pick from dry cleaner' : 'Pickup from customer'}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {isReadyForDelivery ? dryCleanerAddressStr : provider.pickup}
              </Text>
            </View>
          </View>
          <View style={styles.locationLine} />
          <View style={styles.locationRow}>
            <View style={styles.dotWrap}><View style={styles.orangeDot} /></View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationType}>
                {isReadyForDelivery ? 'Deliver to customer' : 'Drop off at dry cleaner'}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {isReadyForDelivery ? provider.dropOff : provider.dropOff}
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
            <MaterialIcons name="directions" size={16} color="#888" />
            <Text style={styles.tripText}>{provider.miles}</Text>
          </View>
          <View style={styles.tripInfo}>
            <MaterialIcons name="access-time" size={16} color="#888" />
            <Text style={styles.tripText}>{provider.time}</Text>
          </View>
          <Text style={[styles.priceText, isReadyForDelivery && { color: '#2196F3' }]}>
            ${provider.deliveryCharge}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={32} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Orders</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading orders…</Text>
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
            onRefresh={() => fetchDriverRequests(true)}
            colors={[colors.brandColor]}
            tintColor={colors.brandColor}
          />
        }
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={32} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orders</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => fetchDriverRequests()}>
            <MaterialIcons name="refresh" size={24} color={colors.brandColor} />
          </TouchableOpacity>
        </View>

        {driverStatus && (
          <View style={styles.driverStatusContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: driverStatus.isBooked ? '#FF8C00' : '#4CAF50' }]} />
            <Text style={styles.driverStatusText}>
              {driverStatus.isBooked ? 'Currently on a job' : 'Available for bookings'}
            </Text>
            {refreshing && <ActivityIndicator size="small" color={colors.brandColor} style={{ marginLeft: 8 }} />}
          </View>
        )}

        <View style={[styles.mapContainer, { height: isExpanded ? height : 280 }]}>
          {renderMap()}
          {locationLoading && (
            <View style={styles.locationLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.brandColor} />
              <Text style={styles.locationLoadingText}>Finding your location…</Text>
            </View>
          )}
          <View style={styles.mapControls}>
            <TouchableOpacity style={styles.mapBtn} onPress={getCurrentLocation} disabled={locationLoading}>
              <MaterialIcons name="my-location" size={22} color={locationLoading ? '#ccc' : colors.brandColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapBtn} onPress={() => setIsExpanded(p => !p)}>
              <MaterialIcons name={isExpanded ? 'fullscreen-exit' : 'fullscreen'} size={22} color={colors.brandColor} />
            </TouchableOpacity>
          </View>
          {currLoc && (
            <View style={styles.locationInfoCard}>
              <MaterialIcons name="my-location" size={14} color={colors.brandColor} />
              <Text style={styles.locationInfoText}>
                {currLoc.latitude.toFixed(4)}, {currLoc.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        {!isExpanded && (
          <View style={styles.whitesection}>
            <View style={styles.dragHandle} />

            <View style={styles.countsRow}>
              <View style={styles.countPill}>
                <View style={[styles.countDot, { backgroundColor: '#FF8C00' }]} />
                <Text style={styles.countLabel}>
                  {serviceProviders.filter(p => p.status === 'pending' || p.status === 'requested').length} pickup
                </Text>
              </View>
              <View style={styles.countPill}>
                <View style={[styles.countDot, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.countLabel}>
                  {serviceProviders.filter(p => p.status === 'ready_for_delivery').length} return
                </Text>
              </View>
              <View style={styles.countPill}>
                <View style={[styles.countDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.countLabel}>
                  {serviceProviders.filter(p => p.status === 'accepted').length} assigned
                </Text>
              </View>
              <View style={styles.countPill}>
                <View style={[styles.countDot, { backgroundColor: '#9C27B0' }]} />
                <Text style={styles.countLabel}>
                  {serviceProviders.filter(p =>
                    ['in_progress', 'pickup_completed', 'en_route_to_dropoff', 'arrived_at_dropoff'].includes(p.status),
                  ).length} active
                </Text>
              </View>
            </View>

            <View style={styles.providersContainer}>
              {serviceProviders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="local-shipping" size={52} color="#DDD" />
                  <Text style={styles.emptyText}>No orders at the moment</Text>
                  <Text style={styles.emptySubText}>
                    {driverStatus?.message || 'Pull down to refresh or check back later'}
                  </Text>
                </View>
              ) : (
                [...serviceProviders]
                  .sort((a, b) => {
                    const rank = (s: string) => {
                      if (['in_progress', 'pickup_completed', 'en_route_to_dropoff', 'arrived_at_dropoff'].includes(s)) return 0;
                      if (s === 'accepted') return 1;
                      if (s === 'ready_for_delivery') return 2;
                      return 3;
                    };
                    return rank(a.status) - rank(b.status);
                  })
                  .map(renderProviderCard)
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContainer: { flexGrow: 1 },
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111', flex: 1, marginLeft: 10 },
  refreshButton: { padding: 6 },
  driverStatusContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 8, backgroundColor: '#F8F9FA', marginHorizontal: 16,
    marginVertical: 8, borderRadius: 10,
  },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  driverStatusText: { fontSize: 14, fontWeight: '500', color: '#111', flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  mapContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  mapImage: { width: '100%', height: '100%' },
  mapPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' },
  placeholderText: { fontSize: 15, color: '#666' },
  locationLoadingOverlay: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center',
  },
  locationLoadingText: { marginLeft: 8, fontSize: 12, color: '#666' },
  locationInfoCard: {
    position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', elevation: 3,
  },
  locationInfoText: { marginLeft: 6, fontSize: 12, color: '#666' },
  mapControls: { position: 'absolute', bottom: 16, right: 14, gap: 10 },
  mapBtn: {
    width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, marginBottom: 8,
  },
  whitesection: { backgroundColor: '#FFFFFF', paddingVertical: 14 },
  dragHandle: {
    width: 44, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3,
    alignSelf: 'center', marginBottom: 12,
  },
  countsRow: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap',
    gap: 8, paddingHorizontal: 16, marginBottom: 10,
  },
  countPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  countDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  countLabel: { fontSize: 12, color: '#555', fontWeight: '500' },
  providersContainer: { paddingHorizontal: 14, marginTop: 4 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#999', textAlign: 'center' },
  providerCard: {
    backgroundColor: '#F7F7F7', borderRadius: 14, padding: 14, marginVertical: 7,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, overflow: 'hidden',
  },
  highPriorityCard: { borderLeftWidth: 4, borderLeftColor: '#FF0000' },
  assignedCard: { borderLeftWidth: 4, borderLeftColor: '#4CAF50', backgroundColor: '#F0FFF4' },
  activeCard: { borderLeftWidth: 4, borderLeftColor: '#9C27B0', backgroundColor: '#FCF5FF' },
  returnDeliveryCard: { borderLeftWidth: 4, borderLeftColor: '#2196F3', backgroundColor: '#E3F2FD' },
  unavailableCard: { opacity: 0.5, backgroundColor: '#EFEFEF' },
  assignedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4CAF50',
    paddingHorizontal: 10, paddingVertical: 5,
    marginHorizontal: -14, marginTop: -14, marginBottom: 10,
  },
  assignedBannerText: { fontSize: 11, color: '#fff', fontWeight: '600', flex: 1 },
  providerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  providerIconContainer: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF8C00',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  providerNameContainer: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '700', color: '#111' },
  orderNumber: { fontSize: 11, color: '#888', marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  priorityBadge: { backgroundColor: '#FF0000', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  priorityText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  cardActions: { alignItems: 'flex-end' },
  tapToView: { fontSize: 11, color: '#888', marginBottom: 2 },
  customerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  customerName: { fontSize: 12, color: '#666', marginLeft: 4 },
  locationContainer: { marginLeft: 6, marginBottom: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  dotWrap: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginTop: 3 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' },
  orangeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF8C00' },
  locationLine: { width: 2, height: 26, backgroundColor: '#DDD', marginLeft: 9, marginTop: -8, marginBottom: -8 },
  locationInfo: { marginLeft: 8, flex: 1 },
  locationType: { fontSize: 13, fontWeight: '600', color: '#222' },
  locationAddress: { fontSize: 12, color: '#666', marginTop: 1 },
  scheduledInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  scheduledText: { fontSize: 11, color: '#FF8C00', marginLeft: 4, fontWeight: '500' },
  tripDetails: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tripInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripText: { fontSize: 12, color: '#666' },
  priceText: { fontSize: 16, fontWeight: '700', color: '#FF8C00' },
});

export default DryCleaningLocator;