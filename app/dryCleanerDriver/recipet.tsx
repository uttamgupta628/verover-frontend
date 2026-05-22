import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import colors from '../../assets/color';

const { width } = Dimensions.get('window');

// ── Helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (val: any) => `$${parseFloat(String(val || 0)).toFixed(2)}`;

const formatDate = (d?: string) => {
  if (!d) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (d?: string) => {
  if (!d) return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ════════════════════════════════════════════════════════════════════════════
const DriverReceipt = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);

  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // ── Parse & build receipt from params ────────────────────────────────────
  useEffect(() => {
    try {
      let data: any = null;
      if (params.bookingData && typeof params.bookingData === 'string') {
        data = JSON.parse(params.bookingData);
      } else if (params.bookingData) {
        data = params.bookingData;
      }

      if (!data) { Alert.alert('Error', 'No receipt data found'); return; }

      const driverName =
        data.driver?.name ||
        `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
        user?.fullName ||
        'Driver';

      const deliveryCharge = parseFloat(String(
        data.deliveryCharge ?? data.pricing?.deliveryCharge ?? data.price ?? 0,
      ));
      const tip = parseFloat(String(
        data.estimatedTip ?? data.pricing?.estimatedTip ?? data.tip ?? 5,
      ));
      const platformFee = parseFloat(String(data.platformFee ?? 0));
      const tax = parseFloat(String(data.tax ?? 0));
      const total = deliveryCharge + tip + tax - platformFee;

      const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`;

      setReceipt({
        receiptNumber,
        bookingId: data.id || data._id,
        orderNumber: data.orderNumber || 'N/A',
        trackingId: data.Tracking_ID || data.trackingId || 'N/A',
        completedAt: data.completedAt || new Date().toISOString(),

        driver: {
          name: driverName,
          id: data.driver?.id || user?._id || 'N/A',
          phone: data.driver?.phone || user?.phoneNumber || user?.phone || 'N/A',
          email: data.driver?.email || user?.email || 'N/A',
        },

        customer: {
          name: data.user?.name ||
            `${data.user?.firstName || ''} ${data.user?.lastName || ''}`.trim() ||
            'Customer',
          phone: data.user?.phone || data.user?.phoneNumber || 'N/A',
        },

        service: {
          provider: data.dryCleaner?.shopname || data.dryCleaner?.name || data.name || 'Dry Cleaning Service',
          type: 'Dry Clean Pickup & Delivery',
        },

        route: {
          pickup: data.pickupAddress || 'N/A',
          dropoff: data.dropoffAddress || data.dropOff || 'N/A',
          distance: data.calculatedDistance || data.distance || data.routeDistance || 'N/A',
          duration: data.calculatedDuration || data.time || data.routeDuration || 'N/A',
        },

        payment: {
          deliveryCharge,
          tip,
          tax,
          platformFee,
          total,
        },

        timeline: {
          accepted: data.acceptedAt,
          pickedUp: data.pickedUpAt || data.pickupCompletedAt,
          droppedAtCenter: data.dropoffCompletedAt,
          completed: data.completedAt || new Date().toISOString(),
        },
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to load receipt data');
    } finally {
      setLoading(false);
    }
  }, [params.bookingData]);

  // ── QR payload ────────────────────────────────────────────────────────────
  const qrValue = receipt
    ? JSON.stringify({
        receiptNumber: receipt.receiptNumber,
        bookingId: receipt.bookingId,
        orderNumber: receipt.orderNumber,
        driver: { name: receipt.driver.name, id: receipt.driver.id },
        total: receipt.payment.total,
        date: formatDate(receipt.completedAt),
        status: 'completed',
      })
    : 'no-data';

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!receipt) return;
    setIsSharing(true);
    try {
      await Share.share({
        title: 'Delivery Receipt',
        message:
          `🧾 Delivery Receipt\n` +
          `Receipt: #${receipt.receiptNumber}\n` +
          `Order: ${receipt.orderNumber}\n` +
          `Date: ${formatDate(receipt.completedAt)}\n` +
          `Service: ${receipt.service.provider}\n` +
          `Distance: ${receipt.route.distance}\n` +
          `Duration: ${receipt.route.duration}\n\n` +
          `💰 Earnings\n` +
          `Delivery Charge: ${formatCurrency(receipt.payment.deliveryCharge)}\n` +
          `Tip: ${formatCurrency(receipt.payment.tip)}\n` +
          (receipt.payment.platformFee > 0 ? `Platform Fee: -${formatCurrency(receipt.payment.platformFee)}\n` : '') +
          `Total Earnings: ${formatCurrency(receipt.payment.total)}\n\n` +
          `Pickup: ${receipt.route.pickup}\n` +
          `Dropoff: ${receipt.route.dropoff}`,
      });
    } catch { /* user cancelled */ }
    setIsSharing(false);
  };

  const handleGoHome = () => router.replace('/dryCleanerDriver/orderRequest');

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Receipt</Text>
        </View>
        <View style={styles.center}><Text style={styles.errorText}>Authentication required</Text></View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Receipt</Text></View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.loadingText}>Building receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Receipt</Text></View>
        <View style={styles.center}><Text style={styles.errorText}>No receipt data found</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleGoHome}>
          <MaterialIcons name="home" size={26} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Receipt</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowQRModal(true)}>
          <MaterialIcons name="qr-code-2" size={26} color={colors.brandColor} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Success banner ─────────────────────────────────────────────── */}
        <View style={styles.successBanner}>
          <View style={styles.successIconRing}>
            <MaterialIcons name="check-circle" size={52} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Delivery Complete! 🎉</Text>
          <Text style={styles.successSub}>Great job! Your earnings have been recorded.</Text>
          <View style={styles.bigEarnings}>
            <Text style={styles.bigEarningsLabel}>Total Earnings</Text>
            <Text style={styles.bigEarningsValue}>{formatCurrency(receipt.payment.total)}</Text>
          </View>
        </View>

        {/* ── Receipt meta ───────────────────────────────────────────────── */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Receipt No.</Text>
            <Text style={styles.metaValue}>#{receipt.receiptNumber}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Order No.</Text>
            <Text style={styles.metaValue}>{receipt.orderNumber}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(receipt.completedAt)}</Text>
          </View>
        </View>

        {/* ── QR Code preview ────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.qrCard} onPress={() => setShowQRModal(true)} activeOpacity={0.8}>
          <View style={styles.qrBox}>
            <QRCode value={qrValue} size={110} color="#000" backgroundColor="#fff" />
          </View>
          <View style={styles.qrInfo}>
            <Text style={styles.qrTitle}>Scan to Verify</Text>
            <Text style={styles.qrSub}>Tap to view full QR code</Text>
            <View style={styles.completedBadge}>
              <MaterialIcons name="verified" size={14} color="#fff" />
              <Text style={styles.completedBadgeText}>COMPLETED</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Payment Breakdown ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="attach-money" size={20} color="#FF8C00" />
            <Text style={styles.cardTitle}>Payment Breakdown</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Delivery Charge</Text>
            <Text style={styles.payVal}>{formatCurrency(receipt.payment.deliveryCharge)}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Customer Tip</Text>
            <Text style={[styles.payVal, { color: '#4CAF50' }]}>{formatCurrency(receipt.payment.tip)}</Text>
          </View>
          {receipt.payment.tax > 0 && (
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Tax</Text>
              <Text style={styles.payVal}>{formatCurrency(receipt.payment.tax)}</Text>
            </View>
          )}
          {receipt.payment.platformFee > 0 && (
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Platform Fee</Text>
              <Text style={[styles.payVal, { color: '#F44336' }]}>-{formatCurrency(receipt.payment.platformFee)}</Text>
            </View>
          )}
          <View style={styles.totalDivider} />
          <View style={styles.payRow}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalVal}>{formatCurrency(receipt.payment.total)}</Text>
          </View>
          <View style={styles.depositNote}>
            <MaterialIcons name="info-outline" size={14} color="#999" />
            <Text style={styles.depositText}>Earnings deposited within 2–3 business days</Text>
          </View>
        </View>

        {/* ── Driver Info ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="person" size={20} color="#FF8C00" />
            <Text style={styles.cardTitle}>Driver Information</Text>
          </View>
          <InfoRow icon="badge" label="Name" value={receipt.driver.name} />
          <InfoRow icon="phone" label="Phone" value={receipt.driver.phone} />
          <InfoRow icon="email" label="Email" value={receipt.driver.email} />
        </View>

        {/* ── Customer Info ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="account-circle" size={20} color="#FF8C00" />
            <Text style={styles.cardTitle}>Customer Information</Text>
          </View>
          <InfoRow icon="person" label="Name" value={receipt.customer.name} />
          <InfoRow icon="phone" label="Phone" value={receipt.customer.phone} />
        </View>

        {/* ── Service Details ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="local-laundry-service" size={20} color="#FF8C00" />
            <Text style={styles.cardTitle}>Service Details</Text>
          </View>
          <InfoRow icon="store" label="Provider" value={receipt.service.provider} />
          <InfoRow icon="category" label="Service" value={receipt.service.type} />
          <InfoRow icon="confirmation-number" label="Order #" value={receipt.orderNumber} />
        </View>

        {/* ── Route ──────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="route" size={20} color="#FF8C00" />
            <Text style={styles.cardTitle}>Route Information</Text>
          </View>
          <View style={styles.routeBlock}>
            <View style={styles.routeRow}>
              <View style={styles.greenDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeType}>Pickup</Text>
                <Text style={styles.routeAddr}>{receipt.route.pickup}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={styles.orangeDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeType}>Dropoff</Text>
                <Text style={styles.routeAddr}>{receipt.route.dropoff}</Text>
              </View>
            </View>
          </View>
          <View style={styles.routeStats}>
            <View style={styles.routeStat}>
              <MaterialIcons name="straighten" size={18} color="#FF8C00" />
              <Text style={styles.routeStatText}>{receipt.route.distance}</Text>
            </View>
            <View style={styles.routeStat}>
              <MaterialIcons name="timer" size={18} color="#FF8C00" />
              <Text style={styles.routeStatText}>{receipt.route.duration}</Text>
            </View>
          </View>
        </View>

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="timeline" size={20} color="#FF8C00" />
            <Text style={styles.cardTitle}>Delivery Timeline</Text>
          </View>
          {receipt.timeline.accepted && (
            <TimelineRow icon="assignment-turned-in" color="#FF8C00" label="Booking Accepted" time={receipt.timeline.accepted} />
          )}
          {receipt.timeline.pickedUp && (
            <TimelineRow icon="local-shipping" color="#2196F3" label="Items Picked Up" time={receipt.timeline.pickedUp} />
          )}
          {receipt.timeline.droppedAtCenter && (
            <TimelineRow icon="store" color="#9C27B0" label="Dropped at Dry Cleaner" time={receipt.timeline.droppedAtCenter} />
          )}
          {receipt.timeline.completed && (
            <TimelineRow icon="done-all" color="#4CAF50" label="Delivery Completed" time={receipt.timeline.completed} />
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── QR Modal ───────────────────────────────────────────────────────── */}
      <Modal visible={showQRModal} transparent animationType="fade" onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt QR Code</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalQR}>
              <QRCode value={qrValue} size={240} color="#000" backgroundColor="#fff" />
            </View>
            <Text style={styles.modalQRLabel}>Scan to verify delivery</Text>
            <Text style={styles.modalReceiptNo}>#{receipt.receiptNumber}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowQRModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Bottom action bar ─────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={isSharing}>
          {isSharing
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <MaterialIcons name="share" size={20} color="#fff" />
                <Text style={styles.shareBtnText}>Share Receipt</Text>
              </>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
          <MaterialIcons name="home" size={22} color="#fff" />
          <Text style={styles.homeBtnText}>Back to Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ── Small helper components ────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <MaterialIcons name={icon} size={18} color="#999" />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
  </View>
);

const TimelineRow = ({ icon, color, label, time }: { icon: any; color: string; label: string; time: string }) => (
  <View style={styles.timelineRow}>
    <MaterialIcons name={icon} size={22} color={color} />
    <View style={{ flex: 1 }}>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineTime}>{formatDate(time)} • {formatTime(time)}</Text>
    </View>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : (StatusBar.currentHeight || 0) + 4,
    paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 3, marginTop: -60,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8F8F8', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  errorText: { fontSize: 16, color: '#F44336', textAlign: 'center' },

  // ── Success banner ──────────────────────────────────────────────────────
  successBanner: {
    backgroundColor: '#FF8C00', padding: 28, alignItems: 'center',
    paddingTop: 36, paddingBottom: 32,
  },
  successIconRing: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  successTitle: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  successSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  bigEarnings: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 16, alignItems: 'center',
  },
  bigEarningsLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  bigEarningsValue: { fontSize: 36, fontWeight: '800', color: '#fff' },

  // ── Meta row ────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, padding: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 11, color: '#999', marginBottom: 4 },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#111', textAlign: 'center' },
  metaDivider: { width: 1, backgroundColor: '#E8E8E8', marginVertical: 4 },

  // ── QR card ─────────────────────────────────────────────────────────────
  qrCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, gap: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
    borderWidth: 2, borderColor: '#FF8C00',
  },
  qrBox: { padding: 8, backgroundColor: '#fff', borderRadius: 8 },
  qrInfo: { flex: 1 },
  qrTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  qrSub: { fontSize: 13, color: '#666', marginBottom: 10 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start',
  },
  completedBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // ── Generic card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111' },

  // ── Payment ─────────────────────────────────────────────────────────────
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  payLabel: { fontSize: 14, color: '#666' },
  payVal: { fontSize: 14, fontWeight: '600', color: '#111' },
  totalDivider: { height: 2, backgroundColor: '#FF8C00', marginVertical: 10, borderRadius: 1 },
  totalLabel: { fontSize: 17, fontWeight: '700', color: '#111' },
  totalVal: { fontSize: 20, fontWeight: '800', color: '#4CAF50' },
  depositNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  depositText: { fontSize: 12, color: '#999', flex: 1 },

  // ── Info rows ───────────────────────────────────────────────────────────
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoLabel: { fontSize: 13, color: '#999', width: 60 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#111', flex: 1, textAlign: 'right' },

  // ── Route ───────────────────────────────────────────────────────────────
  routeBlock: { marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 12 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50', marginTop: 4 },
  orangeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF8C00', marginTop: 4 },
  routeLine: { width: 2, height: 20, backgroundColor: '#DDD', marginLeft: 5, marginVertical: -4 },
  routeType: { fontSize: 11, color: '#999', marginBottom: 2 },
  routeAddr: { fontSize: 13, fontWeight: '500', color: '#111', lineHeight: 18 },
  routeStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFF8EE', padding: 12, borderRadius: 10 },
  routeStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeStatText: { fontSize: 14, fontWeight: '600', color: '#111' },

  // ── Timeline ────────────────────────────────────────────────────────────
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  timelineTime: { fontSize: 12, color: '#999' },

  // ── QR Modal ────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  modalQR: { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#FF8C00', marginBottom: 16 },
  modalQRLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  modalReceiptNo: { fontSize: 13, color: '#FF8C00', fontWeight: '600', marginBottom: 20 },
  modalCloseBtn: { backgroundColor: '#FF8C00', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  modalCloseBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // ── Bottom bar ───────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    gap: 10,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  shareBtn: {
    flexDirection: 'row', height: 50, backgroundColor: '#2196F3', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', gap: 8,
    elevation: 3, shadowColor: '#2196F3', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  shareBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  homeBtn: {
    flexDirection: 'row', height: 52, backgroundColor: '#FF8C00', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', gap: 8,
    elevation: 3, shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  homeBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default DriverReceipt;