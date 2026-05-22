import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Per-unit price including selected add-ons. */
const resolveEffectivePrice = (item: any): number => {
  if (typeof item.effectivePrice === 'number' && item.effectivePrice > 0)
    return item.effectivePrice;
  const base = parseFloat(String(item.price || 0));
  const selected: string[] =
    item.selectedAdditionals || item.options?.selectedAdditionals || [];
  const addOnTotal = (item.additionalservice || [])
    .filter((s: any) => selected.includes(s.name))
    .reduce((sum: number, s: any) => sum + (s.price || 0), 0);
  return base + addOnTotal;
};

const formatStarch = (level: string | number | undefined): string => {
  if (!level) return 'Low';
  if (typeof level === 'string') return level.charAt(0).toUpperCase() + level.slice(1);
  const map: Record<number, string> = { 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'High' };
  return map[level as number] || 'Medium';
};

// ─────────────────────────────────────────────────────────────
// Order Status Timeline Config
// ─────────────────────────────────────────────────────────────
const ORDER_STEPS = [
  { key: 'pending',            label: 'Order Placed',        description: 'Your order has been received and is awaiting confirmation.', icon: 'receipt-long' },
  { key: 'accepted',           label: 'Order Accepted',      description: 'The dry cleaner has accepted your order.',                   icon: 'check-circle' },
  { key: 'in_progress',        label: 'Driver Dispatched',   description: 'A driver is on the way to pick up your items.',              icon: 'local-shipping' },
  { key: 'pickup_completed',   label: 'Items Picked Up',     description: 'Your items have been picked up by the driver.',              icon: 'inventory' },
  { key: 'dropped_at_center',  label: 'At Dry Cleaner',      description: 'Your items have arrived at the dry cleaning facility.',      icon: 'store' },
  { key: 'ready_for_delivery', label: 'Ready for Delivery',  description: 'Your cleaned items are ready and awaiting delivery.',        icon: 'local-laundry-service' },
  { key: 'completed',          label: 'Delivered',           description: 'Your order has been delivered successfully. Enjoy!',         icon: 'done-all' },
];

const STATUS_ORDER = [
  'pending','accepted','in_progress','pickup_completed',
  'dropped_at_center','ready_for_delivery','completed',
];

const STATUS_COLOR: Record<string, string> = {
  pending:            '#F59E0B',
  accepted:           '#3B82F6',
  in_progress:        '#8B5CF6',
  pickup_completed:   '#06B6D4',
  dropped_at_center:  '#10B981',
  ready_for_delivery: '#F97316',
  completed:          '#059669',
  cancelled:          '#EF4444',
};

const getStatusColor = (status: string) => STATUS_COLOR[status?.toLowerCase()] ?? '#9CA3AF';

const getStepState = (stepKey: string, currentStatus: string): 'done' | 'active' | 'upcoming' => {
  if (currentStatus === 'cancelled') return 'upcoming';
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx    = STATUS_ORDER.indexOf(stepKey);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'upcoming';
};

// ─────────────────────────────────────────────────────────────
// OrderTimeline
// ─────────────────────────────────────────────────────────────
const OrderTimeline: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'cancelled') {
    return (
      <View style={timelineStyles.cancelledBox}>
        <MaterialIcons name="cancel" size={28} color="#EF4444" />
        <View style={timelineStyles.cancelledTextWrap}>
          <Text style={timelineStyles.cancelledTitle}>Order Cancelled</Text>
          <Text style={timelineStyles.cancelledSub}>This order has been cancelled.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={timelineStyles.container}>
      {ORDER_STEPS.map((step, idx) => {
        const state   = getStepState(step.key, status);
        const isLast  = idx === ORDER_STEPS.length - 1;
        const color   =
          state === 'done'   ? '#059669' :
          state === 'active' ? getStatusColor(status) :
          '#D1D5DB';

        return (
          <View key={step.key} style={timelineStyles.stepRow}>
            <View style={timelineStyles.stepLeft}>
              <View style={[
                timelineStyles.iconCircle,
                { backgroundColor: state === 'upcoming' ? '#F3F4F6' : color + '18',
                  borderColor: color,
                  borderWidth: state === 'active' ? 2.5 : 1.5 },
              ]}>
                <MaterialIcons name={state === 'done' ? 'check' : step.icon as any} size={18} color={color} />
              </View>
              {!isLast && (
                <View style={[timelineStyles.connector, { backgroundColor: state === 'upcoming' ? '#E5E7EB' : '#059669' }]} />
              )}
            </View>
            <View style={[timelineStyles.stepContent, !isLast && { paddingBottom: 20 }]}>
              <View style={timelineStyles.stepLabelRow}>
                <Text style={[
                  timelineStyles.stepLabel,
                  { color: state === 'upcoming' ? '#9CA3AF' : '#111827' },
                  state === 'active' && { fontWeight: '800' },
                ]}>
                  {step.label}
                </Text>
                {state === 'active' && (
                  <View style={[timelineStyles.activePill, { backgroundColor: color + '20' }]}>
                    <Text style={[timelineStyles.activePillText, { color }]}>Current</Text>
                  </View>
                )}
              </View>
              {(state === 'active' || state === 'done') && (
                <Text style={[timelineStyles.stepDesc, { color: state === 'active' ? '#374151' : '#9CA3AF' }]}>
                  {step.description}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const timelineStyles = StyleSheet.create({
  container: { paddingTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepLeft: { alignItems: 'center', width: 40, marginRight: 14 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  connector: { width: 2, flex: 1, minHeight: 16, marginTop: 2 },
  stepContent: { flex: 1, paddingTop: 6 },
  stepLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  stepDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  activePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  activePillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cancelledBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', gap: 12,
  },
  cancelledTextWrap: { flex: 1 },
  cancelledTitle: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  cancelledSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────
// ItemDetailRow — shows one order item with all its details
// ─────────────────────────────────────────────────────────────
const ItemDetailRow: React.FC<{ item: any; index: number; isLast: boolean }> = ({ item, index, isLast }) => {
  const base          = parseFloat(String(item.price || 0));
  const effectivePrice = resolveEffectivePrice(item);
  const qty           = parseInt(String(item.quantity || item.qty || 1), 10);
  const lineTotal     = effectivePrice * qty;
  const addOnDelta    = effectivePrice - base;

  const selectedAddOns: string[] =
    item.selectedAdditionals || item.options?.selectedAdditionals || [];
  const allAddOns: any[] = item.additionalservice || [];

  const hasWashAndFold = item.options?.washAndFold;
  const hasZipper      = item.options?.zipper;
  const hasButton      = item.options?.button;

  return (
    <View style={[itemStyles.block, !isLast && itemStyles.blockBorder]}>
      {/* Name + line total */}
      <View style={itemStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={itemStyles.name}>{item.name || item.itemName || `Item ${index + 1}`}</Text>
          <Text style={itemStyles.category}>{item.category || ''}</Text>
        </View>
        <View style={itemStyles.priceCol}>
          <Text style={itemStyles.lineTotal}>${lineTotal.toFixed(2)}</Text>
          <Text style={itemStyles.unitBreak}>
            {qty} × ${effectivePrice.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Base vs effective price — only show when add-ons inflate it */}
      {addOnDelta > 0 && (
        <View style={itemStyles.priceBreakRow}>
          <Text style={itemStyles.priceBreakLabel}>Base price</Text>
          <Text style={itemStyles.priceBreakValue}>${base.toFixed(2)}</Text>
        </View>
      )}

      {/* Service option pills: washOnly, washAndFold, zipper, button, starch */}
      <View style={itemStyles.pillRow}>
        {item.washOnly && (
          <View style={itemStyles.pill}><Text style={itemStyles.pillText}>Wash Only</Text></View>
        )}
        {hasWashAndFold && (
          <View style={itemStyles.pill}><Text style={itemStyles.pillText}>Wash & Fold</Text></View>
        )}
        {hasZipper && (
          <View style={itemStyles.pill}><Text style={itemStyles.pillText}>Zipper</Text></View>
        )}
        {hasButton && (
          <View style={itemStyles.pill}><Text style={itemStyles.pillText}>Button</Text></View>
        )}
        <View style={itemStyles.starchPill}>
          <Text style={itemStyles.starchPillText}>
            Starch: {formatStarch(item.starchLevel)}
          </Text>
        </View>
      </View>

      {/* Selected add-ons with individual prices */}
      {selectedAddOns.length > 0 && (
        <View style={itemStyles.addOnsBlock}>
          <Text style={itemStyles.addOnsTitle}>Add-ons</Text>
          {selectedAddOns.map((name: string) => {
            const svc = allAddOns.find((s: any) => s.name === name);
            return (
              <View key={name} style={itemStyles.addOnRow}>
                <View style={itemStyles.addOnDot} />
                <Text style={itemStyles.addOnName}>{name}</Text>
                {svc && svc.price > 0 && (
                  <Text style={itemStyles.addOnPrice}>+${Number(svc.price).toFixed(2)}</Text>
                )}
              </View>
            );
          })}
          {addOnDelta > 0 && (
            <View style={itemStyles.addOnTotal}>
              <Text style={itemStyles.addOnTotalLabel}>Add-ons subtotal</Text>
              <Text style={itemStyles.addOnTotalValue}>+${addOnDelta.toFixed(2)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const itemStyles = StyleSheet.create({
  block: { paddingVertical: 14 },
  blockBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  name:      { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  category:  { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  priceCol:  { alignItems: 'flex-end', minWidth: 80 },
  lineTotal: { fontSize: 15, fontWeight: '700', color: '#FF8C00' },
  unitBreak: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  priceBreakRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceBreakLabel: { fontSize: 12, color: '#9CA3AF' },
  priceBreakValue: { fontSize: 12, color: '#9CA3AF' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#F3F4F6', borderRadius: 20 },
  pillText: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  starchPill: {
    paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: '#FFF7ED', borderRadius: 20,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  starchPillText: { fontSize: 11, color: '#FF8C00', fontWeight: '600' },

  addOnsBlock: {
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  addOnsTitle: { fontSize: 11, fontWeight: '700', color: '#FF8C00', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  addOnRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  addOnDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FF8C00', marginRight: 7 },
  addOnName: { flex: 1, fontSize: 13, color: '#374151' },
  addOnPrice: { fontSize: 13, fontWeight: '600', color: '#FF8C00' },
  addOnTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#FDE68A',
  },
  addOnTotalLabel: { fontSize: 12, color: '#9CA3AF' },
  addOnTotalValue: { fontSize: 13, fontWeight: '700', color: '#FF8C00' },
});

// ─────────────────────────────────────────────────────────────
// PricingBreakdown — full pricing card
// ─────────────────────────────────────────────────────────────
const PricingBreakdown: React.FC<{ order: any }> = ({ order }) => {
  const items: any[]  = order.orderItems || order.items || [];
  const pricing: any  = order.pricing;

  // Recalculate subtotal from effectivePrice so it always matches
  const subtotal = items.reduce(
    (sum, item) => sum + resolveEffectivePrice(item) * parseInt(String(item.quantity || item.qty || 1), 10),
    0,
  );

  const serviceFees    = Number(pricing?.serviceFees    ?? 0);
  const deliveryCharge = Number(pricing?.deliveryCharge ?? order.deliveryCharge ?? 0);
  const platformFee    = Number(pricing?.platformFee    ?? 0);
  const tip            = Number(pricing?.tip            ?? 0);
  const totalAmount    = Number(
    pricing?.totalAmount ?? order.totalAmount ?? order.price ?? order.total ?? 0,
  );

  const PRow = ({ label, value, muted, bold, accent }: {
    label: string; value: string;
    muted?: boolean; bold?: boolean; accent?: boolean;
  }) => (
    <View style={pricingStyles.row}>
      <Text style={[pricingStyles.label, muted && pricingStyles.muted]}>{label}</Text>
      <Text style={[
        pricingStyles.value,
        muted   && pricingStyles.muted,
        bold    && pricingStyles.bold,
        accent  && pricingStyles.accent,
      ]}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={pricingStyles.card}>
      <View style={pricingStyles.titleRow}>
        <MaterialIcons name="receipt" size={18} color="#FF8C00" />
        <Text style={pricingStyles.title}>Price Breakdown</Text>
      </View>

      <PRow label="Items subtotal" value={`$${subtotal.toFixed(2)}`} />
      {serviceFees > 0 && <PRow label={`Service fee`}      value={`$${serviceFees.toFixed(2)}`}    muted />}
      {deliveryCharge > 0 && <PRow label="Delivery charge" value={`$${deliveryCharge.toFixed(2)}`} muted />}
      {platformFee > 0 && <PRow label="Platform fee"       value={`$${platformFee.toFixed(2)}`}    muted />}
      {tip > 0 && <PRow label="Tip"                        value={`$${tip.toFixed(2)}`}             muted />}

      <View style={pricingStyles.divider} />
      <PRow label="Total" value={`$${totalAmount.toFixed(2)}`} bold accent />

      <View style={pricingStyles.paymentRow}>
        <MaterialIcons
          name={order.paymentStatus === 'paid' ? 'check-circle' : 'schedule'}
          size={14}
          color={order.paymentStatus === 'paid' ? '#10B981' : '#F59E0B'}
        />
        <Text style={[
          pricingStyles.paymentText,
          { color: order.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' },
        ]}>
          {order.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'} · {order.paymentMethod || 'Card'}
        </Text>
      </View>
    </View>
  );
};

const pricingStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginVertical: 8, marginHorizontal: 0,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  label: { fontSize: 14, color: '#374151' },
  value: { fontSize: 14, fontWeight: '500', color: '#374151' },
  muted: { color: '#9CA3AF' },
  bold:  { fontWeight: '700', fontSize: 16 },
  accent:{ color: '#FF8C00' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  paymentText: { fontSize: 13, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────
// Main MyOrder Component
// ─────────────────────────────────────────────────────────────
const MyOrder = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();

  const user          = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const [loading, setLoading]           = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [allBookings, setAllBookings]   = useState<any[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const [viewMode, setViewMode]         = useState('list');

  const [qrCode, setQrCode]                 = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrLoading, setQrLoading]           = useState(false);
  const [qrError, setQrError]               = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => { if (user) fetchAllUserBookings(); }, [user])
  );

  useEffect(() => {
    if (!user) { setError('User not authenticated'); setLoading(false); return; }
    fetchAllUserBookings();
  }, [user]);

  const calculateDeliveryTime = useCallback((timeInMinutes: number) => {
    if (!timeInMinutes) return 'N/A';
    const hours   = Math.floor(timeInMinutes / 60);
    const minutes = timeInMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, []);

  const generateBookingQRCode = useCallback(async (bookingId: string) => {
    if (!user?.token) throw new Error('Authentication token not found');
    const response = await axiosInstance.get(`users/bookings/${bookingId}/generate-qr`, {
      headers: { Authorization: `Bearer ${user.token}` },
      timeout: 15000,
    });
    if (response.data.success === false) throw new Error(response.data.message || 'QR code generation failed');
    const qrCodeData = response.data?.data?.qrCode;
    if (!qrCodeData) throw new Error('No QR code data received from server');
    return qrCodeData;
  }, [user?.token]);

  const handleGenerateQRCode = useCallback(async (bookingId: string) => {
    if (!bookingId) { Alert.alert('Error', 'Booking ID is required'); return; }
    setQrLoading(true);
    setQrError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const qrCodeData = await generateBookingQRCode(bookingId);
      setQrCode(qrCodeData);
      setQrModalVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = error?.message || 'Failed to generate QR code';
      setQrError(msg);
      Alert.alert('QR Code Generation Failed', msg);
    } finally {
      setQrLoading(false);
    }
  }, [generateBookingQRCode]);

  const fetchAllUserBookings = useCallback(async () => {
    if (!user?._id || !user?.token) { setError('Authentication required'); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('users/my-bookings', {
        headers: { Authorization: `Bearer ${user.token}` },
        timeout: 15000,
      });
      const bookingsData = response.data?.data || response.data;
      if (!bookingsData) throw new Error('No data received from server');
      if (!Array.isArray(bookingsData)) throw new Error('Invalid response format from server');
      if (bookingsData.length === 0) { setError('No bookings found'); setAllBookings([]); return; }

      const mappedBookings = bookingsData.map((booking: any, index: number) => {
        if (!booking || typeof booking !== 'object') return null;
        return {
          _id:                      booking._id || `temp-${index}`,
          orderNumber:              booking.orderNumber || booking._id || `ORD-${index}`,
          orderId:                  booking._id,
          status:                   booking.status || 'pending',
          createdAt:                booking.createdAt || new Date().toISOString(),
          scheduledPickupDateTime:  booking.scheduledPickupDateTime || booking.pickupDate || booking.createdAt,
          scheduledDeliveryDateTime:booking.scheduledDeliveryDateTime || booking.deliveryDate,
          pickupAddress:            booking.pickupAddress || '',
          dropoffAddress:           booking.dropoffAddress || booking.deliveryAddress || '',
          // preserve full item objects so add-on data is available in detail view
          orderItems:               booking.orderItems || booking.items || [],
          items:                    booking.orderItems || booking.items || [],
          totalAmount:              parseFloat(booking.pricing?.totalAmount || booking.totalPrice || booking.price || 0),
          price:                    parseFloat(booking.pricing?.totalAmount || booking.totalPrice || booking.price || 0),
          total:                    parseFloat(booking.pricing?.totalAmount || booking.totalPrice || booking.price || 0),
          time:                     booking.time || '',
          distance:                 booking.distance || '',
          bookingType:              booking.bookingType || '',
          paymentMethod:            booking.paymentMethod || '',
          paymentStatus:            booking.paymentStatus || '',
          trackingId:               booking.trackingId || booking.Tracking_ID || '',
          dryCleaner:               booking.dryCleaner || null,
          driver:                   booking.driver || null,
          user:                     booking.user || null,
          deliveryTime:             booking.deliveryTime || calculateDeliveryTime(booking.time) || 'N/A',
          // keep the full pricing object
          pricing:                  booking.pricing || null,
          deliveryCharge:           booking.deliveryCharge || 0,
        };
      }).filter(Boolean);

      setAllBookings(mappedBookings);
      setViewMode('list');
    } catch (error: any) {
      let msg = 'Failed to load bookings';
      if (error?.response?.status === 500)      msg = 'Server error - please try again';
      else if (error?.response?.status === 401) msg = 'Authentication failed - please login again';
      else if (error?.response?.status === 404) msg = 'Booking history endpoint not found';
      else if (error?.message)                  msg = error.message;
      setError(msg);
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, calculateDeliveryTime]);

  const handleOrderSelect = useCallback((order: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedOrder(order);
    dispatch(saveOrderData({
      orderId:       order._id,
      items:         order.orderItems || order.items || [],
      totalAmount:   order.totalAmount,
      pickupAddress: order.pickupAddress,
      dropoffAddress:order.dropoffAddress,
    }));
    setViewMode('detail');
  }, [dispatch]);

  const handleChangeAddress = useCallback(() => {
    if (selectedOrder) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('PickupAndDeliveryAddressScreen', {
        bookingId:            selectedOrder._id,
        currentPickupAddress: selectedOrder.pickupAddress,
        currentDropoffAddress:selectedOrder.dropoffAddress,
        orderNumber:          selectedOrder.orderNumber || selectedOrder._id,
      });
    }
  }, [navigation, selectedOrder]);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return 'Not specified';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return 'Invalid date'; }
  }, []);

  const formatTime = useCallback((timeString: string) => {
    if (!timeString) return 'Not specified';
    return timeString;
  }, []);

  const handleGoBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMode === 'detail') { setViewMode('list'); setSelectedOrder(null); }
    else navigation.goBack();
  }, [navigation, viewMode]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fetchAllUserBookings();
  }, [fetchAllUserBookings]);

  // ── QR Modal ─────────────────────────────────────────────
  const QRCodeModal = () => (
    <Modal visible={qrModalVisible} transparent animationType="slide" onRequestClose={() => setQrModalVisible(false)}>
      <View style={styles.qrModalOverlay}>
        <View style={styles.qrModalContent}>
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>Booking QR Code</Text>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQrModalVisible(false); }} style={styles.qrModalCloseButton}>
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
              <TouchableOpacity style={styles.qrRetryButton} onPress={() => handleGenerateQRCode(selectedOrder?._id)}>
                <Text style={styles.qrRetryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : qrCode ? (
            <View style={styles.qrContainer}>
              <Image source={{ uri: qrCode }} style={styles.qrImage} resizeMode="contain" onError={() => setQrError('Failed to load QR code image')} />
              <Text style={styles.qrInstructions}>Show this QR code at the service location</Text>
              <Text style={styles.qrBookingId}>Booking: {selectedOrder?.orderNumber || selectedOrder?._id}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  // ── Booking list item ─────────────────────────────────────
  const renderBookingItem = useCallback(({ item }: { item: any }) => {
    const orderItems  = item.orderItems || item.items || [];
    const itemCount   = orderItems.length;
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity style={styles.bookingItem} onPress={() => handleOrderSelect(item)} activeOpacity={0.7}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>#{item.orderNumber || item._id}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status || 'Confirmed'}</Text>
            </View>
          </View>
          <View style={styles.bookingAmount}>
            <Text style={styles.amountText}>${item.totalAmount?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.itemCountText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.bookingDetails}>
          <View style={styles.dateRow}>
            <MaterialIcons name="schedule" size={14} color="#666" />
            <Text style={styles.dateText}>{formatDate(item.createdAt)} · {formatTime(item.time || '12:00 PM')}</Text>
          </View>
          {item.pickupAddress && (
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color="#666" />
              <Text style={styles.addressText} numberOfLines={1}>{item.pickupAddress}</Text>
            </View>
          )}
          {item.dryCleaner && (
            <View style={styles.cleanerRow}>
              <MaterialIcons name="store" size={14} color="#666" />
              <Text style={styles.cleanerText} numberOfLines={1}>{item.dryCleaner.shopname || 'Dry Cleaner'}</Text>
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
  }, [handleOrderSelect, formatDate, formatTime]);

  // ── Loading ───────────────────────────────────────────────
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

  // ── Error ─────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}><MaterialIcons name="refresh" size={24} color="#FF8C00" /></TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#666" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── List view ─────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings ({allBookings.length})</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}><MaterialIcons name="refresh" size={24} color="#FF8C00" /></TouchableOpacity>
        </View>
        {allBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Bookings Found</Text>
            <Text style={styles.emptySubtitle}>You haven't made any bookings yet. Start by placing your first order!</Text>
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

  // ── Detail view ───────────────────────────────────────────
  if (viewMode === 'detail' && selectedOrder) {
    const orderItems  = selectedOrder.orderItems || selectedOrder.items || [];
    const orderNumber = selectedOrder.orderNumber || selectedOrder.orderId || selectedOrder._id || 'N/A';
    const statusColor = getStatusColor(selectedOrder.status);

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}><MaterialIcons name="refresh" size={24} color="#FF8C00" /></TouchableOpacity>
        </View>

        <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Banner */}
          <View style={styles.trackBanner}>
            <MaterialIcons name="location-on" size={16} color="#fff" style={styles.bannerIcon} />
            <Text style={styles.trackBannerText}>BOOKING DETAILS</Text>
          </View>

          {/* ── ORDER TRACKING TIMELINE ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="track-changes" size={20} color="#FF8C00" />
              <Text style={styles.sectionTitle}>Order Tracking</Text>
              <View style={[styles.liveStatusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
                <View style={[styles.liveStatusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.liveStatusText, { color: statusColor }]}>
                  {selectedOrder.status?.replace(/_/g, ' ') || 'Pending'}
                </Text>
              </View>
            </View>

            {selectedOrder.driver && (
              <View style={styles.driverInfoBox}>
                <MaterialIcons name="directions-car" size={20} color="#4CAF50" />
                <View style={styles.driverInfoText}>
                  <Text style={styles.driverName}>{selectedOrder.driver.firstName} {selectedOrder.driver.lastName}</Text>
                  {selectedOrder.driver.phoneNumber && (
                    <Text style={styles.driverPhone}>{selectedOrder.driver.phoneNumber}</Text>
                  )}
                </View>
                <View style={styles.driverLabel}>
                  <Text style={styles.driverLabelText}>Your Driver</Text>
                </View>
              </View>
            )}

            {selectedOrder.dryCleaner && (
              <View style={styles.cleanerInfoBox}>
                <MaterialIcons name="store" size={18} color="#FF8C00" />
                <View style={styles.driverInfoText}>
                  <Text style={styles.driverName}>{selectedOrder.dryCleaner.shopname}</Text>
                  {selectedOrder.dryCleaner.phoneNumber && (
                    <Text style={styles.driverPhone}>{selectedOrder.dryCleaner.phoneNumber}</Text>
                  )}
                </View>
              </View>
            )}

            <OrderTimeline status={selectedOrder.status} />
          </View>

          {/* ── BOOKING INFORMATION ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking ID</Text>
              <Text style={styles.detailValue}>{orderNumber}</Text>
            </View>
            {selectedOrder.trackingId ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tracking ID</Text>
                <Text style={styles.detailValue}>{selectedOrder.trackingId}</Text>
              </View>
            ) : null}
            <View style={styles.statusRow}>
              <Text style={[styles.detailValue, styles.statusTextDetail, { color: statusColor }]}>
                Status: {selectedOrder.status?.replace(/_/g, ' ') || 'Confirmed'}
              </Text>
            </View>
            {selectedOrder.createdAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Booking Date</Text>
                <Text style={styles.detailValue}>{formatDate(selectedOrder.createdAt)}</Text>
              </View>
            )}
          </View>

          {/* ── SCHEDULE ── */}
          {(selectedOrder.scheduledPickupDateTime || selectedOrder.scheduledDeliveryDateTime) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="schedule" size={20} color="#FF8C00" />
                <Text style={styles.sectionTitle}>Schedule</Text>
              </View>
              {selectedOrder.scheduledPickupDateTime && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Pickup</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedOrder.scheduledPickupDateTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
              {selectedOrder.scheduledDeliveryDateTime && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivery</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedOrder.scheduledDeliveryDateTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── ADDRESSES ── */}
          {(selectedOrder.pickupAddress || selectedOrder.dropoffAddress) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="place" size={20} color="#FF8C00" />
                <Text style={styles.sectionTitle}>Addresses</Text>
              </View>
              {selectedOrder.pickupAddress && (
                <View style={styles.addressRowDetail}>
                  <View style={styles.addressIconContainer}><View style={styles.pickupDot} /></View>
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>Pickup</Text>
                    <Text style={styles.addressTextDetail}>{selectedOrder.pickupAddress}</Text>
                  </View>
                  <TouchableOpacity style={styles.changeButton} onPress={handleChangeAddress}>
                    <Text style={styles.changeButtonText}>CHANGE</Text>
                  </TouchableOpacity>
                </View>
              )}
              {selectedOrder.dropoffAddress && (
                <View style={styles.addressRowDetail}>
                  <View style={styles.addressIconContainer}><View style={styles.dropoffDot} /></View>
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>Drop Off</Text>
                    <Text style={styles.addressTextDetail}>{selectedOrder.dropoffAddress}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── QR CODE ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="qr-code" size={20} color="#FF8C00" />
              <Text style={styles.sectionTitle}>Booking QR Code</Text>
            </View>
            <TouchableOpacity style={styles.generateQrButton} onPress={() => handleGenerateQRCode(selectedOrder._id)} disabled={qrLoading}>
              {qrLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : (<><MaterialIcons name="qr-code" size={20} color="#fff" /><Text style={styles.generateQrButtonText}>Generate QR Code</Text></>)
              }
            </TouchableOpacity>
            <Text style={styles.qrText}>Booking ID: {orderNumber}</Text>
          </View>

          {/* ── ITEMS (with full add-on / option detail) ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="list" size={20} color="#FF8C00" />
              <Text style={styles.sectionTitle}>Booking Items ({orderItems.length})</Text>
            </View>

            {orderItems.length > 0 ? (
              orderItems.map((item: any, index: number) => (
                <ItemDetailRow
                  key={index}
                  item={item}
                  index={index}
                  isLast={index === orderItems.length - 1}
                />
              ))
            ) : (
              <Text style={styles.noItemsText}>No items found in this booking</Text>
            )}
          </View>

          {/* ── PRICE BREAKDOWN ── */}
          <View style={styles.section}>
            <PricingBreakdown order={selectedOrder} />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        <QRCodeModal />
      </View>
    );
  }

  return null;
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  refreshButton: { padding: 4 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  errorText: { fontSize: 16, color: '#666', textAlign: 'center', marginVertical: 16 },
  retryButton: { backgroundColor: '#FF8C00', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 16 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { paddingVertical: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 },
  bookingItem: {
    backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 6,
    borderRadius: 12, padding: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  bookingInfo: { flex: 1 },
  bookingId: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  bookingAmount: { alignItems: 'flex-end' },
  amountText: { fontSize: 18, fontWeight: '700', color: '#FF8C00' },
  itemCountText: { fontSize: 12, color: '#666', marginTop: 2 },
  bookingDetails: { marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dateText: { fontSize: 14, color: '#666', marginLeft: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  addressText: { fontSize: 14, color: '#666', marginLeft: 8, flex: 1 },
  cleanerRow: { flexDirection: 'row', alignItems: 'center' },
  cleanerText: { fontSize: 14, color: '#666', marginLeft: 8, flex: 1 },
  bookingFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  viewDetailsButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  viewDetailsText: { fontSize: 14, color: '#FF8C00', fontWeight: '500', marginRight: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  trackBanner: { backgroundColor: '#FF8C00', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  bannerIcon: { marginRight: 8 },
  trackBannerText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  section: { backgroundColor: '#fff', marginVertical: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  liveStatusBadge: {
    marginLeft: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  liveStatusDot: { width: 7, height: 7, borderRadius: 4 },
  liveStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  driverInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0FFF4', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 16,
  },
  cleanerInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FED7AA', marginBottom: 16,
  },
  driverInfoText: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  driverPhone: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  driverLabel: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  driverLabelText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailLabel: { fontSize: 14, color: '#666' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  statusRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statusTextDetail: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  addressRowDetail: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  addressIconContainer: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  pickupDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50' },
  dropoffDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF8C00' },
  addressContent: { flex: 1 },
  addressLabel: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4 },
  addressTextDetail: { fontSize: 14, color: '#666', lineHeight: 20 },
  changeButton: { paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  changeButtonText: { color: '#FF8C00', fontSize: 12, fontWeight: '600' },
  generateQrButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF8C00', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginBottom: 12 },
  generateQrButtonText: { color: '#fff', fontSize: 16, fontWeight: '500', marginLeft: 8 },
  qrText: { fontSize: 14, color: '#666', textAlign: 'center' },
  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalContent: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 350, padding: 0 },
  qrModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  qrModalTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  qrModalCloseButton: { padding: 4 },
  qrLoadingContainer: { alignItems: 'center', paddingVertical: 40 },
  qrLoadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  qrErrorContainer: { alignItems: 'center', paddingVertical: 20 },
  qrErrorText: { fontSize: 14, color: '#FF6B6B', textAlign: 'center', marginBottom: 16 },
  qrRetryButton: { backgroundColor: '#FF8C00', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  qrRetryButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  qrContainer: { alignItems: 'center', paddingVertical: 20 },
  qrImage: { width: 200, height: 200, backgroundColor: '#F5F5F5', borderRadius: 8 },
  qrInstructions: { marginTop: 16, fontSize: 14, color: '#666', textAlign: 'center' },
  qrBookingId: { marginTop: 8, fontSize: 12, color: '#999', textAlign: 'center' },
  noItemsText: { fontSize: 14, color: '#666', fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
});

export default MyOrder;