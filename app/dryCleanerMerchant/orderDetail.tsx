import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import axiosInstance from '../../api/axios';
import colors from '../../assets/color';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  category?: string;
  // Add-on / options fields (mirrored from MyOrder)
  effectivePrice?: number;
  selectedAdditionals?: string[];
  additionalservice?: { name: string; price: number }[];
  options?: {
    selectedAdditionals?: string[];
    washAndFold?: boolean;
    zipper?: boolean;
    button?: boolean;
  };
  washOnly?: boolean;
  starchLevel?: string | number;
}

interface Booking {
  _id: string;
  orderNumber?: string;
  status: string;
  createdAt: string;
  orderItems?: OrderItem[];
  pricing?: {
    totalAmount: number;
    deliveryCharge: number;
    subtotal: number;
    serviceFees: number;
    platformFee?: number;
    tip?: number;
  };
  pickupAddress?: string;
  dropoffAddress?: string;
  scheduledPickupDateTime?: string;
  scheduledDeliveryDateTime?: string;
  user?: { _id: string; firstName: string; lastName: string; phoneNumber?: string; email?: string };
  dryCleaner?: { _id: string; shopname: string; address?: any; phoneNumber?: string };
  driver?: { _id: string; firstName: string; lastName: string; phoneNumber?: string };
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryCharge?: number;
  totalAmount?: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers (ported from MyOrder)
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

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending:             { color: '#F59E0B', label: 'Pending',              icon: 'hourglass-empty' },
  accepted:            { color: '#3B82F6', label: 'Accepted',             icon: 'check-circle' },
  in_progress:         { color: '#8B5CF6', label: 'In Progress',          icon: 'local-shipping' },
  pickup_completed:    { color: '#06B6D4', label: 'Picked Up',            icon: 'inventory' },
  dropped_at_center:   { color: '#10B981', label: 'At Your Shop',         icon: 'store' },
  ready_for_delivery:  { color: '#F97316', label: 'Ready for Delivery',   icon: 'local-shipping' },
  completed:           { color: '#059669', label: 'Completed',            icon: 'done-all' },
  cancelled:           { color: '#EF4444', label: 'Cancelled',            icon: 'cancel' },
};

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

const fmtTime = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

const fmtAddress = (addr: any): string => {
  if (!addr) return 'N/A';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object')
    return [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ') || 'N/A';
  return 'N/A';
};

// ─────────────────────────────────────────────────────────────
// ItemDetailRow — ported from MyOrder with full add-on detail
// ─────────────────────────────────────────────────────────────
const ItemDetailRow: React.FC<{ item: any; index: number; isLast: boolean }> = ({ item, index, isLast }) => {
  const base           = parseFloat(String(item.price || 0));
  const effectivePrice = resolveEffectivePrice(item);
  const qty            = parseInt(String(item.quantity || item.qty || 1), 10);
  const lineTotal      = effectivePrice * qty;
  const addOnDelta     = effectivePrice - base;

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
        <View style={itemStyles.nameIconWrap}>
          <MaterialIcons name="checkroom" size={18} color={colors.brandColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={itemStyles.name}>{item.name || item.itemName || `Item ${index + 1}`}</Text>
          {item.category ? <Text style={itemStyles.category}>{item.category}</Text> : null}
        </View>
        <View style={itemStyles.priceCol}>
          <Text style={itemStyles.lineTotal}>${lineTotal.toFixed(2)}</Text>
          <Text style={itemStyles.unitBreak}>{qty} × ${effectivePrice.toFixed(2)}</Text>
        </View>
      </View>

      {/* Base price line when add-ons inflate it */}
      {addOnDelta > 0 && (
        <View style={itemStyles.priceBreakRow}>
          <Text style={itemStyles.priceBreakLabel}>Base price</Text>
          <Text style={itemStyles.priceBreakValue}>${base.toFixed(2)}</Text>
        </View>
      )}

      {/* Service option pills */}
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
  block:        { paddingVertical: 14 },
  blockBorder:  { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  nameIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.brandColor + '18',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  name:      { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  category:  { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  priceCol:  { alignItems: 'flex-end', minWidth: 80 },
  lineTotal: { fontSize: 15, fontWeight: '700', color: colors.brandColor },
  unitBreak: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  priceBreakRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceBreakLabel:{ fontSize: 12, color: '#9CA3AF' },
  priceBreakValue:{ fontSize: 12, color: '#9CA3AF' },

  pillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill:      { paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#F3F4F6', borderRadius: 20 },
  pillText:  { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  starchPill:{
    paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: '#FFF7ED', borderRadius: 20,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  starchPillText: { fontSize: 11, color: colors.brandColor, fontWeight: '600' },

  addOnsBlock: {
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  addOnsTitle:    { fontSize: 11, fontWeight: '700', color: colors.brandColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  addOnRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  addOnDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brandColor, marginRight: 7 },
  addOnName:      { flex: 1, fontSize: 13, color: '#374151' },
  addOnPrice:     { fontSize: 13, fontWeight: '600', color: colors.brandColor },
  addOnTotal:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#FDE68A',
  },
  addOnTotalLabel:{ fontSize: 12, color: '#9CA3AF' },
  addOnTotalValue:{ fontSize: 13, fontWeight: '700', color: colors.brandColor },
});

// ─────────────────────────────────────────────────────────────
// PricingBreakdown — ported from MyOrder
// ─────────────────────────────────────────────────────────────
const PricingBreakdown: React.FC<{ booking: Booking }> = ({ booking }) => {
  const items: any[] = booking.orderItems || [];
  const pricing      = booking.pricing;

  // Recalculate subtotal from effectivePrice so it always matches item detail rows
  const subtotal = items.reduce(
    (sum, item) => sum + resolveEffectivePrice(item) * parseInt(String(item.quantity || item.qty || 1), 10),
    0,
  );

  const serviceFees    = Number(pricing?.serviceFees    ?? 0);
  const deliveryCharge = Number(pricing?.deliveryCharge ?? booking.deliveryCharge ?? 0);
  const platformFee    = Number(pricing?.platformFee    ?? 0);
  const tip            = Number(pricing?.tip            ?? 0);
  const totalAmount    = Number(
    pricing?.totalAmount ?? booking.totalAmount ?? 0,
  );

  const PRow = ({
    label, value, muted, bold, accent,
  }: { label: string; value: string; muted?: boolean; bold?: boolean; accent?: boolean }) => (
    <View style={pricingStyles.row}>
      <Text style={[pricingStyles.label, muted && pricingStyles.muted]}>{label}</Text>
      <Text style={[
        pricingStyles.value,
        muted  && pricingStyles.muted,
        bold   && pricingStyles.bold,
        accent && pricingStyles.accent,
      ]}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={pricingStyles.card}>
      <View style={pricingStyles.titleRow}>
        <MaterialIcons name="receipt" size={18} color={colors.brandColor} />
        <Text style={pricingStyles.title}>Price Breakdown</Text>
      </View>

      <PRow label="Items subtotal" value={`$${subtotal.toFixed(2)}`} />
      {serviceFees > 0    && <PRow label="Service fee"     value={`$${serviceFees.toFixed(2)}`}    muted />}
      {deliveryCharge > 0 && <PRow label="Delivery charge" value={`$${deliveryCharge.toFixed(2)}`} muted />}
      {platformFee > 0    && <PRow label="Platform fee"    value={`$${platformFee.toFixed(2)}`}    muted />}
      {tip > 0            && <PRow label="Tip"             value={`$${tip.toFixed(2)}`}            muted />}

      <View style={pricingStyles.divider} />
      <PRow label="Total" value={`$${totalAmount.toFixed(2)}`} bold accent />

      <View style={pricingStyles.paymentRow}>
        <MaterialIcons
          name={booking.paymentStatus === 'paid' ? 'check-circle' : 'schedule'}
          size={14}
          color={booking.paymentStatus === 'paid' ? '#10B981' : '#F59E0B'}
        />
        <Text style={[
          pricingStyles.paymentText,
          { color: booking.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' },
        ]}>
          {booking.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'} · {booking.paymentMethod || 'Card'}
        </Text>
      </View>
    </View>
  );
};

const pricingStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label:    { fontSize: 14, color: '#374151' },
  value:    { fontSize: 14, fontWeight: '500', color: '#374151' },
  muted:    { color: '#9CA3AF' },
  bold:     { fontWeight: '700', fontSize: 16 },
  accent:   { color: colors.brandColor },
  divider:  { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  paymentText: { fontSize: 13, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────
// Small reusable components
// ─────────────────────────────────────────────────────────────
const SectionCard: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon as any} size={20} color={colors.brandColor} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────
const MerchantOrderDetails: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useSelector((state: any) => state.auth);

  const [booking, setBooking]           = useState<Booking | null>(null);
  const [loading, setLoading]           = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Fetch booking ────────────────────────────────────────
  const fetchBooking = useCallback(async () => {
    const bookingId = params.bookingId as string;
    if (!bookingId) {
      Alert.alert('Error', 'No booking ID provided');
      router.back();
      return;
    }
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/users/merchant-bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success && res.data.data) setBooking(res.data.data);
      else throw new Error('Booking not found');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load order details');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.bookingId, token]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  // ── Mark as ready for delivery ───────────────────────────
  const handleMarkReady = () => {
    if (!booking) return;
    Alert.alert(
      'Mark as Ready',
      'Confirm the cleaned items are ready for delivery? Drivers will be able to see and accept this order.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setUpdatingStatus(true);
              const res = await axiosInstance.put(
                '/users/update-status',
                { bookingId: booking._id, status: 'ready_for_delivery' },
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (res.data.success) {
                await fetchBooking();
                Alert.alert('✅ Done', 'Order marked as ready for delivery. Drivers can now accept it.');
              } else {
                throw new Error(res.data.message || 'Update failed');
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update status');
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ],
    );
  };

  // ── Derived state ────────────────────────────────────────
  const statusCfg = STATUS_CONFIG[booking?.status ?? ''] ?? {
    color: '#6B7280', label: booking?.status ?? 'Unknown', icon: 'info',
  };
  const canMarkReady  = booking?.status === 'dropped_at_center';
  const orderItems    = booking?.orderItems || [];

  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brandColor} style={{ marginTop: 80 }} />
        <Text style={styles.loadingText}>Loading order…</Text>
      </SafeAreaView>
    );
  }
  if (!booking) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={fetchBooking}>
          <MaterialIcons name="refresh" size={22} color={colors.brandColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.orderNumber}>{booking.orderNumber ?? `#${booking._id.slice(-6).toUpperCase()}`}</Text>
              <Text style={styles.orderDate}>{fmtDate(booking.createdAt)} · {fmtTime(booking.createdAt)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
              <MaterialIcons name={statusCfg.icon as any} size={15} color={statusCfg.color} />
              <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>

          {/* Workflow hint */}
          <View style={styles.hintBox}>
            <MaterialIcons
              name={
                booking.status === 'dropped_at_center' ? 'store' :
                booking.status === 'ready_for_delivery' ? 'local-shipping' :
                booking.status === 'completed' ? 'done-all' : 'info'
              }
              size={16}
              color={statusCfg.color}
            />
            <Text style={[styles.hintText, { color: statusCfg.color }]}>
              {booking.status === 'dropped_at_center'
                ? 'Items are at your shop. Mark them ready for delivery – drivers will then be able to accept the order.'
                : booking.status === 'ready_for_delivery'
                  ? 'Order is ready. A driver will pick it up from your shop and deliver to the customer.'
                  : booking.status === 'completed'
                    ? 'This order has been completed.'
                    : 'Order is being processed.'}
            </Text>
          </View>

          {/* Assigned driver info */}
          {booking.driver && (
            <View style={styles.assignedDriverBox}>
              <MaterialIcons name="directions-car" size={18} color="#4CAF50" />
              <Text style={styles.assignedDriverText}>
                Driver: {booking.driver.firstName} {booking.driver.lastName}
                {booking.driver.phoneNumber ? ` · ${booking.driver.phoneNumber}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Customer */}
        {booking.user && (
          <SectionCard icon="person" title="Customer">
            <InfoRow label="Name" value={`${booking.user.firstName} ${booking.user.lastName}`} />
            {booking.user.phoneNumber && <InfoRow label="Phone" value={booking.user.phoneNumber} />}
            {booking.user.email && <InfoRow label="Email" value={booking.user.email} />}
          </SectionCard>
        )}

        {/* ── Items with full add-on / option detail ── */}
        {orderItems.length > 0 && (
          <SectionCard icon="dry-cleaning" title={`Items (${orderItems.length})`}>
            {orderItems.map((item, index) => (
              <ItemDetailRow
                key={index}
                item={item}
                index={index}
                isLast={index === orderItems.length - 1}
              />
            ))}
          </SectionCard>
        )}

        {/* ── Price Breakdown ── */}
        <View style={styles.sectionCard}>
          <PricingBreakdown booking={booking} />
        </View>

        {/* Addresses */}
        <SectionCard icon="place" title="Pickup & Delivery">
          <View style={styles.addrRow}>
            <View style={[styles.addrDot, { backgroundColor: '#3B82F6' }]} />
            <View style={styles.addrInfo}>
              <Text style={styles.addrLabel}>Customer Pickup Address</Text>
              <Text style={styles.addrValue}>{booking.pickupAddress ?? 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.addrLine} />
          <View style={styles.addrRow}>
            <View style={[styles.addrDot, { backgroundColor: '#F97316' }]} />
            <View style={styles.addrInfo}>
              <Text style={styles.addrLabel}>Your Shop (Dry Cleaner)</Text>
              <Text style={styles.addrValue}>{fmtAddress(booking.dryCleaner?.address)}</Text>
            </View>
          </View>
        </SectionCard>

        {/* Schedule */}
        {(booking.scheduledPickupDateTime || booking.scheduledDeliveryDateTime) && (
          <SectionCard icon="schedule" title="Schedule">
            {booking.scheduledPickupDateTime && (
              <InfoRow label="Pickup" value={`${fmtDate(booking.scheduledPickupDateTime)} ${fmtTime(booking.scheduledPickupDateTime)}`} />
            )}
            {booking.scheduledDeliveryDateTime && (
              <InfoRow label="Delivery" value={`${fmtDate(booking.scheduledDeliveryDateTime)} ${fmtTime(booking.scheduledDeliveryDateTime)}`} />
            )}
          </SectionCard>
        )}

        {/* Payment */}
        <SectionCard icon="payment" title="Payment">
          <InfoRow label="Method" value={booking.paymentMethod ?? 'N/A'} />
          <InfoRow
            label="Status"
            value={booking.paymentStatus === 'paid' ? 'Paid ✓' : 'Pending'}
            valueColor={booking.paymentStatus === 'paid' ? '#10B981' : '#F59E0B'}
          />
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={styles.bottomBar}>
        {canMarkReady ? (
          <TouchableOpacity
            style={[styles.btnPrimary, updatingStatus && { opacity: 0.6 }]}
            onPress={handleMarkReady}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="inventory" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Mark Ready for Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.btnInfo}>
            <MaterialIcons name={statusCfg.icon as any} size={18} color={statusCfg.color} />
            <Text style={[styles.btnInfoText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F3F4F6' },
  loadingText:  { textAlign: 'center', marginTop: 12, color: '#6B7280' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    elevation: 3,
  },
  headerBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  summaryTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  orderNumber: { fontSize: 20, fontWeight: '800', color: '#111827' },
  orderDate:   { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusLabel: { fontSize: 12, fontWeight: '600' },

  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 10,
    padding: 12, marginTop: 4,
  },
  hintText: { fontSize: 13, lineHeight: 18, flex: 1 },

  assignedDriverBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FFF4', borderRadius: 10,
    padding: 10, marginTop: 10,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  assignedDriverText: { fontSize: 13, fontWeight: '600', color: '#065F46', flex: 1 },

  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#111827' },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111827', maxWidth: '60%', textAlign: 'right' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },

  addrRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  addrDot:  { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 10 },
  addrLine: { width: 2, height: 24, backgroundColor: '#E5E7EB', marginLeft: 5, marginTop: -4, marginBottom: -4 },
  addrInfo: { flex: 1 },
  addrLabel:{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  addrValue:{ fontSize: 14, color: '#111827', lineHeight: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    elevation: 10,
  },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brandColor, borderRadius: 14, paddingVertical: 14, gap: 8,
    elevation: 4, shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6,
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnInfo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 14, paddingVertical: 14, gap: 8,
  },
  btnInfoText: { fontSize: 14, fontWeight: '600' },
});

export default MerchantOrderDetails;