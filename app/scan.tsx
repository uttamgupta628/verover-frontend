import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import axiosInstance from '../api/axios';
import type { RootState } from '../components/redux/store';
import colors from '../assets/color';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DryCleanerQRData {
  dryCleanerId?: string;
  shopname?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  rating?: number;
  openingHours?: string;
  services?: string[];
}

interface BookingQRData {
  bookingId?: string;
  vehicleNumber?: string;
  location?: string;
  slot?: string;
  from?: string;
  to?: string;
  amount?: number;
  type?: string;
  // ── Flat payment fields (some QR encoders may embed these at top level) ──
  paymentMethod?: string;
  paymentStatus?: string;
  // ── Nested payment fields — matches ILotRecord / IGarageBooking / IResidenceBooking ──
  // paymentDetails.method = "CASH" | "CREDIT" | "DEBIT" | "STRIPE" | "UPI" | "PAYPAL"
  // paymentDetails.status = "PENDING" | "SUCCESS" | "FAILED"
  paymentDetails?: {
    method?: string;
    status?: string;
    amount?: number;
    transactionId?: string;
    paymentGateway?: string;
    paidAt?: string;
  };
  dryCleaner?: DryCleanerQRData;
  user?: { firstName?: string; lastName?: string; email?: string };
  status?: string;
  totalAmount?: number;
  pickupAddress?: string;
  dropoffAddress?: string;
}

interface OrderItem {
  _id: string;
  orderNumber?: string;
  status?: string;
  createdAt?: string;
  items?: any[];
  orderItems?: any[];
  totalAmount?: number;
  pricing?: { totalAmount?: number; subtotal?: number; deliveryCharge?: number; serviceFees?: number };
  pickupAddress?: string;
  deliveryAddress?: string;
  dropoffAddress?: string;
  pickupTime?: string;
  deliveryTime?: string;
  scheduledPickupDateTime?: string;
  scheduledDeliveryDateTime?: string;
  dryCleaner?: { _id?: string; shopname?: string; phoneNumber?: string; address?: any };
  driver?: { firstName?: string; lastName?: string; phoneNumber?: string };
  user?: { firstName?: string; lastName?: string; phoneNumber?: string; email?: string };
  paymentMethod?: string;
  paymentStatus?: string;
  specialInstructions?: string;
  notes?: string;
}

type ScanState = 'scanning' | 'parsed' | 'dryCleaner' | 'dryCleaningBooking' | 'raw';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDateTime = (iso?: string) => {
  if (!iso || iso === 'N/A') return 'N/A';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } catch { return 'N/A'; }
};

const formatDateShort = (iso?: string) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return 'N/A'; }
};

const formatTime = (iso?: string) => {
  if (!iso || iso === 'N/A') return 'N/A';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return 'N/A'; }
};

const fmtAddress = (addr: any): string => {
  if (!addr) return 'N/A';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object')
    return [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ') || 'N/A';
  return 'N/A';
};

const calculateDuration = (from?: string, to?: string) => {
  if (!from || !to) return 'N/A';
  try {
    const diffMs = new Date(to).getTime() - new Date(from).getTime();
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return 'N/A'; }
};

// ── Payment method helpers ─────────────────────────────────────────────────────

/**
 * Resolves payment method + status from either:
 *  - nested  booking.paymentDetails.method / .status  (parking/garage/residence models)
 *  - flat    booking.paymentMethod / .paymentStatus   (dry cleaning / legacy)
 *
 * Model enum values: "CASH" | "CREDIT" | "DEBIT" | "STRIPE" | "UPI" | "PAYPAL"
 * Model status enum: "PENDING" | "SUCCESS" | "FAILED"
 */
const getPaymentConfig = (
  methodRaw?: string,
  statusRaw?: string,
) => {
  const m = (methodRaw ?? '').toLowerCase().trim();

  let label = 'N/A';
  let icon: any = 'help-circle-outline';
  let color = '#9CA3AF';

  if (!m || m === 'n/a') {
    label = 'N/A'; icon = 'help-circle-outline'; color = '#9CA3AF';
  } else if (m === 'cash') {
    label = 'Cash'; icon = 'cash-outline'; color = '#16A34A';
  } else if (m === 'credit') {
    label = 'Credit Card'; icon = 'card-outline'; color = '#2563EB';
  } else if (m === 'debit') {
    label = 'Debit Card'; icon = 'card-outline'; color = '#1D4ED8';
  } else if (m === 'stripe') {
    label = 'Card (Stripe)'; icon = 'card-outline'; color = '#6366F1';
  } else if (m === 'upi') {
    label = 'UPI'; icon = 'phone-portrait-outline'; color = '#0891B2';
  } else if (m === 'paypal') {
    label = 'PayPal'; icon = 'logo-paypal'; color = '#003087';
  } else if (m.includes('wallet')) {
    label = 'Wallet'; icon = 'wallet-outline'; color = '#7C3AED';
  } else if (m.includes('online') || m.includes('net')) {
    label = 'Online'; icon = 'phone-portrait-outline'; color = '#0891B2';
  } else {
    label = (methodRaw ?? '').charAt(0).toUpperCase() + (methodRaw ?? '').slice(1).toLowerCase();
    icon = 'card-outline';
    color = '#6B7280';
  }

  // Model status: "SUCCESS" = paid, "PENDING" = pending, "FAILED" = failed
  const s = (statusRaw ?? '').toLowerCase();
  const isPaid = s === 'success' || s === 'paid';
  const isFailed = s === 'failed';

  return { label, icon, color, isPaid, isFailed, statusRaw };
};

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending:            { color: '#F59E0B', label: 'Pending',            icon: 'hourglass-outline' },
  accepted:           { color: '#3B82F6', label: 'Accepted',           icon: 'checkmark-circle-outline' },
  in_progress:        { color: '#8B5CF6', label: 'In Progress',        icon: 'car-outline' },
  pickup_completed:   { color: '#06B6D4', label: 'Picked Up',          icon: 'bag-check-outline' },
  dropped_at_center:  { color: '#10B981', label: 'At Dry Cleaner',     icon: 'storefront-outline' },
  ready_for_delivery: { color: '#F97316', label: 'Ready for Delivery', icon: 'cube-outline' },
  completed:          { color: '#059669', label: 'Completed',          icon: 'checkmark-done-outline' },
  cancelled:          { color: '#EF4444', label: 'Cancelled',          icon: 'close-circle-outline' },
};

const ORDER_STEPS = [
  { key: 'pending',            label: 'Order Placed',        icon: 'receipt-outline' },
  { key: 'accepted',           label: 'Accepted',            icon: 'checkmark-circle-outline' },
  { key: 'in_progress',        label: 'Driver Dispatched',   icon: 'car-outline' },
  { key: 'pickup_completed',   label: 'Items Picked Up',     icon: 'bag-check-outline' },
  { key: 'dropped_at_center',  label: 'At Dry Cleaner',      icon: 'storefront-outline' },
  { key: 'ready_for_delivery', label: 'Ready for Delivery',  icon: 'cube-outline' },
  { key: 'completed',          label: 'Delivered',           icon: 'checkmark-done-outline' },
];

const STATUS_ORDER = ORDER_STEPS.map(s => s.key);

const getStepState = (stepKey: string, currentStatus: string): 'done' | 'active' | 'upcoming' => {
  if (currentStatus === 'cancelled') return 'upcoming';
  const ci = STATUS_ORDER.indexOf(currentStatus);
  const si = STATUS_ORDER.indexOf(stepKey);
  if (si < ci) return 'done';
  if (si === ci) return 'active';
  return 'upcoming';
};

const getTypeColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'garage':    return '#FF9800';
    case 'residence': return '#4CAF50';
    case 'parking lot':
    case 'parking':   return '#2196F3';
    default:          return colors.primary;
  }
};

const getTypeIcon = (type?: string): any => {
  switch (type?.toLowerCase()) {
    case 'garage':    return 'construct';
    case 'residence': return 'home';
    default:          return 'car-sport';
  }
};

const renderStars = (rating?: number) => {
  if (!rating) return null;
  const stars = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) => (
    <Ionicons key={i} name={i < stars ? 'star' : 'star-outline'} size={13} color={i < stars ? '#FFC107' : '#ccc'} />
  ));
};

// ── Order Timeline ────────────────────────────────────────────────────────────

const OrderTimeline: React.FC<{ status: string }> = ({ status }) => {
  const isCancelled = status === 'cancelled';
  const statusCfg = STATUS_CONFIG[status] ?? { color: '#9CA3AF', label: status, icon: 'help-circle-outline' };

  if (isCancelled) {
    return (
      <View style={tl.cancelledBox}>
        <Ionicons name="close-circle-outline" size={26} color="#EF4444" />
        <View style={{ flex: 1 }}>
          <Text style={tl.cancelledTitle}>Order Cancelled</Text>
          <Text style={tl.cancelledSub}>This order has been cancelled.</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {ORDER_STEPS.map((step, idx) => {
        const state = getStepState(step.key, status);
        const isLast = idx === ORDER_STEPS.length - 1;
        const color =
          state === 'done'   ? '#059669' :
          state === 'active' ? statusCfg.color :
          '#D1D5DB';

        return (
          <View key={step.key} style={tl.row}>
            <View style={tl.left}>
              <View style={[tl.circle, {
                backgroundColor: state === 'upcoming' ? '#F3F4F6' : color + '18',
                borderColor: color,
                borderWidth: state === 'active' ? 2.5 : 1.5,
              }]}>
                <Ionicons
                  name={(state === 'done' ? 'checkmark' : step.icon) as any}
                  size={16} color={color}
                />
              </View>
              {!isLast && (
                <View style={[tl.connector, { backgroundColor: state === 'upcoming' ? '#E5E7EB' : '#059669' }]} />
              )}
            </View>
            <View style={[tl.content, !isLast && { paddingBottom: 18 }]}>
              <View style={tl.labelRow}>
                <Text style={[tl.label, { color: state === 'upcoming' ? '#9CA3AF' : '#111' }, state === 'active' && { fontWeight: '800' }]}>
                  {step.label}
                </Text>
                {state === 'active' && (
                  <View style={[tl.pill, { backgroundColor: color + '20' }]}>
                    <Text style={[tl.pillText, { color }]}>Now</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const tl = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-start' },
  left:      { alignItems: 'center', width: 36, marginRight: 12 },
  circle:    { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  connector: { width: 2, flex: 1, minHeight: 14, marginTop: 2 },
  content:   { flex: 1, paddingTop: 5 },
  labelRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label:     { fontSize: 13, fontWeight: '600' },
  pill:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  pillText:  { fontSize: 10, fontWeight: '700' },
  cancelledBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  cancelledTitle: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  cancelledSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});

// ── Payment Card (for parking / garage / residence) ───────────────────────────

const PaymentCard: React.FC<{
  booking: BookingQRData;
  typeColor: string;
  loadingPayment?: boolean;
}> = ({ booking, typeColor, loadingPayment }) => {
  // Resolution order mirrors BookingDetailScreen exactly:
  //   1. Flat fields patched in after fetchParkingBookingDetails resolves
  //      (booking.paymentMethod, booking.paymentStatus, booking.amount)
  //   2. Nested paymentDetails (fallback for any QR that embeds them directly)
  const methodRaw = booking.paymentMethod ?? booking.paymentDetails?.method;
  const statusRaw = booking.paymentStatus ?? booking.paymentDetails?.status;
  const amountVal =
    booking.amount ??
    booking.paymentDetails?.amount ??
    booking.paymentDetails?.totalAmount ??
    booking.totalAmount;

  // Show spinner while the merchant endpoint is being fetched
  if (loadingPayment) {
    return (
      <View style={pmt.card}>
        <View style={pmt.header}>
          <View style={[pmt.headerIconBox, { backgroundColor: typeColor + '18' }]}>
            <Ionicons name="card-outline" size={18} color={typeColor} />
          </View>
          <Text style={pmt.headerTitle}>Payment</Text>
        </View>
        <View style={[pmt.body, { alignItems: 'center', paddingVertical: 20 }]}>
          <ActivityIndicator size="small" color={typeColor} />
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
            Loading payment details…
          </Text>
        </View>
      </View>
    );
  }

  if (!methodRaw && !statusRaw && amountVal == null) return null;

  const { label, icon, color, isPaid, isFailed } = getPaymentConfig(methodRaw, statusRaw);

  const statusLabel = isFailed ? 'Failed'  : isPaid ? 'Paid'    : 'Pending';
  const statusColor = isFailed ? '#EF4444' : isPaid ? '#16A34A' : '#CA8A04';
  const statusBg    = isFailed ? '#FEF2F2' : isPaid ? '#DCFCE7' : '#FEF9C3';
  const statusIcon: any = isFailed ? 'close-circle' : isPaid ? 'checkmark-circle' : 'time-outline';

  return (
    <View style={pmt.card}>
      <View style={pmt.header}>
        <View style={[pmt.headerIconBox, { backgroundColor: typeColor + '18' }]}>
          <Ionicons name="card-outline" size={18} color={typeColor} />
        </View>
        <Text style={pmt.headerTitle}>Payment</Text>
      </View>

      <View style={pmt.body}>
        <View style={pmt.row}>
          <View style={[pmt.methodIconBox, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pmt.methodLabel}>Payment Method</Text>
            <Text style={[pmt.methodValue, { color: methodRaw ? color : '#9CA3AF' }]}>
              {label}
            </Text>
          </View>

          {statusRaw && (
            <View style={[pmt.statusBadge, { backgroundColor: statusBg }]}>
              <Ionicons name={statusIcon} size={13} color={statusColor} />
              <Text style={[pmt.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {amountVal != null && (
          <View style={pmt.amountRow}>
            <Text style={pmt.amountLabel}>Amount Charged</Text>
            <Text style={[pmt.amountValue, { color: typeColor }]}>
              ₹{Number(amountVal).toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const pmt = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  body: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  methodLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 3 },
  methodValue: { fontSize: 16, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  amountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  amountLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  amountValue: { fontSize: 18, fontWeight: '800' },
});

// ── Dry Cleaning Booking Detail Card ─────────────────────────────────────────

const DryCleaningBookingCard: React.FC<{ order: OrderItem }> = ({ order }) => {
  const statusCfg = STATUS_CONFIG[order.status ?? ''] ?? { color: '#9CA3AF', label: order.status ?? 'Unknown', icon: 'help-circle-outline' };
  const allItems = order.orderItems || order.items || [];
  const pricing = order.pricing;
  const dryCleanerAddress = fmtAddress(order.dryCleaner?.address);

  return (
    <View>
      <View style={dc.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={dc.orderNumberLabel}>Order Number</Text>
          <Text style={dc.orderNumber}>{order.orderNumber ?? `#${order._id?.slice(-6).toUpperCase()}`}</Text>
          <Text style={dc.orderDate}>
            Placed on {formatDateShort(order.createdAt)} at {formatTime(order.createdAt)}
          </Text>
        </View>
        <View style={[dc.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
          <Ionicons name={statusCfg.icon as any} size={14} color={statusCfg.color} />
          <Text style={[dc.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {order.user && (
        <View style={dc.sectionCard}>
          <View style={dc.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#FF8C00" />
            <Text style={dc.sectionTitle}>Customer</Text>
          </View>
          <Text style={dc.shopName}>{order.user.firstName} {order.user.lastName}</Text>
          {order.user.phoneNumber && <Text style={dc.contactText}>📞 {order.user.phoneNumber}</Text>}
          {order.user.email && <Text style={dc.contactText}>✉️ {order.user.email}</Text>}
        </View>
      )}

      <View style={dc.sectionCard}>
        <View style={dc.sectionHeader}>
          <Ionicons name="navigate-outline" size={20} color="#FF8C00" />
          <Text style={dc.sectionTitle}>Order Tracking</Text>
        </View>
        <OrderTimeline status={order.status ?? 'pending'} />
      </View>

      {allItems.length > 0 && (
        <View style={dc.sectionCard}>
          <View style={dc.sectionHeader}>
            <Ionicons name="shirt-outline" size={20} color="#FF8C00" />
            <Text style={dc.sectionTitle}>Items ({allItems.length})</Text>
          </View>
          {allItems.map((item: any, index: number) => {
            const itemName  = item.name || item.itemName || `Item ${index + 1}`;
            const itemQty   = item.quantity || item.count || 1;
            const itemPrice = parseFloat(item.price || item.totalPrice || item.cost || 0);
            return (
              <View key={item._id || index} style={[dc.itemRow, index < allItems.length - 1 && dc.itemRowBorder]}>
                <View style={dc.itemIconContainer}>
                  <Ionicons name="shirt-outline" size={20} color="#FF8C00" />
                </View>
                <View style={dc.itemDetails}>
                  <Text style={dc.itemName}>{itemName}</Text>
                  {item.category && <Text style={dc.itemSub}>{item.category}</Text>}
                  <Text style={dc.itemQty}>×{itemQty}</Text>
                </View>
                <Text style={dc.itemPrice}>₹{itemPrice.toFixed(2)}</Text>
              </View>
            );
          })}

          {pricing && (
            <>
              <View style={dc.divider} />
              {pricing.subtotal != null && (
                <View style={dc.priceRow}><Text style={dc.priceLabel}>Subtotal</Text><Text style={dc.priceVal}>₹{pricing.subtotal.toFixed(2)}</Text></View>
              )}
              {pricing.serviceFees != null && (
                <View style={dc.priceRow}><Text style={dc.priceLabel}>Service Fee</Text><Text style={dc.priceVal}>₹{pricing.serviceFees.toFixed(2)}</Text></View>
              )}
              {pricing.deliveryCharge != null && (
                <View style={dc.priceRow}><Text style={dc.priceLabel}>Delivery</Text><Text style={dc.priceVal}>₹{pricing.deliveryCharge.toFixed(2)}</Text></View>
              )}
              <View style={dc.divider} />
              <View style={dc.totalRow}>
                <Text style={dc.totalLabel}>Total Amount</Text>
                <Text style={dc.totalAmount}>₹{(pricing.totalAmount ?? order.totalAmount ?? 0).toFixed(2)}</Text>
              </View>
            </>
          )}

          {!pricing && (
            <View style={dc.totalRow}>
              <Text style={dc.totalLabel}>Total Amount</Text>
              <Text style={dc.totalAmount}>₹{Number(order.totalAmount ?? 0).toFixed(2)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={dc.sectionCard}>
        <View style={dc.sectionHeader}>
          <Ionicons name="location-outline" size={20} color="#FF8C00" />
          <Text style={dc.sectionTitle}>Pickup & Delivery</Text>
        </View>
        <View style={dc.addrRow}>
          <View style={[dc.addrDot, { backgroundColor: '#3B82F6' }]} />
          <View style={{ flex: 1 }}>
            <Text style={dc.addrLabel}>Pickup Address</Text>
            <Text style={dc.addrValue}>{order.pickupAddress || 'N/A'}</Text>
          </View>
        </View>
        <View style={dc.addrLine} />
        <View style={dc.addrRow}>
          <View style={[dc.addrDot, { backgroundColor: '#F97316' }]} />
          <View style={{ flex: 1 }}>
            <Text style={dc.addrLabel}>Drop-off / Delivery</Text>
            <Text style={dc.addrValue}>{order.dropoffAddress || order.deliveryAddress || 'N/A'}</Text>
          </View>
        </View>
        {order.dryCleaner && (
          <>
            <View style={dc.addrLine} />
            <View style={dc.addrRow}>
              <View style={[dc.addrDot, { backgroundColor: '#10B981' }]} />
              <View style={{ flex: 1 }}>
                <Text style={dc.addrLabel}>Dry Cleaner Shop</Text>
                <Text style={dc.addrValue}>{dryCleanerAddress}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {(order.scheduledPickupDateTime || order.pickupTime || order.scheduledDeliveryDateTime || order.deliveryTime) && (
        <View style={dc.sectionCard}>
          <View style={dc.sectionHeader}>
            <Ionicons name="time-outline" size={20} color="#FF8C00" />
            <Text style={dc.sectionTitle}>Schedule</Text>
          </View>
          {(order.scheduledPickupDateTime || order.pickupTime) && (
            <View style={dc.scheduleRow}>
              <View style={dc.scheduleIconBox}>
                <Ionicons name="log-in-outline" size={16} color="#3B82F6" />
              </View>
              <View>
                <Text style={dc.scheduleLabel}>Pickup</Text>
                <Text style={dc.scheduleValue}>{formatDateTime(order.scheduledPickupDateTime || order.pickupTime)}</Text>
              </View>
            </View>
          )}
          {(order.scheduledDeliveryDateTime || order.deliveryTime) && (
            <View style={[dc.scheduleRow, { marginTop: 10 }]}>
              <View style={[dc.scheduleIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="log-out-outline" size={16} color="#F97316" />
              </View>
              <View>
                <Text style={dc.scheduleLabel}>Delivery</Text>
                <Text style={dc.scheduleValue}>{formatDateTime(order.scheduledDeliveryDateTime || order.deliveryTime)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {order.dryCleaner && (
        <View style={dc.sectionCard}>
          <View style={dc.sectionHeader}>
            <Ionicons name="storefront-outline" size={20} color="#FF8C00" />
            <Text style={dc.sectionTitle}>Dry Cleaner</Text>
          </View>
          <Text style={dc.shopName}>{order.dryCleaner.shopname}</Text>
          {order.dryCleaner.phoneNumber && <Text style={dc.contactText}>📞 {order.dryCleaner.phoneNumber}</Text>}
          {order.dryCleaner.address && <Text style={dc.contactText}>📍 {dryCleanerAddress}</Text>}
        </View>
      )}

      {order.driver && (
        <View style={dc.sectionCard}>
          <View style={dc.sectionHeader}>
            <Ionicons name="car-outline" size={20} color="#FF8C00" />
            <Text style={dc.sectionTitle}>Driver</Text>
          </View>
          <Text style={dc.shopName}>{order.driver.firstName} {order.driver.lastName}</Text>
          {order.driver.phoneNumber && <Text style={dc.contactText}>📞 {order.driver.phoneNumber}</Text>}
        </View>
      )}

      {(order.specialInstructions || order.notes) && (
        <View style={dc.sectionCard}>
          <View style={dc.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#FF8C00" />
            <Text style={dc.sectionTitle}>Special Instructions</Text>
          </View>
          <Text style={dc.instructionsText}>{order.specialInstructions || order.notes}</Text>
        </View>
      )}

      <View style={dc.sectionCard}>
        <View style={dc.sectionHeader}>
          <Ionicons name="card-outline" size={20} color="#FF8C00" />
          <Text style={dc.sectionTitle}>Payment</Text>
        </View>
        <View style={dc.priceRow}>
          <Text style={dc.priceLabel}>Method</Text>
          <Text style={dc.priceVal}>{order.paymentMethod || 'Cash on Delivery'}</Text>
        </View>
        <View style={dc.priceRow}>
          <Text style={dc.priceLabel}>Status</Text>
          <Text style={[dc.priceVal, { color: order.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' }]}>
            {order.paymentStatus === 'paid' ? 'Paid ✓' : 'Pending'}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ── Dry Cleaner order detail card ─────────────────────────────────────────────

const DryCleanerOrderDetailCard = ({
  order, onClose,
}: {
  order: OrderItem;
  onClose: () => void;
}) => {
  const [cancelling, setCancelling] = useState(false);
  const { token, user } = useSelector((state: RootState) => state.auth);
  const authToken = token || user?.token;
  const canCancel = order.status === 'pending' || order.status === 'accepted';

  const handleCancelOrder = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        try {
          setCancelling(true);
          const response = await axiosInstance.patch(
            `/users/bookings/${order._id}/cancel`, {},
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          if (response.data.success) {
            Alert.alert('Success', 'Order cancelled successfully', [{ text: 'OK', onPress: onClose }]);
          }
        } catch {
          Alert.alert('Error', 'Failed to cancel order. Please try again.');
        } finally {
          setCancelling(false);
        }
      }},
    ]);
  };

  return (
    <View>
      <TouchableOpacity style={dc.backRow} onPress={onClose}>
        <Ionicons name="arrow-back" size={18} color="#FF8C00" />
        <Text style={dc.backText}>Back to Orders</Text>
      </TouchableOpacity>
      <DryCleaningBookingCard order={order} />
      {canCancel && (
        <TouchableOpacity style={dc.cancelBtn} onPress={handleCancelOrder} disabled={cancelling}>
          {cancelling
            ? <ActivityIndicator size="small" color="#FFF" />
            : <><Ionicons name="close-circle-outline" size={20} color="#FFF" /><Text style={dc.cancelBtnText}>Cancel Order</Text></>
          }
        </TouchableOpacity>
      )}
      <View style={{ height: 10 }} />
    </View>
  );
};

// ── Orders Section ────────────────────────────────────────────────────────────

const OrdersSection = ({
  orders, loading, error, selectedOrder, onSelectOrder,
}: {
  orders: OrderItem[];
  loading: boolean;
  error: string | null;
  selectedOrder: OrderItem | null;
  onSelectOrder: (order: OrderItem | null) => void;
}) => {
  if (selectedOrder) {
    return <DryCleanerOrderDetailCard order={selectedOrder} onClose={() => onSelectOrder(null)} />;
  }

  return (
    <View style={styles.ordersSection}>
      <View style={styles.ordersSectionHeader}>
        <View style={styles.ordersSectionIconBox}>
          <Ionicons name="receipt-outline" size={18} color="#5C6BC0" />
        </View>
        <Text style={styles.ordersSectionTitle}>Orders at this Shop</Text>
        {!loading && orders.length > 0 && (
          <View style={styles.orderCountBadge}>
            <Text style={styles.orderCountText}>{orders.length}</Text>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.ordersCenter}>
          <ActivityIndicator size="small" color="#5C6BC0" />
          <Text style={styles.ordersLoadingText}>Fetching orders…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.ordersCenter}>
          <Ionicons name="alert-circle-outline" size={32} color="#ccc" />
          <Text style={styles.ordersEmptyText}>{error}</Text>
        </View>
      )}

      {!loading && !error && orders.map((order) => (
        <TouchableOpacity
          key={order._id}
          style={styles.orderCard}
          activeOpacity={0.75}
          onPress={() => onSelectOrder(order)}
        >
          <View style={styles.orderCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderCardId}>{order.orderNumber || `#${order._id?.slice(-8)}`}</Text>
              <Text style={styles.orderCardDate}>{formatDateShort(order.createdAt)}</Text>
            </View>
            <View>
              <View style={[styles.orderStatusPill, { backgroundColor: (STATUS_CONFIG[order.status ?? '']?.color ?? '#888') + '18' }]}>
                <View style={[styles.orderStatusDot, { backgroundColor: STATUS_CONFIG[order.status ?? '']?.color ?? '#888' }]} />
                <Text style={[styles.orderStatusText, { color: STATUS_CONFIG[order.status ?? '']?.color ?? '#888' }]}>
                  {STATUS_CONFIG[order.status ?? '']?.label ?? order.status}
                </Text>
              </View>
              {order.totalAmount != null && (
                <Text style={styles.orderCardAmount}>₹{Number(order.totalAmount).toFixed(2)}</Text>
              )}
            </View>
          </View>
          {order.pickupAddress && (
            <View style={styles.orderAddressRow}>
              <Ionicons name="location-outline" size={13} color="#888" />
              <Text style={styles.orderAddressText} numberOfLines={1}>{order.pickupAddress}</Text>
            </View>
          )}
          <View style={styles.orderCardFooter}>
            <Text style={styles.viewDetailsText}>Tap to view full details</Text>
            <Ionicons name="chevron-forward" size={14} color="#5C6BC0" />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ── Dry Cleaner Info Card ─────────────────────────────────────────────────────

const DryCleanerCard = ({ dryCleaner, standalone = false }: { dryCleaner: DryCleanerQRData; standalone?: boolean }) => (
  <View style={styles.dryCleanerCard}>
    <View style={styles.dryCleanerHeader}>
      <View style={styles.dryCleanerIconBox}><Ionicons name="storefront" size={24} color="#FF8C00" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.dryCleanerTitle}>{standalone ? 'Dry Cleaner' : 'Dry Cleaner Details'}</Text>
        {standalone && dryCleaner.dryCleanerId && (
          <Text style={styles.dryCleanerSubtitle} numberOfLines={1}>ID: {dryCleaner.dryCleanerId}</Text>
        )}
      </View>
      {standalone && <View style={styles.shopBadge}><Text style={styles.shopBadgeText}>Shop QR</Text></View>}
    </View>
    {dryCleaner.shopname && <DryCleanerRow icon="business-outline" iconBg="#FFF3E0" iconColor="#FF8C00" label="Shop Name" value={dryCleaner.shopname} />}
    {dryCleaner.phoneNumber && <DryCleanerRow icon="call-outline" iconBg="#E8F5E9" iconColor="#4CAF50" label="Phone" value={dryCleaner.phoneNumber} />}
    {dryCleaner.email && <DryCleanerRow icon="mail-outline" iconBg="#E3F2FD" iconColor="#2196F3" label="Email" value={dryCleaner.email} />}
    {dryCleaner.address && <DryCleanerRow icon="location-outline" iconBg="#FCE4EC" iconColor="#E91E63" label="Address" value={dryCleaner.address} />}
    {dryCleaner.openingHours && <DryCleanerRow icon="time-outline" iconBg="#EDE7F6" iconColor="#7E57C2" label="Opening Hours" value={dryCleaner.openingHours} />}
    {dryCleaner.rating != null && (
      <View style={styles.dryCleanerRow}>
        <View style={[styles.dryCleanerRowIcon, { backgroundColor: '#FFFDE7' }]}>
          <Ionicons name="star-outline" size={16} color="#FFC107" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dryCleanerRowLabel}>Rating</Text>
          <View style={styles.starsRow}>
            {renderStars(dryCleaner.rating)}
            <Text style={styles.ratingText}>{dryCleaner.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    )}
    {dryCleaner.services && dryCleaner.services.length > 0 && (
      <View style={[styles.dryCleanerRow, { alignItems: 'flex-start' }]}>
        <View style={[styles.dryCleanerRowIcon, { backgroundColor: '#E0F7FA' }]}>
          <Ionicons name="list-outline" size={16} color="#00BCD4" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dryCleanerRowLabel}>Services</Text>
          <View style={styles.servicesWrap}>
            {dryCleaner.services.map((s, i) => (
              <View key={i} style={styles.serviceTag}><Text style={styles.serviceTagText}>{s}</Text></View>
            ))}
          </View>
        </View>
      </View>
    )}
  </View>
);

const DryCleanerRow = ({ icon, iconBg, iconColor, label, value }: { icon: any; iconBg: string; iconColor: string; label: string; value: string }) => (
  <View style={styles.dryCleanerRow}>
    <View style={[styles.dryCleanerRowIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={16} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.dryCleanerRowLabel}>{label}</Text>
      <Text style={styles.dryCleanerRowValue}>{value}</Text>
    </View>
  </View>
);

const InfoCard = ({ icon, label, value, color, large = false }: { icon: any; label: string; value: string; color: string; large?: boolean }) => (
  <View style={[styles.infoCard, large && styles.infoCardLarge]}>
    <View style={[styles.infoIconBox, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
  </View>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function UniversalScanner() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [rawData, setRawData] = useState('');
  const [parsedBooking, setParsedBooking] = useState<BookingQRData | null>(null);
  const [parsedDryCleaner, setParsedDryCleaner] = useState<DryCleanerQRData | null>(null);
  const [scanState, setScanState] = useState<ScanState>('scanning');

  const [dryCleaningOrder, setDryCleaningOrder] = useState<OrderItem | null>(null);
  const [dryCleaningLoading, setDryCleaningLoading] = useState(false);
  const [dryCleaningError, setDryCleaningError] = useState<string | null>(null);

  const [dcOrders, setDcOrders] = useState<OrderItem[]>([]);
  const [dcOrdersLoading, setDcOrdersLoading] = useState(false);
  const [dcOrdersError, setDcOrdersError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Payment loading state for parking / garage / residence
  const [paymentLoading, setPaymentLoading] = useState(false);

  const router = useRouter();
  const { user, token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // ── Fetch payment details for parking / garage / residence ──────────────────
  //
  // The booking-detail endpoints (garageBookingInfo, getLotBookingById,
  // residenceBookingInfo) are ownership-gated — they return 403 when the
  // logged-in user is NOT the customer or the merchant who owns the spot.
  //
  // Solution:
  //   Garage    → use scanBookingQRCode  (merchants/api/garage-booking/scan/:id)
  //               This endpoint has NO ownership check — it is specifically
  //               designed for QR scanning by any authenticated user.
  //
  //   Parking Lot / Residence → the booking-detail endpoints DO allow the
  //               customer to access their own booking, so those work fine
  //               when the logged-in user is the one who booked.
  //               We fall back to the scan endpoint for garage if the typed
  //               endpoint fails.
  //
  // axiosInstance auto-attaches the Bearer token — no manual header needed.
  const fetchParkingBookingDetails = async (bookingId: string, bookingType?: string) => {
    if (!bookingId) return;
    setPaymentLoading(true);

    const t = (bookingType ?? '').toUpperCase().trim();

    // Ordered list of URLs to try — most permissive first for each type
    type Candidate = { url: string };
    let candidates: Candidate[] = [];

    if (t === 'G' || t === 'GARAGE') {
      candidates = [
        // ✅ No ownership check — designed for QR scanning
        { url: `merchants/api/garage-booking/scan/${bookingId}` },
        // Fallback if user happens to be the customer
        { url: `merchants/garage/booking/${bookingId}` },
      ];
    } else if (t === 'L' || t === 'PARKING' || t === 'PARKING LOT') {
      candidates = [
        { url: `merchants/parkinglot/booking/${bookingId}` },
      ];
    } else if (t === 'R' || t === 'RESIDENCE') {
      candidates = [
        { url: `merchants/residence/booking/${bookingId}` },
      ];
    } else {
      // Unknown type — try all, scan endpoint first (no auth restriction)
      candidates = [
        { url: `merchants/api/garage-booking/scan/${bookingId}` },
        { url: `merchants/garage/booking/${bookingId}` },
        { url: `merchants/parkinglot/booking/${bookingId}` },
        { url: `merchants/residence/booking/${bookingId}` },
      ];
    }

    try {
      for (const candidate of candidates) {
        try {
          // axiosInstance interceptor attaches Bearer token from AsyncStorage
          const response = await axiosInstance.get(candidate.url, { timeout: 10000 });
          const data = response.data?.data || response.data;
          if (!data) continue;

          // All endpoints return: { paymentDetails: { method, status, totalAmount, amountPaid } }
          const pd = data.paymentDetails;
          if (!pd) continue;

          const method = pd.method;
          const status = pd.status;
          const amount =
            pd.totalAmount ??
            pd.amountPaid  ??
            data.totalAmount ??
            data.amountToPaid ??
            null;

          if (!method && !status) continue;

          setParsedBooking(prev =>
            prev
              ? { ...prev, paymentMethod: method, paymentStatus: status, amount: amount ?? prev.amount }
              : prev
          );
          return; // success
        } catch {
          continue; // 403/404 → try next candidate
        }
      }
      // All failed — payment card stays hidden, rest of QR data still shows
    } finally {
      setPaymentLoading(false);
    }
  };

  const fetchDryCleaningBookingDetails = async (bookingId: string) => {
    const authToken = token || user?.token;
    if (!authToken) { setDryCleaningError('Authentication required. Please log in.'); return; }
    setDryCleaningLoading(true);
    setDryCleaningError(null);
    try {
      const response = await axiosInstance.get(`/users/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      const data = response.data?.data || response.data;
      if (!data) throw new Error('No booking data received');
      const order: OrderItem = {
        _id: data._id,
        orderNumber: data.orderNumber || `#${data._id?.slice(-6).toUpperCase()}`,
        status: data.status,
        createdAt: data.createdAt,
        orderItems: data.orderItems || data.items || [],
        items: data.orderItems || data.items || [],
        totalAmount: data.pricing?.totalAmount ?? data.totalAmount ?? 0,
        pricing: data.pricing,
        pickupAddress: typeof data.pickupAddress === 'string' ? data.pickupAddress : 'N/A',
        dropoffAddress: typeof data.dropoffAddress === 'string' ? data.dropoffAddress : 'N/A',
        scheduledPickupDateTime: data.scheduledPickupDateTime,
        scheduledDeliveryDateTime: data.scheduledDeliveryDateTime,
        dryCleaner: data.dryCleaner,
        driver: data.driver,
        user: data.user,
        paymentMethod: data.paymentMethod || 'Cash on Delivery',
        paymentStatus: data.paymentStatus || 'pending',
        specialInstructions: data.specialInstructions || data.notes,
      };
      setDryCleaningOrder(order);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) setDryCleaningError('Booking not found.');
      else if (status === 401 || status === 403) setDryCleaningError('You are not authorized to view this booking.');
      else setDryCleaningError('Failed to load booking details. Please try again.');
    } finally {
      setDryCleaningLoading(false);
    }
  };

  const fetchDryCleanerOrders = async (dryCleanerId: string) => {
    const authToken = token || user?.token;
    if (!authToken) return;
    setDcOrdersLoading(true);
    setDcOrdersError(null);
    try {
      const response = await axiosInstance.get('users/my-bookings', {
        params: { dryCleanerId },
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 15000,
      });
      const raw = response.data?.data || response.data;
      const list = Array.isArray(raw) ? raw : raw?.bookings || [];
      if (list.length > 0) {
        setDcOrders(list.map((b: any) => ({
          _id: b._id,
          orderNumber: b.orderNumber || `#DRYCL${b._id?.slice(-6)}`,
          status: b.status,
          createdAt: b.createdAt,
          items: b.orderItems || b.items || [],
          orderItems: b.orderItems || b.items || [],
          totalAmount: b.pricing?.totalAmount ?? b.totalAmount ?? 0,
          pricing: b.pricing,
          pickupAddress: typeof b.pickupAddress === 'string' ? b.pickupAddress : 'N/A',
          deliveryAddress: typeof b.dropoffAddress === 'string' ? b.dropoffAddress : typeof b.deliveryAddress === 'string' ? b.deliveryAddress : 'N/A',
          dropoffAddress: typeof b.dropoffAddress === 'string' ? b.dropoffAddress : 'N/A',
          pickupTime: b.scheduledPickupDateTime || 'N/A',
          deliveryTime: b.scheduledDeliveryDateTime || 'N/A',
          scheduledPickupDateTime: b.scheduledPickupDateTime,
          scheduledDeliveryDateTime: b.scheduledDeliveryDateTime,
          dryCleaner: b.dryCleaner,
          driver: b.driver,
          user: b.user,
          paymentMethod: b.paymentMethod || 'Cash on Delivery',
          paymentStatus: b.paymentStatus || 'pending',
          specialInstructions: b.specialInstructions || b.notes,
        })));
      } else {
        setDcOrders([]);
        setDcOrdersError('No orders found for this dry cleaner.');
      }
    } catch (err: any) {
      setDcOrdersError(
        err?.response?.status === 404
          ? 'No orders found for this dry cleaner.'
          : 'Failed to load orders. Please try again.'
      );
      setDcOrders([]);
    } finally {
      setDcOrdersLoading(false);
    }
  };

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setRawData(data);
    try {
      const parsed = JSON.parse(data);
      if (parsed.bookingId && (parsed.user || parsed.status || parsed.pickupAddress)) {
        setParsedBooking(parsed as BookingQRData);
        setScanState('dryCleaningBooking');
        fetchDryCleaningBookingDetails(parsed.bookingId);
        return;
      }
      if (parsed.dryCleanerId || (parsed.shopname && !parsed.bookingId)) {
        setParsedDryCleaner(parsed as DryCleanerQRData);
        setScanState('dryCleaner');
        if (parsed.dryCleanerId) fetchDryCleanerOrders(parsed.dryCleanerId);
        return;
      }
      if (parsed.type || parsed.vehicleNumber || parsed.slot) {
        setParsedBooking(parsed as BookingQRData);
        if (parsed.dryCleaner) {
          setParsedDryCleaner(parsed.dryCleaner as DryCleanerQRData);
          if (parsed.dryCleaner.dryCleanerId) fetchDryCleanerOrders(parsed.dryCleaner.dryCleanerId);
        }
        setScanState('parsed');
        // ── Fetch real payment details from merchant endpoint ──
        // QR only contains booking metadata; paymentMethod lives on the full booking record
        if (parsed.bookingId) {
          fetchParkingBookingDetails(parsed.bookingId, parsed.type);
        }
        return;
      }
      setScanState('raw');
    } catch {
      setScanState('raw');
    }
  };

  const handleReset = () => {
    setScanned(false);
    setRawData('');
    setParsedBooking(null);
    setParsedDryCleaner(null);
    setScanState('scanning');
    setDryCleaningOrder(null);
    setDryCleaningError(null);
    setDryCleaningLoading(false);
    setDcOrders([]);
    setDcOrdersError(null);
    setSelectedOrder(null);
    setPaymentLoading(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permText}>Requesting camera permission…</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off-outline" size={56} color="#ccc" />
        <Text style={styles.permText}>No camera access</Text>
        <Text style={styles.permSub}>Please enable camera in device settings</Text>
      </View>
    );
  }

  const typeColor = getTypeColor(parsedBooking?.type);

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        style={styles.camera}
      />

      {!scanned && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBack} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.frameWrapper}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanHint}>Point at a booking or shop QR code</Text>
          </View>
        </View>
      )}

      {scanned && (
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* ── ① Dry Cleaning Booking QR ── */}
            {scanState === 'dryCleaningBooking' && (
              <>
                {dryCleaningLoading && (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#FF8C00" />
                    <Text style={styles.loadingText}>Loading order details…</Text>
                  </View>
                )}
                {!dryCleaningLoading && dryCleaningError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
                    <Text style={styles.errorText}>{dryCleaningError}</Text>
                    {parsedBooking && (
                      <View style={styles.partialInfo}>
                        <Text style={styles.partialLabel}>Booking ID</Text>
                        <Text style={styles.partialValue}>{parsedBooking.bookingId}</Text>
                        {parsedBooking.status && (
                          <>
                            <Text style={styles.partialLabel}>Status</Text>
                            <Text style={[styles.partialValue, { color: STATUS_CONFIG[parsedBooking.status]?.color ?? '#888' }]}>
                              {STATUS_CONFIG[parsedBooking.status]?.label ?? parsedBooking.status}
                            </Text>
                          </>
                        )}
                        {parsedBooking.user && (
                          <>
                            <Text style={styles.partialLabel}>Customer</Text>
                            <Text style={styles.partialValue}>{parsedBooking.user.firstName} {parsedBooking.user.lastName}</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                )}
                {!dryCleaningLoading && !dryCleaningError && dryCleaningOrder && (
                  <DryCleaningBookingCard order={dryCleaningOrder} />
                )}
              </>
            )}

            {/* ── ② Parking / Garage / Residence Booking ── */}
            {scanState === 'parsed' && (
              <>
                <View style={[styles.sheetHeader, { borderLeftColor: typeColor }]}>
                  <View style={[styles.typeIconBox, { backgroundColor: `${typeColor}18` }]}>
                    <Ionicons name={getTypeIcon(parsedBooking?.type)} size={26} color={typeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{parsedBooking?.type || 'Booking'} QR</Text>
                    <Text style={styles.sheetSubtitle} numberOfLines={1}>ID: {parsedBooking?.bookingId}</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <InfoCard icon="car-outline"      label="Vehicle Number" value={parsedBooking?.vehicleNumber || 'N/A'} color={typeColor} large />
                  <InfoCard icon="location-outline" label="Location"       value={parsedBooking?.location     || 'N/A'} color={typeColor} large />
                  {parsedBooking?.slot && (
                    <InfoCard icon="apps-outline" label="Slot" value={parsedBooking.slot} color={typeColor} />
                  )}
                  <InfoCard
                    icon="cash-outline"
                    label="Amount"
                    value={parsedBooking?.amount != null ? `₹${Number(parsedBooking.amount).toFixed(2)}` : 'N/A'}
                    color={typeColor}
                  />
                </View>

                {(parsedBooking?.from || parsedBooking?.to) && (
                  <View style={styles.periodCard}>
                    <Text style={styles.periodTitle}>Booking Period</Text>
                    <View style={styles.periodRow}>
                      <View style={styles.periodItem}>
                        <Ionicons name="log-in-outline" size={20} color={typeColor} />
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.periodLabel}>Check-in</Text>
                          <Text style={styles.periodValue}>{formatDateTime(parsedBooking?.from)}</Text>
                        </View>
                      </View>
                      <View style={styles.periodItem}>
                        <Ionicons name="log-out-outline" size={20} color="#FF8C00" />
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.periodLabel}>Check-out</Text>
                          <Text style={styles.periodValue}>{formatDateTime(parsedBooking?.to)}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.durationPill}>
                      <Ionicons name="time-outline" size={14} color={typeColor} />
                      <Text style={[styles.durationText, { color: typeColor }]}>
                        Duration: {calculateDuration(parsedBooking?.from, parsedBooking?.to)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ── Payment card ── */}
                <PaymentCard
                  booking={parsedBooking ?? {}}
                  typeColor={typeColor}
                  loadingPayment={paymentLoading}
                />

                {parsedDryCleaner && (
                  <>
                    <DryCleanerCard dryCleaner={parsedDryCleaner} />
                    <OrdersSection orders={dcOrders} loading={dcOrdersLoading} error={dcOrdersError} selectedOrder={selectedOrder} onSelectOrder={setSelectedOrder} />
                  </>
                )}
              </>
            )}

            {/* ── ③ Standalone Dry Cleaner Shop QR ── */}
            {scanState === 'dryCleaner' && parsedDryCleaner && (
              <>
                <DryCleanerCard dryCleaner={parsedDryCleaner} standalone />
                <OrdersSection orders={dcOrders} loading={dcOrdersLoading} error={dcOrdersError} selectedOrder={selectedOrder} onSelectOrder={setSelectedOrder} />
              </>
            )}

            {/* ── ④ Raw / Unknown QR ── */}
            {scanState === 'raw' && (
              <View style={styles.rawCard}>
                <View style={styles.rawHeader}>
                  <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
                  <Text style={styles.rawTitle}>Scan Result</Text>
                </View>
                <View style={styles.rawBadge}><Text style={styles.rawBadgeText}>Non-booking QR</Text></View>
                <Text style={styles.rawLabel}>Scanned Data</Text>
                <Text style={styles.rawValue}>{rawData}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.scanAgainBtn} onPress={handleReset}>
                <Ionicons name="refresh" size={18} color="#FFF" />
                <Text style={styles.scanAgainText}>Scan Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Dry Cleaning Card Styles ──────────────────────────────────────────────────

const dc = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 4 },
  backText: { color: '#FF8C00', fontSize: 14, fontWeight: '600' },
  headerCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF', borderRadius: 14, padding: 18, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  orderNumberLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 3 },
  orderNumber: { fontSize: 20, fontWeight: '800', color: '#111' },
  orderDate: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginLeft: 10, marginTop: 2,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  sectionCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemIconContainer: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FF8C0018', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111' },
  itemSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  itemQty: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#111' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  priceLabel: { fontSize: 13, color: '#6B7280' },
  priceVal: { fontSize: 13, fontWeight: '600', color: '#111' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: '#FF8C00' },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  addrDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 10 },
  addrLine: { width: 2, height: 20, backgroundColor: '#E5E7EB', marginLeft: 5, marginVertical: 2 },
  addrLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  addrValue: { fontSize: 13, color: '#111', lineHeight: 19 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  scheduleLabel: { fontSize: 11, color: '#9CA3AF' },
  scheduleValue: { fontSize: 13, fontWeight: '600', color: '#111', marginTop: 2 },
  shopName: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 6 },
  contactText: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  instructionsText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  cancelBtn: {
    backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 4, marginBottom: 10,
  },
  cancelBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});

// ── Main Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  permText: { marginTop: 16, fontSize: 16, color: '#333', fontWeight: '600' },
  permSub: { marginTop: 6, fontSize: 13, color: '#888' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlayBack: {
    margin: 16, marginTop: 50, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  frameWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 80 },
  frame: { width: 240, height: 240, justifyContent: 'space-between' },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#FFF', borderWidth: 3 },
  topLeft:    { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  topRight:   { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  bottomRight:{ bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: {
    marginTop: 24, color: '#FFF', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  sheet: {
    position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#F4F6FA',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%',
  },
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },
  errorBox: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingHorizontal: 10 },
  partialInfo: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  partialLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 8 },
  partialValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 14, padding: 14, marginBottom: 14, borderLeftWidth: 4,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  typeIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111', textTransform: 'capitalize' },
  sheetSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  infoCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 12, width: '47%',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  infoCardLarge: { width: '100%' },
  infoIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  infoLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '500' },
  infoValue: { fontSize: 15, color: '#111', fontWeight: '700' },
  periodCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  periodTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 },
  periodRow: { gap: 12 },
  periodItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  periodLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  periodValue: { fontSize: 13, color: '#111', fontWeight: '600' },
  durationPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 10, backgroundColor: '#F0F4FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 5,
  },
  durationText: { fontSize: 13, fontWeight: '600' },
  dryCleanerCard: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  dryCleanerHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F0',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FFE0B2',
  },
  dryCleanerIconBox: {
    width: 44, height: 44, borderRadius: 11, backgroundColor: '#FF8C001A',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  dryCleanerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  dryCleanerSubtitle: { fontSize: 11, color: '#888', marginTop: 1 },
  shopBadge: { backgroundColor: '#FF8C001A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  shopBadgeText: { fontSize: 11, color: '#FF8C00', fontWeight: '700' },
  dryCleanerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  dryCleanerRowIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  dryCleanerRowLabel: { fontSize: 11, color: '#999', fontWeight: '500', marginBottom: 2 },
  dryCleanerRowValue: { fontSize: 14, color: '#111', fontWeight: '600' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  ratingText: { fontSize: 13, color: '#555', fontWeight: '600', marginLeft: 4 },
  servicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  serviceTag: { backgroundColor: '#E0F7FA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  serviceTagText: { fontSize: 12, color: '#00838F', fontWeight: '600' },
  ordersSection: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  ordersSectionHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEFFE',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D5D9F7',
  },
  ordersSectionIconBox: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: '#5C6BC01A',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  ordersSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A237E', flex: 1 },
  orderCountBadge: {
    backgroundColor: '#5C6BC0', width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  orderCountText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  ordersCenter: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  ordersLoadingText: { fontSize: 13, color: '#888', marginTop: 6 },
  ordersEmptyText: { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 20 },
  orderCard: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderCardId: { fontSize: 14, fontWeight: '700', color: '#111' },
  orderCardDate: { fontSize: 11, color: '#999', marginTop: 2 },
  orderStatusPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, alignSelf: 'flex-end', marginBottom: 4,
  },
  orderStatusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  orderStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  orderCardAmount: { fontSize: 14, fontWeight: '700', color: '#FF8C00', textAlign: 'right' },
  orderAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  orderAddressText: { fontSize: 12, color: '#666', flex: 1 },
  orderCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 3 },
  viewDetailsText: { fontSize: 12, color: '#5C6BC0', fontWeight: '600' },
  rawCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 14 },
  rawHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rawTitle: { fontSize: 17, fontWeight: '700', marginLeft: 8 },
  rawBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EAF2FF',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10,
  },
  rawBadgeText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  rawLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  rawValue: { fontSize: 13, color: '#222', lineHeight: 22 },
  actions: { gap: 10, marginBottom: 10 },
  scanAgainBtn: {
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  scanAgainText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  backBtn: { alignItems: 'center', paddingVertical: 10 },
  backText: { color: '#555', fontSize: 14 },
});