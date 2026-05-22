import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import colors from '../assets/color';
import { ParkingViewType } from './types';
import { responsiveHeight } from 'react-native-responsive-dimensions';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axiosInstance from '../api/axios';

interface NotificationViewProps {
  onBack: () => void;
  onNavigate: (screen: ParkingViewType) => void;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'booking' | 'payment' | 'driver' | 'system';
  isRead: boolean;
  createdAt: string;
  data?: {
    bookingId?: string;
    orderId?: string;
    status?: string;
    amount?: number;
    [key: string]: any;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

const formatFull = (iso: string): string => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return 'N/A'; }
};

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  success: { icon: 'check-circle', color: '#4CD964', label: 'Success' },
  warning: { icon: 'alert-circle', color: '#FF9500', label: 'Warning' },
  error:   { icon: 'x-circle',    color: '#FF3B30', label: 'Error'   },
  booking: { icon: 'calendar',    color: '#5C6BC0', label: 'Booking' },
  payment: { icon: 'credit-card', color: '#4CAF50', label: 'Payment' },
  driver:  { icon: 'truck',       color: '#FF8C00', label: 'Driver'  },
  system:  { icon: 'settings',    color: '#9E9E9E', label: 'System'  },
  info:    { icon: 'info',        color: colors.primary, label: 'Info' },
};

const getCfg = (type: string) => TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

const BANNER_MESSAGES = [
  'Stay updated with your parking sessions and payments.',
  'Get instant notifications about your parking activities.',
  'Never miss important updates about your parking spots.',
  'Real-time alerts for session start and end times.',
  'Receive payment confirmations and reminders instantly.',
  'Get notified about available parking spots nearby.',
  'Important announcements and feature updates.',
];

// ── Notification Detail Panel ─────────────────────────────────────────────────

const NotificationDetail: React.FC<{
  notification: NotificationItem;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  const cfg = getCfg(notification.type);

  return (
    <View style={det.wrapper}>
      {/* Back row */}
      <TouchableOpacity style={det.backRow} onPress={onClose}>
        <Feather name="arrow-left" size={18} color={colors.primary} />
        <Text style={det.backText}>Back to Notifications</Text>
      </TouchableOpacity>

      {/* Icon + title */}
      <View style={[det.iconHeader, { backgroundColor: cfg.color + '14' }]}>
        <View style={[det.iconCircle, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '40', borderWidth: 1.5 }]}>
          <Feather name={cfg.icon as any} size={28} color={cfg.color} />
        </View>
        <View style={[det.typePill, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[det.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {!notification.isRead && (
          <View style={det.unreadPill}>
            <Text style={det.unreadPillText}>Unread</Text>
          </View>
        )}
      </View>

      {/* Content card */}
      <View style={det.card}>
        <Text style={det.title}>{notification.title}</Text>
        <Text style={det.timestamp}>{formatFull(notification.createdAt)}</Text>
        <View style={det.divider} />
        <Text style={det.message}>{notification.message}</Text>
      </View>

      {/* Extra data if present */}
      {notification.data && Object.keys(notification.data).length > 0 && (
        <View style={det.dataCard}>
          <Text style={det.dataTitle}>Details</Text>
          {notification.data.bookingId && (
            <DataRow label="Booking ID" value={notification.data.bookingId} />
          )}
          {notification.data.orderId && (
            <DataRow label="Order ID" value={notification.data.orderId} />
          )}
          {notification.data.status && (
            <DataRow label="Status" value={notification.data.status} />
          )}
          {notification.data.amount != null && (
            <DataRow label="Amount" value={`₹${Number(notification.data.amount).toFixed(2)}`} />
          )}
          {Object.entries(notification.data)
            .filter(([k]) => !['bookingId', 'orderId', 'status', 'amount'].includes(k))
            .map(([k, v]) => (
              <DataRow key={k} label={k} value={String(v)} />
            ))
          }
        </View>
      )}
    </View>
  );
};

const DataRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={det.dataRow}>
    <Text style={det.dataLabel}>{label}</Text>
    <Text style={det.dataValue}>{value}</Text>
  </View>
);

const det = StyleSheet.create({
  wrapper: { paddingBottom: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 8 },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  iconHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typePillText: { fontSize: 12, fontWeight: '700' },
  unreadPill: {
    backgroundColor: colors.primary + '18',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  unreadPillText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  title:     { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 4 },
  timestamp: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  divider:   { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  message:   { fontSize: 14, color: '#374151', lineHeight: 22 },

  dataCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  dataTitle: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 10 },
  dataRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dataLabel: { fontSize: 13, color: '#9CA3AF' },
  dataValue: { fontSize: 13, fontWeight: '600', color: '#111', maxWidth: '60%', textAlign: 'right' },
});

// ── Main Component ────────────────────────────────────────────────────────────

const NotificationView: React.FC<NotificationViewProps> = ({ onBack, onNavigate }) => {
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // Banner animation
  const [messageIndex, setMessageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Banner animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setMessageIndex(prev => (prev + 1) % BANNER_MESSAGES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch notifications ───────────────────────────────────────────────────
  // Backend route: GET /notifications  →  authenticate → getUserNotifications
  // axiosInstance already attaches Bearer token via interceptor — no manual header needed
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await axiosInstance.get('notifications');

      // Backend may return: { data: [...] } or { data: { notifications: [...] } } or plain array
      const payload = response.data?.data ?? response.data;
      const list: NotificationItem[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : [];

      setNotifications(list);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (status === 404) {
        // Endpoint exists but no notifications yet — treat as empty
        setNotifications([]);
      } else {
        setError('Failed to load notifications. Pull down to retry.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Mark single as read ───────────────────────────────────────────────────
  // Backend route: PUT /:notificationId/read  →  markNotificationAsRead
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update first for instant UI feedback
    setNotifications(prev =>
      prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
    );
    try {
      await axiosInstance.put(`${notificationId}/read`);
    } catch {
      // Revert optimistic update on failure
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: false } : n)
      );
    }
  }, []);

  // ── Mark all as read ──────────────────────────────────────────────────────
  // Backend route: PUT /mark-all-read  →  markAllNotificationsAsRead
  const markAllAsRead = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await axiosInstance.put('mark-all-read');
    } catch {
      Alert.alert('Error', 'Failed to mark all as read.');
      // Revert
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // ── Delete all ────────────────────────────────────────────────────────────
  // Backend route: DELETE /delete-all  →  deleteAllNotifications
  const deleteAll = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Clear All Notifications',
      'This will permanently delete all your notifications. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const backup = [...notifications];
            // Optimistic clear
            setNotifications([]);
            setSelectedNotification(null);
            try {
              await axiosInstance.delete('delete-all');
            } catch {
              Alert.alert('Error', 'Failed to delete notifications.');
              // Revert
              setNotifications(backup);
            }
          },
        },
      ]
    );
  }, [notifications]);

  // ── Select notification → show detail ─────────────────────────────────────
  const handleNotificationPress = useCallback(async (notification: NotificationItem) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNotification(notification);
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
  }, [markAsRead]);

  const handleBack = useCallback(async () => {
    await Haptics.selectionAsync();
    onBack();
  }, [onBack]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <BlurView intensity={80} tint="light" style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={selectedNotification ? () => setSelectedNotification(null) : handleBack}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {selectedNotification ? 'Notification' : 'Notifications'}
            </Text>
            {!selectedNotification && unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
            {!selectedNotification && unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.actionButton}>
                <Feather name="check-square" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {!selectedNotification && notifications.length > 0 && (
              <TouchableOpacity onPress={deleteAll} style={styles.actionButton}>
                <Feather name="trash-2" size={20} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>

      {/* ── Banner (only on list view) ── */}
      {!selectedNotification && (
        <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={[colors.primary, '#4A90E2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.messageBanner}
          >
            <Feather name="bell" size={18} color="#FFF" style={styles.bellIcon} />
            <Text style={styles.dynamicMessage}>{BANNER_MESSAGES[messageIndex]}</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* ── Content ── */}
      <ScrollView
        style={styles.notificationsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.notificationsList,
          !selectedNotification && notifications.length === 0 && !loading && styles.emptyList,
        ]}
        refreshControl={
          !selectedNotification ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {/* Detail view */}
        {selectedNotification && (
          <NotificationDetail
            notification={selectedNotification}
            onClose={() => setSelectedNotification(null)}
          />
        )}

        {/* List view */}
        {!selectedNotification && (
          <>
            {/* Loading */}
            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading notifications…</Text>
              </View>
            )}

            {/* Error */}
            {!loading && error && (
              <View style={styles.centerBox}>
                <Feather name="alert-circle" size={40} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchNotifications()}>
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Empty */}
            {!loading && !error && notifications.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="bell-off" size={60} color={colors.lightGray} />
                <Text style={styles.emptyStateTitle}>No Notifications</Text>
                <Text style={styles.emptyStateText}>
                  You're all caught up! Check back later for updates.
                </Text>
              </View>
            )}

            {/* Notification list */}
            {!loading && !error && notifications.length > 0 && (
              <>
                {/* Unread section */}
                {notifications.some(n => !n.isRead) && (
                  <>
                    <Text style={styles.sectionLabel}>Unread</Text>
                    {notifications
                      .filter(n => !n.isRead)
                      .map(notification => (
                        <NotificationCard
                          key={notification._id}
                          notification={notification}
                          onPress={handleNotificationPress}
                        />
                      ))}
                  </>
                )}

                {/* Read section */}
                {notifications.some(n => n.isRead) && (
                  <>
                    <Text style={[
                      styles.sectionLabel,
                      { marginTop: notifications.some(n => !n.isRead) ? 8 : 0 },
                    ]}>
                      Earlier
                    </Text>
                    {notifications
                      .filter(n => n.isRead)
                      .map(notification => (
                        <NotificationCard
                          key={notification._id}
                          notification={notification}
                          onPress={handleNotificationPress}
                        />
                      ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ── Notification Card ─────────────────────────────────────────────────────────

const NotificationCard: React.FC<{
  notification: NotificationItem;
  onPress: (n: NotificationItem) => void;
}> = ({ notification, onPress }) => {
  const cfg = getCfg(notification.type);
  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        notification.isRead && styles.readNotification,
        { borderLeftColor: cfg.color },
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.72}
    >
      {/* Icon */}
      <View style={styles.notificationIcon}>
        <View style={[styles.iconBg, { backgroundColor: cfg.color + '18' }]}>
          <Feather name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
        {!notification.isRead && <View style={styles.unreadDot} />}
      </View>

      {/* Content */}
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            style={[styles.notificationTitle, !notification.isRead && styles.unreadTitle]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={styles.timeAgo}>{timeAgo(notification.createdAt)}</Text>
        </View>
        <Text style={styles.notificationDescription} numberOfLines={2}>
          {notification.message}
        </Text>
      </View>

      <Feather name="chevron-right" size={16} color="#D1D5DB" />
    </TouchableOpacity>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: responsiveHeight(7),
  },
  backButton: { padding: 8 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 8, marginLeft: 4 },

  messageContainer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bellIcon: { marginRight: 10 },
  dynamicMessage: { flex: 1, fontSize: 13, fontWeight: '500', color: '#fff', lineHeight: 19 },

  notificationsContainer: { flex: 1 },
  notificationsList: { paddingVertical: 10, paddingHorizontal: 16 },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  readNotification: { opacity: 0.65 },
  notificationIcon: { marginRight: 12, position: 'relative' },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notificationContent: { flex: 1 },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: { fontSize: 14, fontWeight: '500', color: '#111', flex: 1, marginRight: 8 },
  unreadTitle: { fontWeight: '800' },
  // FIX: removed invalid `whiteSpace: 'nowrap'` (web-only CSS, crashes in RN)
  timeAgo: { fontSize: 11, color: '#9CA3AF' },
  notificationDescription: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  centerBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  loadingText: { fontSize: 14, color: '#9CA3AF', marginTop: 6 },
  errorText: { fontSize: 14, color: '#FF3B30', textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginTop: 16, marginBottom: 8 },
  emptyStateText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});

export default NotificationView;