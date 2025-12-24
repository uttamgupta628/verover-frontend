import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import colors from '../../assets/color';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const DriverHistory = () => {
  const router = useRouter();

  // Redux auth state
  const { user, token, isAuthenticated } = useSelector((state) => state.auth);

  // State management
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // QR Modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert(
        'Authentication Required',
        'Please log in to view your history',
        [
          {
            text: 'OK',
            onPress: () => router.push('/login')
          }
        ]
      );
      return;
    }

    fetchDriverHistory(1, false);
  }, [isAuthenticated, token]);

  // Get auth token from Redux store
  const getAuthToken = () => {
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  };

  // Enhanced API call with better error handling
  const makeApiCall = async (url, method = 'GET') => {
    try {
      const authToken = getAuthToken();
      console.log('Making API call to:', url);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      const responseText = await response.text();
      console.log('Raw response text:', responseText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error(`Server returned invalid JSON. Status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return { success: true, data };
    } catch (error) {
      console.error('API call error:', error);
      return { success: false, error: error.message };
    }
  };

  // Fetch driver history from API
  const fetchDriverHistory = async (page = 1, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Replace with your actual API URL
      const historyEndpoint = `https://vervoer-backend2.onrender.com/api/users/driver/history?page=${page}&limit=10`;
      const result = await makeApiCall(historyEndpoint, 'GET');

      if (result.success && result.data.success) {
        const { bookings: newBookings, pagination, totalEarnings, totalCompletedTrips } = result.data.data;
        
        console.log('History data loaded:', {
          bookingsCount: newBookings.length,
          totalEarnings,
          totalTrips: totalCompletedTrips,
          currentPage: pagination.page,
          totalPages: pagination.pages
        });

        if (isLoadMore) {
          setBookings(prev => [...prev, ...newBookings]);
        } else {
          setBookings(newBookings);
          setTotalEarnings(totalEarnings || 0);
          setTotalTrips(totalCompletedTrips || 0);
        }

        setCurrentPage(pagination.page);
        setTotalPages(pagination.pages);
        setHasMore(pagination.page < pagination.pages);

      } else {
        throw new Error(result.error || 'Failed to fetch driver history');
      }

    } catch (error) {
      console.error('Fetch history error:', error);
      Alert.alert(
        'Error',
        `Failed to load history: ${error.message}`,
        [
          {
            text: 'Retry',
            onPress: () => fetchDriverHistory(page, isLoadMore)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);
    fetchDriverHistory(1, false);
  }, []);

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && currentPage < totalPages) {
      fetchDriverHistory(currentPage + 1, true);
    }
  };

  // Generate QR Code Data
  const generateQRData = (booking) => {
    if (!booking) return '';
    
    const qrData = {
      bookingId: booking._id || booking.id,
      orderNumber: booking.orderNumber,
      trackingId: booking.Tracking_ID,
      driver: {
        name: `${user.firstName} ${user.lastName}`.trim() || user.fullName,
        id: user._id,
        phone: user.phoneNumber || user.phone,
      },
      customer: {
        name: `${booking.user?.firstName} ${booking.user?.lastName}`.trim(),
        phone: booking.user?.phoneNumber,
      },
      service: {
        dryCleaner: booking.dryCleaner?.shopname || 'Dry Cleaning Service',
      },
      route: {
        pickup: booking.pickupAddress,
        dropoff: booking.dropoffAddress,
        distance: booking.distance,
        time: booking.time,
      },
      payment: {
        deliveryCharge: booking.deliveryCharge || booking.pricing?.deliveryCharge,
        items: booking.totalItems || booking.orderItems?.length || 0,
      },
      date: formatDate(booking.completedAt || booking.startedAt || booking.createdAt),
      time: formatTime(booking.completedAt || booking.startedAt || booking.createdAt),
      status: booking.status,
      verifyUrl: `https://yourapp.com/verify/${booking.Tracking_ID}`,
    };
    
    return JSON.stringify(qrData);
  };

  // Show QR Modal
  const handleShowQR = (booking) => {
    setSelectedBooking(booking);
    setShowQRModal(true);
  };

  // Share QR Data
  const handleShareQR = async () => {
    if (!selectedBooking) return;
    
    try {
      const qrText = `Order #${selectedBooking.orderNumber}\nTracking: ${selectedBooking.Tracking_ID}\nStatus: ${getStatusText(selectedBooking.status)}\nVerify: https://yourapp.com/verify/${selectedBooking.Tracking_ID}`;
      
      await Share.share({
        message: qrText,
        title: 'Delivery Details',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount === 'string') {
      return amount.startsWith('$') ? amount : `$${amount}`;
    }
    return `$${amount?.toFixed(2) || '0.00'}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (duration) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'cancelled':
        return '#F44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#666666';
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'COMPLETED';
      case 'in_progress':
        return 'IN PROGRESS';
      case 'cancelled':
        return 'CANCELLED';
      case 'pending':
        return 'PENDING';
      default:
        return status?.toUpperCase() || 'UNKNOWN';
    }
  };

  // Render booking item
  const renderBookingItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.bookingCard}
      onPress={() => handleShowQR(item)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.bookingHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order: {item.orderNumber}</Text>
          <Text style={styles.trackingId}>ID: {item.Tracking_ID}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.qrButton}
            onPress={() => handleShowQR(item)}
          >
            <MaterialCommunityIcons name="qrcode" size={20} color={colors.brandColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.customerSection}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.user?.firstName} {item.user?.lastName}</Text>
          <Text style={styles.customerPhone}>{item.user?.phoneNumber}</Text>
        </View>
        <View style={styles.priceSection}>
          <Text style={styles.deliveryCharge}>Delivery: {formatCurrency(item.deliveryCharge || item.pricing?.deliveryCharge)}</Text>
        </View>
      </View>

      {/* Location Info */}
      <View style={styles.locationSection}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationType}>Pickup</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {item.pickupAddress}
            </Text>
          </View>
        </View>
        
        <View style={styles.locationConnector} />
        
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#FF9800' }]} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationType}>Drop-off</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {item.dropoffAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Trip Details */}
      <View style={styles.tripDetailsSection}>
        <View style={styles.tripDetail}>
          <MaterialCommunityIcons name="map-marker-distance" size={16} color="#666" />
          <Text style={styles.tripDetailText}>{item.distance || 'N/A'} km</Text>
        </View>
        <View style={styles.tripDetail}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
          <Text style={styles.tripDetailText}>{item.time || 'N/A'} min</Text>
        </View>
        <View style={styles.tripDetail}>
          <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
          <Text style={styles.tripDetailText}>{item.totalItems || item.orderItems?.length || 0} items</Text>
        </View>
        {item.duration && (
          <View style={styles.tripDetail}>
            <MaterialCommunityIcons name="timer-outline" size={16} color="#666" />
            <Text style={styles.tripDetailText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
      </View>

      {/* Date Info */}
      <View style={styles.dateSection}>
        <Text style={styles.dateText}>
          {formatDate(item.completedAt || item.startedAt || item.createdAt)} at {formatTime(item.completedAt || item.startedAt || item.createdAt)}
        </Text>
      </View>

      {/* Tap to view QR hint */}
      <View style={styles.qrHint}>
        <MaterialCommunityIcons name="qrcode-scan" size={14} color="#999" />
        <Text style={styles.qrHintText}>Tap to view QR Code</Text>
      </View>
    </TouchableOpacity>
  );

  // Render footer for load more
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.brandColor} />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  };

  // If not authenticated, show error
  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery History</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Authentication required</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery History</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(totalEarnings)}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalTrips}</Text>
          <Text style={styles.statLabel}>Completed Trips</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${totalTrips > 0 ? (totalEarnings / totalTrips).toFixed(0) : '0'}</Text>
          <Text style={styles.statLabel}>Avg per Trip</Text>
        </View>
      </View>

      {/* Loading State */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading your history...</Text>
        </View>
      ) : (
        <>
          {/* History List */}
          <FlatList
            data={bookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item._id || item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.brandColor]}
                tintColor={colors.brandColor}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={() => (
              !loading && (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="truck-delivery" size={64} color="#CCCCCC" />
                  <Text style={styles.emptyText}>No delivery history found</Text>
                  <Text style={styles.emptySubText}>Complete your first delivery to see it here</Text>
                </View>
              )
            )}
          />
        </>
      )}

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <MaterialCommunityIcons name="qrcode" size={28} color={colors.brandColor} />
                <Text style={styles.modalTitle}>Delivery QR Code</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowQRModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Order Info */}
            {selectedBooking && (
              <>
                <View style={styles.modalOrderInfo}>
                  <Text style={styles.modalOrderNumber}>Order: {selectedBooking.orderNumber}</Text>
                  <Text style={styles.modalTrackingId}>Tracking: {selectedBooking.Tracking_ID}</Text>
                  <View style={[styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedBooking.status) }]}>
                    <Text style={styles.modalStatusText}>{getStatusText(selectedBooking.status)}</Text>
                  </View>
                </View>

                {/* QR Code */}
                <View style={styles.modalQRContainer}>
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={generateQRData(selectedBooking)}
                      size={220}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.modalQRLabel}>Scan to verify delivery details</Text>
                </View>

                {/* Delivery Details Summary */}
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="account" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {selectedBooking.user?.firstName} {selectedBooking.user?.lastName}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="map-marker-distance" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {selectedBooking.distance || 'N/A'} km • {selectedBooking.time || 'N/A'} min
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="cash" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {formatCurrency(selectedBooking.deliveryCharge || selectedBooking.pricing?.deliveryCharge)}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <MaterialCommunityIcons name="calendar" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {formatDate(selectedBooking.completedAt || selectedBooking.startedAt || selectedBooking.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.shareQRButton}
                    onPress={handleShareQR}
                  >
                    <MaterialCommunityIcons name="share-variant" size={20} color="#FFFFFF" />
                    <Text style={styles.shareQRButtonText}>Share Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.closeModalButton}
                    onPress={() => setShowQRModal(false)}
                  >
                    <Text style={styles.closeModalButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.brandColor,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  trackingId: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  qrButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  customerPhone: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  deliveryCharge: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  locationSection: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  locationConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
    marginVertical: 4,
  },
  locationInfo: {
    flex: 1,
    marginBottom: 8,
  },
  locationType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  locationAddress: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
    lineHeight: 18,
  },
  tripDetailsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  tripDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  tripDetailText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  dateSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
  },
  qrHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 6,
  },
  qrHintText: {
    fontSize: 11,
    color: '#999999',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  footerLoaderText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666666',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
    textAlign: 'center',
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
  loginButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOrderInfo: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  modalOrderNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  modalTrackingId: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  modalStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modalQRContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.brandColor,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  modalQRLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  modalDetails: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalDetailText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  shareQRButton: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    backgroundColor: colors.brandColor,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  shareQRButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeModalButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
});

export default DriverHistory;