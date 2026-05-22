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
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import colors from '../../assets/color';
import { useRouter } from 'expo-router';
import axiosInstance from '../../api/axios';

const { width } = Dimensions.get('window');

const DriverHistory = () => {
  const router = useRouter();
  const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert('Authentication Required', 'Please log in to view your history', [
        { text: 'OK', onPress: () => router.push('/login') },
      ]);
      return;
    }
    fetchDriverHistory(1, false);
  }, [isAuthenticated, token]);

  const fetchDriverHistory = async (page = 1, isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const res = await axiosInstance.get('/users/driver/history', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 10 },
      });

      if (res.data.success) {
        const {
          bookings: newBookings,
          pagination,
          totalEarnings: te,
          totalCompletedTrips: tt,
        } = res.data.data;

        if (isLoadMore) {
          setBookings(prev => {
            const updated = [...prev, ...newBookings];
            // Recompute totals from all bookings if server doesn't provide them correctly
            if (!te && !tt) {
              const computedEarnings = updated.reduce((sum: number, b: any) => {
                const charge = parseFloat(String(b.deliveryCharge || b.pricing?.deliveryCharge || 0));
                const tip = parseFloat(String(b.estimatedTip || b.pricing?.estimatedTip || b.tip || 0));
                return sum + charge + tip;
              }, 0);
              setTotalEarnings(computedEarnings);
              setTotalTrips(updated.length);
            }
            return updated;
          });
        } else {
          setBookings(newBookings);

          // ── FIX: compute earnings locally if server returns 0 or undefined ──
          const serverEarnings = parseFloat(String(te || 0));
          const serverTrips = parseInt(String(tt || 0), 10);

          if (serverEarnings > 0) {
            setTotalEarnings(serverEarnings);
          } else if (Array.isArray(newBookings) && newBookings.length > 0) {
            // Compute from returned bookings as fallback
            const computedEarnings = newBookings.reduce((sum: number, b: any) => {
              const charge = parseFloat(String(b.deliveryCharge || b.pricing?.deliveryCharge || 0));
              const tip = parseFloat(String(b.estimatedTip || b.pricing?.estimatedTip || b.tip || 0));
              return sum + charge + tip;
            }, 0);
            setTotalEarnings(computedEarnings);
          } else {
            setTotalEarnings(0);
          }

          setTotalTrips(serverTrips > 0 ? serverTrips : (newBookings?.length || 0));
        }

        setCurrentPage(pagination.page);
        setTotalPages(pagination.pages);
        setHasMore(pagination.page < pagination.pages);
      } else {
        throw new Error(res.data.message || 'Failed to fetch driver history');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load history';
      Alert.alert('Error', msg, [
        { text: 'Retry', onPress: () => fetchDriverHistory(page, isLoadMore) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);
    fetchDriverHistory(1, false);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && currentPage < totalPages) {
      fetchDriverHistory(currentPage + 1, true);
    }
  };

  // ── Formatters ──────────────────────────────────────────────────────────
  const fc = (amount: any) => {
    const n = parseFloat(String(amount || 0));
    return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
  };

  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (d: string) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  };

  const getStatusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'completed': case 'delivered': return '#4CAF50';
      case 'dropped_at_center': return '#9C27B0';
      case 'in_progress': return '#2196F3';
      case 'cancelled': case 'rejected': return '#F44336';
      default: return '#FF9800';
    }
  };

  const getStatusText = (s: string) => {
    const map: Record<string, string> = {
      completed: 'COMPLETED',
      delivered: 'DELIVERED',
      dropped_at_center: 'DROPPED AT CENTER',
      in_progress: 'IN PROGRESS',
      cancelled: 'CANCELLED',
      rejected: 'REJECTED',
      pending: 'PENDING',
      requested: 'REQUESTED',
      ready_for_delivery: 'READY FOR DELIVERY',
    };
    return map[s?.toLowerCase()] || s?.toUpperCase() || 'UNKNOWN';
  };

  // ── Per-booking earnings helper ──────────────────────────────────────────
  const getBookingEarnings = (item: any) => {
    const charge = parseFloat(String(
      item.deliveryCharge ??
      item.pricing?.deliveryCharge ??
      item.totalEarnings ??
      0
    ));
    const tip = parseFloat(String(
      item.estimatedTip ??
      item.pricing?.estimatedTip ??
      item.tip ??
      0
    ));
    return { charge: isNaN(charge) ? 0 : charge, tip: isNaN(tip) ? 0 : tip };
  };

  // ── QR ──────────────────────────────────────────────────────────────────
  const generateQRData = (booking: any) => {
    if (!booking) return '';
    const { charge, tip } = getBookingEarnings(booking);
    return JSON.stringify({
      bookingId: booking._id || booking.id,
      orderNumber: booking.orderNumber,
      trackingId: booking.Tracking_ID,
      driver: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.fullName,
        id: user._id,
        phone: user.phoneNumber || user.phone,
      },
      customer: {
        name: `${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim(),
        phone: booking.user?.phoneNumber,
      },
      service: { dryCleaner: booking.dryCleaner?.shopname || 'Dry Cleaning Service' },
      payment: {
        deliveryCharge: charge.toFixed(2),
        tip: tip.toFixed(2),
        total: (charge + tip).toFixed(2),
      },
      date: formatDate(booking.completedAt || booking.createdAt),
      status: booking.status,
    });
  };

  const handleShowQR = (booking: any) => { setSelectedBooking(booking); setShowQRModal(true); };

  const handleShareBooking = async (booking: any) => {
    try {
      const { charge, tip } = getBookingEarnings(booking);
      await Share.share({
        title: 'Delivery Details',
        message:
          `Order #${booking.orderNumber}\n` +
          `Tracking: ${booking.Tracking_ID}\n` +
          `Status: ${getStatusText(booking.status)}\n` +
          `Earnings: ${fc(charge + tip)}\n` +
          `Date: ${formatDate(booking.completedAt || booking.createdAt)}`,
      });
    } catch { /* cancelled */ }
  };

  // ── avg per trip ────────────────────────────────────────────────────────
  const avgPerTrip = totalTrips > 0 ? totalEarnings / totalTrips : 0;

  // ── Render booking card ─────────────────────────────────────────────────
  const renderBookingItem = ({ item }: { item: any }) => {
    const completedDate = item.completedAt || item.createdAt;
    const { charge, tip } = getBookingEarnings(item);
    const total = charge + tip;

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleShowQR(item)} activeOpacity={0.8}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNo}>Order #{item.orderNumber}</Text>
            <Text style={styles.trackingId}>ID: {item.Tracking_ID}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
            <TouchableOpacity
              style={styles.qrBtn}
              onPress={() => handleShowQR(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="qrcode" size={20} color={colors.brandColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer + earnings */}
        <View style={styles.midRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>
              {item.user?.firstName} {item.user?.lastName}
            </Text>
            <Text style={styles.customerPhone}>{item.user?.phoneNumber}</Text>
          </View>
          <View style={styles.earningsBox}>
            <Text style={styles.earningsLabel}>Earnings</Text>
            <Text style={styles.earningsValue}>{fc(total)}</Text>
            <Text style={styles.earningsSub}>{fc(charge)} + {fc(tip)} tip</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.routeAddr} numberOfLines={1}>{item.pickupAddress}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.routeAddr} numberOfLines={1}>{item.dropoffAddress}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="map-marker-distance" size={14} color="#888" />
            <Text style={styles.statText}>{item.distance || 'N/A'} km</Text>
          </View>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#888" />
            <Text style={styles.statText}>{item.time || 'N/A'} min</Text>
          </View>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="package-variant" size={14} color="#888" />
            <Text style={styles.statText}>{item.totalItems || item.orderItems?.length || 0} items</Text>
          </View>
          {item.duration && (
            <View style={styles.stat}>
              <MaterialCommunityIcons name="timer-outline" size={14} color="#888" />
              <Text style={styles.statText}>{formatDuration(item.duration)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {formatDate(completedDate)} at {formatTime(completedDate)}
          </Text>
          <TouchableOpacity onPress={() => handleShareBooking(item)} style={styles.shareBtn}>
            <MaterialIcons name="share" size={14} color={colors.brandColor} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery History</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: '#F44336' }}>Authentication required</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery History</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={22} color={colors.brandColor} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialIcons name="account-balance-wallet" size={22} color={colors.brandColor} />
          <Text style={styles.statCardValue}>{fc(totalEarnings)}</Text>
          <Text style={styles.statCardLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="local-shipping" size={22} color={colors.brandColor} />
          <Text style={styles.statCardValue}>{totalTrips}</Text>
          <Text style={styles.statCardLabel}>Completed Trips</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="trending-up" size={22} color={colors.brandColor} />
          <Text style={styles.statCardValue}>{fc(avgPerTrip)}</Text>
          <Text style={styles.statCardLabel}>Avg per Trip</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={{ marginTop: 12, color: '#666' }}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brandColor]} tintColor={colors.brandColor} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 16, gap: 8 }}>
                <ActivityIndicator size="small" color={colors.brandColor} />
                <Text style={{ color: '#666' }}>Loading more...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="truck-delivery" size={64} color="#DDD" />
                <Text style={styles.emptyText}>No delivery history found</Text>
                <Text style={styles.emptySub}>Complete your first delivery to see it here</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* QR Modal */}
      <Modal visible={showQRModal} transparent animationType="slide" onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="qrcode" size={26} color={colors.brandColor} />
                <Text style={styles.modalTitle}>Delivery QR Code</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQRModal(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (() => {
              const { charge, tip } = getBookingEarnings(selectedBooking);
              return (
                <>
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalOrderNo}>Order: {selectedBooking.orderNumber}</Text>
                    <Text style={styles.modalTracking}>Tracking: {selectedBooking.Tracking_ID}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedBooking.status), alignSelf: 'center', marginTop: 8 }]}>
                      <Text style={styles.statusText}>{getStatusText(selectedBooking.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.qrContainer}>
                    <View style={styles.qrWrapper}>
                      <QRCode value={generateQRData(selectedBooking)} size={220} color="#000000" backgroundColor="#FFFFFF" />
                    </View>
                    <Text style={styles.qrLabel}>Scan to verify delivery details</Text>
                  </View>

                  <View style={styles.modalDetails}>
                    {[
                      { icon: 'account', label: `${selectedBooking.user?.firstName || ''} ${selectedBooking.user?.lastName || ''}`.trim() || 'Customer' },
                      { icon: 'map-marker-distance', label: `${selectedBooking.distance || 'N/A'} km • ${selectedBooking.time || 'N/A'} min` },
                      { icon: 'cash', label: `${fc(charge)} + ${fc(tip)} tip = ${fc(charge + tip)}` },
                      { icon: 'calendar', label: formatDate(selectedBooking.completedAt || selectedBooking.createdAt) },
                    ].map((row, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <MaterialCommunityIcons name={row.icon as any} size={18} color="#666" />
                        <Text style={{ fontSize: 14, color: '#333', fontWeight: '500', flex: 1 }}>{row.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: colors.brandColor, flex: 1 }]}
                      onPress={() => { setShowQRModal(false); handleShareBooking(selectedBooking); }}
                    >
                      <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
                      <Text style={styles.modalBtnText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: '#E0E0E0', flex: 1 }]}
                      onPress={() => setShowQRModal(false)}
                    >
                      <Text style={[styles.modalBtnText, { color: '#333' }]}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8F8F8', justifyContent: 'center', alignItems: 'center' },

  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  statCardValue: { fontSize: 17, fontWeight: '700', color: colors.brandColor },
  statCardLabel: { fontSize: 11, color: '#888', textAlign: 'center' },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  orderNo: { fontSize: 15, fontWeight: '700', color: '#111' },
  trackingId: { fontSize: 11, color: '#999', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  qrBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },

  midRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  customerName: { fontSize: 15, fontWeight: '500', color: '#111' },
  customerPhone: { fontSize: 13, color: '#888', marginTop: 2 },
  earningsBox: { alignItems: 'flex-end' },
  earningsLabel: { fontSize: 10, color: '#999' },
  earningsValue: { fontSize: 18, fontWeight: '700', color: '#4CAF50' },
  earningsSub: { fontSize: 10, color: '#aaa', marginTop: 2 },

  routeBlock: { backgroundColor: '#F8F8F8', padding: 10, borderRadius: 10, marginBottom: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeAddr: { fontSize: 12, color: '#555', flex: 1 },
  routeConnector: { width: 2, height: 14, backgroundColor: '#DDD', marginLeft: 4, marginVertical: 2 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#666' },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8,
  },
  dateText: { fontSize: 11, color: '#aaa' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareBtnText: { fontSize: 12, color: colors.brandColor, fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 17, fontWeight: '500', color: '#888', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#bbb', marginTop: 6, textAlign: 'center' },
  loginBtn: { marginTop: 16, backgroundColor: colors.brandColor, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  modalInfo: { backgroundColor: '#F8F8F8', padding: 14, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
  modalOrderNo: { fontSize: 17, fontWeight: '600', color: '#111', marginBottom: 4 },
  modalTracking: { fontSize: 13, color: '#888' },
  qrContainer: { alignItems: 'center', marginBottom: 16 },
  qrWrapper: {
    padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 3, borderColor: colors.brandColor,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 4,
  },
  qrLabel: { fontSize: 13, color: '#888', marginTop: 12, fontWeight: '500' },
  modalDetails: { backgroundColor: '#F8F8F8', padding: 14, borderRadius: 12, marginBottom: 16 },
  modalBtn: {
    height: 48, borderRadius: 12, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

export default DriverHistory;