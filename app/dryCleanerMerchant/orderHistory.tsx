import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import axiosInstance from '../../api/axios';
import colors from '../../assets/color';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Booking {
  _id: string;
  orderNumber?: string;
  status: string;
  createdAt: string;
  pricing?: { totalAmount: number };
  pickupAddress?: string;
  dropoffAddress?: string;
  user?: { firstName: string; lastName: string; phoneNumber?: string };
  dryCleaner?: { shopname: string };
  driver?: { firstName: string; lastName: string };
  orderItems?: { name: string; quantity: number }[];
  paymentStatus?: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const STATUS_TABS = [
  { key: 'all',                label: 'All' },
  { key: 'pending',            label: 'Pending' },
  { key: 'dropped_at_center',  label: '📦 At Shop' },
  { key: 'ready_for_delivery', label: 'Ready' },
  { key: 'completed',          label: 'Done' },
  { key: 'cancelled',          label: 'Cancelled' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending:             { color: '#F59E0B', label: 'Pending',           icon: 'hourglass-empty' },
  accepted:            { color: '#3B82F6', label: 'Accepted',          icon: 'check-circle' },
  in_progress:         { color: '#8B5CF6', label: 'In Progress',       icon: 'local-shipping' },
  pickup_completed:    { color: '#06B6D4', label: 'Picked Up',         icon: 'inventory' },
  dropped_at_center:   { color: '#10B981', label: 'At Your Shop ⭐',   icon: 'store' },
  ready_for_delivery:  { color: '#F97316', label: 'Ready for Delivery', icon: 'local-shipping' },
  out_for_delivery:    { color: '#6366F1', label: 'Out for Delivery',  icon: 'delivery-dining' },
  completed:           { color: '#059669', label: 'Completed',         icon: 'done-all' },
  cancelled:           { color: '#EF4444', label: 'Cancelled',         icon: 'cancel' },
};

// ─────────────────────────────────────────────
// Booking Card
// ─────────────────────────────────────────────
const BookingCard: React.FC<{
  booking: Booking;
  onPress: () => void;
}> = ({ booking, onPress }) => {
  const cfg = STATUS_CONFIG[booking.status] ?? {
    color: '#6B7280', label: booking.status, icon: 'info',
  };

  const needsAction =
    booking.status === 'dropped_at_center' ||
    booking.status === 'ready_for_delivery';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  const totalItems =
    booking.orderItems?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <TouchableOpacity
      style={[styles.card, needsAction && styles.cardHighlighted]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {needsAction && (
        <View style={styles.actionBanner}>
          <MaterialIcons name="notification-important" size={14} color="#fff" />
          <Text style={styles.actionBannerText}>Action Required — Book a Driver</Text>
        </View>
      )}

      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardOrderNum}>
            {booking.orderNumber ?? `#${booking._id.slice(-6).toUpperCase()}`}
          </Text>
          <Text style={styles.cardDate}>{formatDate(booking.createdAt)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.color + '20' }]}>
          <MaterialIcons name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {booking.user && (
          <View style={styles.metaRow}>
            <MaterialIcons name="person" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>
              {booking.user.firstName} {booking.user.lastName}
            </Text>
          </View>
        )}
        {booking.pickupAddress && (
          <View style={styles.metaRow}>
            <MaterialIcons name="place" size={14} color="#9CA3AF" />
            <Text style={styles.metaText} numberOfLines={1}>
              {booking.pickupAddress}
            </Text>
          </View>
        )}
        {totalItems > 0 && (
          <View style={styles.metaRow}>
            <MaterialIcons name="checkroom" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBottom}>
        {booking.pricing?.totalAmount != null && (
          <Text style={styles.cardAmount}>
            ${booking.pricing.totalAmount.toFixed(2)}
          </Text>
        )}
        <View style={styles.cardAction}>
          <Text style={styles.cardActionText}>View Details</Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.brandColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
const MerchantOrderHistory: React.FC = () => {
  const router = useRouter();
  const { token } = useSelector((state: any) => state.auth);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Fetch ──────────────────────────────────
  const fetchBookings = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 1 : page;
      if (!reset && loadingMore) return;

      try {
        reset ? setLoading(true) : setLoadingMore(true);

        const params: Record<string, any> = { page: currentPage, limit: 15 };
        if (activeTab !== 'all') params.status = activeTab;

        const res = await axiosInstance.get('/users/merchants/bookings', {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        if (res.data.success) {
          const data: Booking[] = res.data.data?.bookings ?? [];
          const pagination = res.data.data?.pagination;

          if (reset) {
            setBookings(data);
            setPage(2);
          } else {
            setBookings((prev) => [...prev, ...data]);
            setPage((p) => p + 1);
          }

          setHasMore(
            pagination
              ? currentPage < pagination.totalPages
              : data.length === 15,
          );
        }
      } catch (err: any) {
        console.error('Fetch bookings error:', err);
        if (reset) {
          Alert.alert('Error', err.response?.data?.message || 'Failed to load orders');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [token, activeTab, page, loadingMore],
  );

  useEffect(() => {
    fetchBookings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  const onEndReached = () => {
    if (hasMore && !loadingMore && !loading) fetchBookings(false);
  };

  // ── Navigate to details ────────────────────
  const openDetails = (booking: Booking) => {
    router.push({
      pathname: '/dryCleanerMerchant/orderDetail',
      params: { bookingId: booking._id },
    });
  };

  // ── Derived data ───────────────────────────
  const actionRequired = bookings.filter(
    (b) => b.status === 'dropped_at_center' || b.status === 'ready_for_delivery',
  ).length;

  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={colors.brandColor} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order History</Text>
          {actionRequired > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{actionRequired}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.headerRefresh} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={24} color={colors.brandColor} />
        </TouchableOpacity>
      </View>

      {/* Action required banner */}
      {actionRequired > 0 && (
        <View style={styles.alertBanner}>
          <MaterialIcons name="notification-important" size={18} color="#fff" />
          <Text style={styles.alertBannerText}>
            {actionRequired} order{actionRequired !== 1 ? 's' : ''} need
            {actionRequired === 1 ? 's' : ''} a delivery driver booked
          </Text>
        </View>
      )}

      {/* Status tabs */}
      <View style={styles.tabsWrapper}>
        <FlatList
          horizontal
          data={STATUS_TABS}
          keyExtractor={(t) => t.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(item.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b._id}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={() => openDetails(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.brandColor]}
              tintColor={colors.brandColor}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="inbox" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptyHint}>
                {activeTab === 'all'
                  ? 'Orders from customers will appear here'
                  : `No orders with status "${activeTab}"`}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={colors.brandColor}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerBadge: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  headerRefresh: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center',
  },

  // Alert banner
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F97316', paddingHorizontal: 16, paddingVertical: 10,
  },
  alertBannerText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },

  // Tabs
  tabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.brandColor + '15',
    borderColor: colors.brandColor,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: colors.brandColor },

  // List
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4,
  },
  cardHighlighted: {
    borderWidth: 2, borderColor: '#F97316',
  },
  actionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 7,
  },
  actionBannerText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 14, paddingBottom: 10,
  },
  cardOrderNum: { fontSize: 17, fontWeight: '800', color: '#111827' },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  cardMeta: {
    paddingHorizontal: 14, paddingBottom: 10, gap: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#6B7280', flex: 1 },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  cardAmount: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardActionText: { fontSize: 13, fontWeight: '600', color: colors.brandColor },

  // Loading / empty
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#6B7280' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});

export default MerchantOrderHistory;