import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  StatusBar,
  FlatList,
  Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import axiosInstance from '../../api/axios';
import { saveOrderData } from '../../components/redux/userSlice';
import type { RootState } from '../../components/redux/store';
import type { OrderItem } from '../../components/redux/userSlice';
import type { NavigationProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

const MyOrder = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();
  
  // Get user from Redux for authentication
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  
  // Local state
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  
  // QR Code related states
  const [qrCode, setQrCode] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchAllUserBookings();
      }
    }, [user])
  );

  useEffect(() => {
    console.log('OrderDetailsScreen useEffect - User authenticated:', !!user);
    
    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }
    
    fetchAllUserBookings();
  }, [user]);

  // Enhanced helper function for delivery time calculation
  const calculateDeliveryTime = useCallback((timeInMinutes) => {
    if (!timeInMinutes) return 'N/A';
    
    const hours = Math.floor(timeInMinutes / 60);
    const minutes = timeInMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // Enhanced QR Code generation with Expo Haptics
  const generateBookingQRCode = useCallback(async (bookingId) => {
    if (!user?.token) {
      throw new Error('Authentication token not found');
    }

    try {
      console.log('Calling QR API for booking:', bookingId);
      const response = await axiosInstance.get(`users/bookings/${bookingId}/generate-qr`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      console.log('QR Code API Response:', response.data);

      if (response.data.success === false) {
        throw new Error(response.data.message || 'QR code generation failed');
      }

      const qrCodeData = response.data?.data?.qrCode;
      
      if (!qrCodeData) {
        throw new Error('No QR code data received from server');
      }

      return qrCodeData;

    } catch (error) {
      console.error('QR Code generation error:', error);
      
      if (error?.response?.status === 404) {
        throw new Error('Booking not found or QR service unavailable');
      } else if (error?.response?.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      } else if (error?.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      } else if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
        throw new Error('Request timed out. Please check your connection.');
      }
      
      throw error;
    }
  }, [user?.token]);

  // Enhanced QR code generation with haptic feedback
  const handleGenerateQRCode = useCallback(async (bookingId) => {
    if (!bookingId) {
      Alert.alert('Error', 'Booking ID is required');
      return;
    }

    setQrLoading(true);
    setQrError(null);
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log('Starting QR code generation for booking:', bookingId);
      const qrCodeData = await generateBookingQRCode(bookingId);
      
      if (qrCodeData) {
        console.log('QR code received successfully');
        setQrCode(qrCodeData);
        setQrModalVisible(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('No QR code data returned');
      }
    } catch (error) {
      console.error('QR Code generation failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const errorMessage = error?.message || 'Failed to generate QR code';
      setQrError(errorMessage);
      
      Alert.alert('QR Code Generation Failed', errorMessage);
    } finally {
      setQrLoading(false);
    }
  }, [generateBookingQRCode]);

  // Enhanced fetch function with better error handling
  const fetchAllUserBookings = useCallback(async () => {
    console.log('fetchAllUserBookings - Starting fetch for user:', user?._id);

    if (!user?._id || !user?.token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get('users/my-bookings', {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      console.log('fetchAllUserBookings - Response status:', response.status);
      
      const bookingsData = response.data?.data || response.data;
      
      if (!bookingsData) {
        throw new Error('No data received from server');
      }
      
      if (!Array.isArray(bookingsData)) {
        console.error('Unexpected response format:', typeof bookingsData, bookingsData);
        throw new Error('Invalid response format from server');
      }
      
      if (bookingsData.length === 0) {
        setError('No bookings found');
        setAllBookings([]);
        return;
      }

      const mappedBookings = bookingsData.map((booking, index) => {
        if (!booking || typeof booking !== 'object') {
          console.warn(`Invalid booking at index ${index}:`, booking);
          return null;
        }

        return {
          _id: booking._id || `temp-${index}`,
          orderNumber: booking.orderNumber || booking._id || `ORD-${index}`,
          orderId: booking._id,
          status: booking.status || 'pending',
          createdAt: booking.createdAt || new Date().toISOString(),
          
          scheduledPickupDateTime: booking.scheduledPickupDateTime || booking.pickupDate || booking.createdAt,
          scheduledDeliveryDateTime: booking.scheduledDeliveryDateTime || booking.deliveryDate,
          
          pickupAddress: booking.pickupAddress || '',
          dropoffAddress: booking.dropoffAddress || booking.deliveryAddress || '',
          
          orderItems: booking.orderItems || booking.items || [],
          items: booking.orderItems || booking.items || [],
          
          totalAmount: parseFloat(booking.pricing?.totalAmount || booking.totalPrice || booking.price || 0),
          price: parseFloat(booking.pricing?.totalAmount || booking.totalPrice || booking.price || 0),
          total: parseFloat(booking.pricing?.totalAmount || booking.totalPrice || booking.price || 0),
          
          time: booking.time || '',
          distance: booking.distance || '',
          bookingType: booking.bookingType || '',
          paymentMethod: booking.paymentMethod || '',
          paymentStatus: booking.paymentStatus || '',
          trackingId: booking.Tracking_ID || booking.trackingId || '',
          
          dryCleaner: booking.dryCleaner || null,
          user: booking.user || null,
          
          deliveryTime: booking.deliveryTime || calculateDeliveryTime(booking.time) || 'N/A',
        };
      }).filter(Boolean);

      setAllBookings(mappedBookings);
      setViewMode('list');
      console.log('fetchAllUserBookings - Successfully mapped bookings:', mappedBookings.length);

    } catch (error) {
      console.error('fetchAllUserBookings - Error:', error);
      
      let errorMessage = 'Failed to load bookings';
      
      if (error && typeof error === 'object') {
        if (error.response?.status === 500) {
          errorMessage = 'Server error - please try again';
        } else if (error.response?.status === 401) {
          errorMessage = 'Authentication failed - please login again';
        } else if (error.response?.status === 404) {
          errorMessage = 'Booking history endpoint not found';
        } else if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
          errorMessage = 'Request timed out - check your connection';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, calculateDeliveryTime]);

  // Enhanced order selection with haptic feedback
  const handleOrderSelect = useCallback((order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('Order selected:', order._id);
    setSelectedOrder(order);
    
    const reduxData = {
      orderId: order._id,
      items: order.orderItems || order.items || [],
      totalAmount: order.totalAmount,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
    };

    console.log('handleOrderSelect - Dispatching to Redux:', reduxData);
    dispatch(saveOrderData(reduxData));
    
    setViewMode('detail');
  }, [dispatch]);

  // Enhanced navigation with haptic feedback
  const handleChangeAddress = useCallback(() => {
    if (selectedOrder) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('PickupAndDeliveryAddressScreen', {
        bookingId: selectedOrder._id,
        currentPickupAddress: selectedOrder.pickupAddress,
        currentDropoffAddress: selectedOrder.dropoffAddress,
        orderNumber: selectedOrder.orderNumber || selectedOrder._id,
      });
    }
  }, [navigation, selectedOrder]);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch (error) {
      console.warn('formatDate error:', error);
      return 'Invalid date';
    }
  }, []);

  const formatTime = useCallback((timeString: string) => {
    if (!timeString) return 'Not specified';
    return timeString;
  }, []);

  // Get status color
  const getStatusColor = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'active':
      case 'accepted':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'completed':
        return '#2196F3';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  }, []);

  const totalAmount = useMemo(() => {
    if (!selectedOrder?.orderItems && !selectedOrder?.items) return '0.00';
    const items = selectedOrder.orderItems || selectedOrder.items || [];
    return items.reduce((total: number, item: any) => {
      return total + (parseFloat(item.price || '0') * (item.quantity || item.qty || 1));
    }, 0).toFixed(2);
  }, [selectedOrder?.orderItems, selectedOrder?.items]);

  const handleGoBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMode === 'detail') {
      setViewMode('list');
      setSelectedOrder(null);
    } else {
      navigation.goBack();
    }
  }, [navigation, viewMode]);

  const handleItemPress = useCallback((item: OrderItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('Item pressed:', item);
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fetchAllUserBookings();
  }, [fetchAllUserBookings]);

  // Enhanced QR Code Modal Component
  const QRCodeModal = () => (
    <Modal
      visible={qrModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setQrModalVisible(false)}
    >
      <View style={styles.qrModalOverlay}>
        <View style={styles.qrModalContent}>
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>Booking QR Code</Text>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setQrModalVisible(false);
              }}
              style={styles.qrModalCloseButton}
            >
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {qrLoading ? (
            <View style={styles.qrLoadingContainer}>
              <ActivityIndicator size="large" color="#FF8C00" />
              <Text style={styles.qrLoadingText}>Generating QR Code...</Text>
            </View>
          ) : qrError ? (
            <View style={styles.qrErrorContainer}>
              <Text style={styles.qrErrorText}>{qrError}</Text>
              <TouchableOpacity 
                style={styles.qrRetryButton}
                onPress={() => handleGenerateQRCode(selectedOrder?._id)}
              >
                <Text style={styles.qrRetryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : qrCode ? (
            <View style={styles.qrContainer}>
              <Image 
                source={{ uri: qrCode }}
                style={styles.qrImage}
                resizeMode="contain"
                onError={(error) => {
                  console.error('QR Code image load error:', error);
                  setQrError('Failed to load QR code image');
                }}
                onLoad={() => {
                  console.log('QR Code image loaded successfully');
                }}
              />
              <Text style={styles.qrInstructions}>
                Show this QR code at the service location
              </Text>
              <Text style={styles.qrBookingId}>
                Booking: {selectedOrder?.orderNumber || selectedOrder?._id}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  // Render individual booking item in list
  const renderBookingItem = useCallback(({ item, index }) => {
    const orderItems = item.orderItems || item.items || [];
    const itemCount = orderItems.length;
    
    return (
      <TouchableOpacity
        style={styles.bookingItem}
        onPress={() => handleOrderSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>#{item.orderNumber || item._id}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status || 'Confirmed'}
              </Text>
            </View>
          </View>
          <View style={styles.bookingAmount}>
            <Text style={styles.amountText}>${item.totalAmount || '0.00'}</Text>
            <Text style={styles.itemCountText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        
        <View style={styles.bookingDetails}>
          <View style={styles.dateRow}>
            <MaterialIcons name="schedule" size={14} color="#666" />
            <Text style={styles.dateText}>
              {formatDate(item.createdAt)} • {formatTime(item.time || '12:00 PM')}
            </Text>
          </View>
          
          {item.pickupAddress && (
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color="#666" />
              <Text style={styles.addressText} numberOfLines={1}>
                {item.pickupAddress}
              </Text>
            </View>
          )}
          
          {item.dryCleaner && (
            <View style={styles.cleanerRow}>
              <MaterialIcons name="store" size={14} color="#666" />
              <Text style={styles.cleanerText} numberOfLines={1}>
                {item.dryCleaner.shopname || 'Dry Cleaner'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.bookingFooter}>
          <TouchableOpacity style={styles.viewDetailsButton}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <MaterialIcons name="arrow-forward-ios" size={12} color="#FF8C00" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [handleOrderSelect, getStatusColor, formatDate, formatTime]);

  // Show error state
  if (error && !loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <MaterialIcons name="refresh" size={24} color="#FF8C00" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#666" />
          <Text style={styles.errorText}>{error}</Text>
          
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.loadingText}>Loading your bookings...</Text>
        </View>
      </View>
    );
  }

  // Show list view
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings ({allBookings.length})</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <MaterialIcons name="refresh" size={24} color="#FF8C00" />
          </TouchableOpacity>
        </View>

        {allBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Bookings Found</Text>
            <Text style={styles.emptySubtitle}>
              You haven't made any bookings yet. Start by placing your first order!
            </Text>
          </View>
        ) : (
          <FlatList
            data={allBookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={handleRefresh}
          />
        )}
      </View>
    );
  }

  // Show detail view
  if (viewMode === 'detail' && selectedOrder) {
    const orderItems = selectedOrder.orderItems || selectedOrder.items || [];
    const orderNumber = selectedOrder.orderNumber || selectedOrder.orderId || selectedOrder._id || 'N/A';

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <MaterialIcons name="refresh" size={24} color="#FF8C00" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.trackBanner}>
            <MaterialIcons name="location-on" size={16} color="#fff" style={styles.bannerIcon} />
            <Text style={styles.trackBannerText}>BOOKING DETAILS</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking ID</Text>
              <Text style={styles.detailValue}>{orderNumber}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.detailValue, styles.statusTextDetail, { color: getStatusColor(selectedOrder.status) }]}>
                Status: {selectedOrder.status || 'Confirmed'}
              </Text>
            </View>
            
            {selectedOrder.createdAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Booking Date</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedOrder.createdAt)}
                </Text>
              </View>
            )}

            {selectedOrder.dryCleaner && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Dry Cleaner</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder.dryCleaner.shopname || 'N/A'}
                </Text>
              </View>
            )}
          </View>

          {selectedOrder.scheduledPickupDateTime && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="schedule" size={20} color="#FF8C00" />
                <Text style={styles.sectionTitle}>Pickup Date & Time</Text>
              </View>
              <Text style={styles.dateText}>
                {formatDate(selectedOrder.scheduledPickupDateTime)} {formatTime(selectedOrder.time || '12:00 PM')}
              </Text>
            </View>
          )}

          {selectedOrder.scheduledDeliveryDateTime && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="local-shipping" size={20} color="#FF8C00" />
                <Text style={styles.sectionTitle}>Delivery Date & Time</Text>
              </View>
              <Text style={styles.dateText}>
                {formatDate(selectedOrder.scheduledDeliveryDateTime)} {formatTime(selectedOrder.deliveryTime || '02:00 PM')}
              </Text>
            </View>
          )}

          {(selectedOrder.pickupAddress || selectedOrder.dropoffAddress) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="place" size={20} color="#FF8C00" />
                <Text style={styles.sectionTitle}>Addresses</Text>
              </View>
              
              {selectedOrder.pickupAddress && (
                <View style={styles.addressRowDetail}>
                  <View style={styles.addressIconContainer}>
                    <View style={styles.pickupDot} />
                  </View>
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>Pickup</Text>
                    <Text style={styles.addressTextDetail}>
                      {selectedOrder.pickupAddress}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={handleChangeAddress}
                  >
                    <Text style={styles.changeButtonText}>CHANGE</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedOrder.dropoffAddress && (
                <View style={styles.addressRowDetail}>
                  <View style={styles.addressIconContainer}>
                    <View style={styles.dropoffDot} />
                  </View>
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>Drop Off</Text>
                    <Text style={styles.addressTextDetail}>
                      {selectedOrder.dropoffAddress}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="qr-code" size={20} color="#FF8C00" />
              <Text style={styles.sectionTitle}>Booking QR Code</Text>
            </View>
            
            <TouchableOpacity
              style={styles.generateQrButton}
              onPress={() => handleGenerateQRCode(selectedOrder._id)}
              disabled={qrLoading}
            >
              {qrLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="qr-code" size={20} color="#fff" />
                  <Text style={styles.generateQrButtonText}>Generate QR Code</Text>
                </>
              )}
            </TouchableOpacity>
            
            <Text style={styles.qrText}>Booking ID: {orderNumber}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="list" size={20} color="#FF8C00" />
              <Text style={styles.sectionTitle}>Booking Items</Text>
            </View>
            
            {orderItems.length > 0 ? orderItems.map((item: any, index: number) => (
              <TouchableOpacity 
                key={index} 
                style={styles.itemRow}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>
                    {item.name || item.itemName || `Item ${index + 1}`}
                  </Text>
                  <Text style={styles.itemCategory}>
                    {item.category || item.subtext || item.service || 'Wash & Fold'}
                  </Text>
                </View>
                <View style={styles.itemQuantity}>
                  <Text style={styles.quantityText}>{item.quantity || item.qty || 1}</Text>
                </View>
                <View style={styles.itemPrice}>
                  <Text style={styles.priceText}>
                    ${parseFloat(item.price || '0').toFixed(2)}
                  </Text>
                </View>
              </TouchableOpacity>
            )) : (
              <Text style={styles.noItemsText}>No items found in this booking</Text>
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                ${selectedOrder.totalAmount || selectedOrder.price || selectedOrder.total || totalAmount}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* QR Code Modal */}
        <QRCodeModal />
      </View>
    );
  }

  return null;
};

// Enhanced styles for better Expo compatibility
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  refreshButton: {
    padding: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  retryButton: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // List View Styles
  listContent: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  bookingItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  bookingAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF8C00',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  itemCountText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  cleanerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanerText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#FF8C00',
    fontWeight: '500',
    marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // Detail View Styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  trackBanner: {
    backgroundColor: '#FF8C00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerIcon: {
    marginRight: 8,
  },
  trackBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statusRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusTextDetail: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // Address Styles
  addressRowDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF8C00',
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  addressTextDetail: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  changeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  changeButtonText: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // QR Code Styles
  generateQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  generateQrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  qrText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // QR Code Modal Styles
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 350,
    padding: 0,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  qrModalCloseButton: {
    padding: 4,
  },
  qrLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  qrLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  qrErrorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrErrorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  qrRetryButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  qrRetryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrImage: {
    width: 200,
    height: 200,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  qrInstructions: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  qrBookingId: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // Item List Styles
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  itemCategory: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  itemQuantity: {
    width: 40,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  itemPrice: {
    width: 60,
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  noItemsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF8C00',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});

export default MyOrder;