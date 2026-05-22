import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { clearOrderAfterPlacement } from '../../components/redux/userSlice';
import axiosInstance from '../../api/axios';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the effective per-unit price for an item (base + selected add-ons). */
const resolveEffectivePrice = (item: any): number => {
  if (typeof item.effectivePrice === 'number' && item.effectivePrice > 0) {
    return item.effectivePrice;
  }
  const base = parseFloat(String(item.price || 0));
  const addOns = (item.additionalservice || [])
    .filter((s: any) =>
      (item.selectedAdditionals || item.options?.selectedAdditionals || []).includes(s.name),
    )
    .reduce((sum: number, s: any) => sum + (s.price || 0), 0);
  return base + addOns;
};

/** Formats a starch level string (low/medium/high or numeric) into a readable label. */
const formatStarch = (level: string | number | undefined): string => {
  if (!level) return 'Low';
  if (typeof level === 'string') return level.charAt(0).toUpperCase() + level.slice(1);
  const map: Record<number, string> = { 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'High' };
  return map[level as number] || 'Medium';
};

/** Formats an address object or string. */
const formatAddress = (address: any): string => {
  if (!address) return 'Not specified';
  if (typeof address === 'string') return address.trim() || 'Not specified';
  if (address.fullAddress) return address.fullAddress.trim() || 'Not specified';
  const parts = [address.street, address.city, address.state, address.country].filter(Boolean);
  return parts.join(', ') || 'Not specified';
};

/** Formats an ISO datetime string or scheduling fields into a readable line. */
const formatScheduleSlot = (
  isoDate: string | undefined,
  fallbackDate: string | undefined,
  fallbackMonth: string | undefined,
  fallbackTime: string | undefined,
): string => {
  if (isoDate) {
    return new Date(isoDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (fallbackDate && fallbackMonth && fallbackTime)
    return `${fallbackDate} ${fallbackMonth} at ${fallbackTime}`;
  return 'Not specified';
};

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = () => <View style={styles.divider} />;

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = ({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text
      style={[
        styles.detailValue,
        accent && styles.detailValueAccent,
        bold && styles.detailValueBold,
      ]}
    >
      {value}
    </Text>
  </View>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrderReceiptPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();
  const viewShotRef = useRef<ViewShot>(null);

  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const orderId     = params.orderId     as string;
  const orderNumber = params.orderNumber as string;
  const trackingId  = params.trackingId  as string;
  const totalAmount = params.totalAmount ? parseFloat(params.totalAmount as string) : 0;

  const passedOrderData = useMemo(() => {
    try {
      return params.orderData ? JSON.parse(params.orderData as string) : null;
    } catch {
      return null;
    }
  }, [params.orderData]);

  const fetchOrderReceipt = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (passedOrderData && orderNumber) {
        setOrderData({
          _id:        orderId,
          orderNumber,
          trackingId,
          totalAmount,
          items:      passedOrderData.items      || [],
          cleaner:    passedOrderData.cleaner,
          addresses:  passedOrderData.addresses,
          scheduling: passedOrderData.scheduling,
          createdAt:  new Date().toISOString(),
        });
        setLoading(false);
        return;
      }

      if (!orderId) throw new Error('No order ID or order data available');

      const response = await axiosInstance.get(`/users/orders/${orderId}/receipt`);
      if (response.data.success && response.data.data) {
        setOrderData(response.data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  }, [orderId, orderNumber, trackingId, totalAmount, passedOrderData]);

  useEffect(() => {
    fetchOrderReceipt();
  }, []);

  const handleBack = useCallback(() => {
    dispatch(clearOrderAfterPlacement());
    router.replace('/userHome');
  }, [router, dispatch]);

  const handleShareReceipt = async () => {
    try {
      if (!viewShotRef.current) {
        Alert.alert('Error', 'Unable to capture receipt');
        return;
      }
      const uri = await viewShotRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Order Receipt' });
      } else {
        Alert.alert('Info', 'Sharing not available on this device');
      }
    } catch {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const qrCodeValue = orderId || orderNumber || trackingId || 'N/A';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error && !orderData) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButtonContainer} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.logo}><Text style={styles.logoText}>V</Text></View>
            <Text style={styles.brandName}>ervoer</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF8C00" />
          <Text style={styles.errorTitle}>Unable to Load Receipt</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOrderReceipt}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const items: any[]    = orderData?.items      || [];
  const cleaner: any    = orderData?.cleaner;
  const scheduling: any = orderData?.scheduling;
  const addresses: any  = orderData?.addresses;

  // Recalculate totals from items so the receipt always matches the summary screen
  const subtotal = items.reduce(
    (sum, item) => sum + resolveEffectivePrice(item) * parseInt(String(item.quantity || 0), 10),
    0,
  );

  // ── Success ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButtonContainer} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.logo}><Text style={styles.logoText}>V</Text></View>
          <Text style={styles.brandName}>ervoer</Text>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareReceipt}>
          <MaterialIcons name="share" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 0.9 }}
          style={{ backgroundColor: '#F5F5F5' }}
        >
          {/* ── Success banner ── */}
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <MaterialIcons name="check" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Order Confirmed!</Text>
            <Text style={styles.successSubtitle}>
              Your dry cleaning order has been placed successfully
            </Text>
          </View>

          {/* ── QR Code ── */}
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Order QR Code</Text>
            <Text style={styles.qrSubtitle}>Show this QR code for quick access</Text>
            <View style={styles.qrContainer}>
              <QRCode value={qrCodeValue} size={180} backgroundColor="white" color="#000" />
            </View>
            <Text style={styles.qrOrderNumber}>#{orderData?.orderNumber || orderNumber || 'N/A'}</Text>
            <TouchableOpacity
              style={styles.toggleQRButton}
              onPress={() => setShowDetails(!showDetails)}
            >
              <MaterialIcons
                name={showDetails ? 'visibility-off' : 'visibility'}
                size={20}
                color="#FF8C00"
              />
              <Text style={styles.toggleQRText}>
                {showDetails ? 'Hide Details' : 'Show Full Details'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDetails && (
            <>
              {/* ── Order Details ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Order Details</Text>
                <Row label="Order Number" value={`#${orderData?.orderNumber || orderNumber || 'N/A'}`} />
                <Row label="Tracking ID"  value={orderData?.trackingId || trackingId || 'N/A'} />
                <Row
                  label="Order Date"
                  value={new Date(orderData?.createdAt || Date.now()).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                />
                <Row label="Payment Method" value={orderData?.paymentMethod || 'Card'} />
              </View>

              {/* ── Items ── */}
              {items.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Items ({items.length})</Text>

                  {items.map((item: any, index: number) => {
                    const basePrice      = parseFloat(String(item.price || 0));
                    const effectivePrice = resolveEffectivePrice(item);
                    const qty            = parseInt(String(item.quantity || 0), 10);
                    const lineTotal      = effectivePrice * qty;
                    const addOnTotal     = effectivePrice - basePrice;
                    const addOns: string[] =
                      item.selectedAdditionals ||
                      item.options?.selectedAdditionals ||
                      [];
                    const hasWashAndFold = item.options?.washAndFold;
                    const hasZipper      = item.options?.zipper;
                    const hasButton      = item.options?.button;

                    return (
                      <View key={index} style={styles.itemBlock}>
                        {/* Item name + line total */}
                        <View style={styles.itemHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name || 'Unknown Item'}</Text>
                            <Text style={styles.itemCategory}>{item.category}</Text>
                          </View>
                          <Text style={styles.itemLineTotal}>${lineTotal.toFixed(2)}</Text>
                        </View>

                        {/* Price breakdown */}
                        <View style={styles.itemMeta}>
                          <Text style={styles.itemMetaText}>
                            {qty} × ${basePrice.toFixed(2)}
                            {addOnTotal > 0 ? ` + $${addOnTotal.toFixed(2)} add-ons` : ''}
                            {' = '}
                            <Text style={styles.itemMetaAccent}>
                              ${effectivePrice.toFixed(2)} each
                            </Text>
                          </Text>
                        </View>

                        {/* Service options row */}
                        <View style={styles.optionPillRow}>
                          {item.washOnly && (
                            <View style={styles.optionPill}>
                              <Text style={styles.optionPillText}>Wash Only</Text>
                            </View>
                          )}
                          {hasWashAndFold && (
                            <View style={styles.optionPill}>
                              <Text style={styles.optionPillText}>Wash & Fold</Text>
                            </View>
                          )}
                          {hasZipper && (
                            <View style={styles.optionPill}>
                              <Text style={styles.optionPillText}>Zipper</Text>
                            </View>
                          )}
                          {hasButton && (
                            <View style={styles.optionPill}>
                              <Text style={styles.optionPillText}>Button</Text>
                            </View>
                          )}
                          <View style={styles.optionPillStarch}>
                            <Text style={styles.optionPillStarchText}>
                              Starch: {formatStarch(item.starchLevel)}
                            </Text>
                          </View>
                        </View>

                        {/* Add-ons (from additionalservice) */}
                        {addOns.length > 0 && (
                          <View style={styles.addOnsBlock}>
                            <Text style={styles.addOnsLabel}>Add-ons:</Text>
                            <View style={styles.addOnPillRow}>
                              {addOns.map((name: string) => {
                                const svc = (item.additionalservice || []).find(
                                  (s: any) => s.name === name,
                                );
                                return (
                                  <View key={name} style={styles.addOnPill}>
                                    <Text style={styles.addOnPillText}>
                                      {name}
                                      {svc?.price > 0 ? ` +$${Number(svc.price).toFixed(2)}` : ''}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {index < items.length - 1 && <Divider />}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Pricing breakdown ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payment Summary</Text>
                <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
                {orderData?.pricing?.serviceFees != null && (
                  <Row label="Taxes / Service Fee" value={`$${Number(orderData.pricing.serviceFees).toFixed(2)}`} />
                )}
                {orderData?.pricing?.deliveryCharge != null && (
                  <Row label="Delivery Charge" value={`$${Number(orderData.pricing.deliveryCharge).toFixed(2)}`} />
                )}
                {orderData?.pricing?.tip != null && Number(orderData.pricing.tip) > 0 && (
                  <Row label="Tip" value={`$${Number(orderData.pricing.tip).toFixed(2)}`} />
                )}
                {orderData?.pricing?.platformFee != null && (
                  <Row label="Platform Fee" value={`$${Number(orderData.pricing.platformFee).toFixed(2)}`} />
                )}
                <Divider />
                <Row
                  label="Total Paid"
                  value={`$${Number(orderData?.totalAmount || orderData?.pricing?.totalAmount || totalAmount || 0).toFixed(2)}`}
                  accent
                  bold
                />
              </View>

              {/* ── Dry Cleaner ── */}
              {cleaner && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Dry Cleaner</Text>
                  <Text style={styles.cleanerName}>{cleaner.shopname || 'N/A'}</Text>
                  {cleaner.address && (
                    <Text style={styles.cleanerAddress}>{formatAddress(cleaner.address)}</Text>
                  )}
                  {cleaner.phoneNumber && (
                    <Text style={styles.cleanerPhone}>{cleaner.phoneNumber}</Text>
                  )}
                  {typeof cleaner.rating === 'number' && (
                    <Text style={styles.cleanerRating}>{'★'.repeat(Math.round(cleaner.rating))} ({cleaner.rating})</Text>
                  )}
                </View>
              )}

              {/* ── Addresses ── */}
              {addresses && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Addresses</Text>
                  {addresses.home?.fullAddress && (
                    <View style={styles.addressBlock}>
                      <Text style={styles.addressType}>Home</Text>
                      <Text style={styles.addressText}>{addresses.home.fullAddress}</Text>
                    </View>
                  )}
                  {addresses.office?.fullAddress && (
                    <View style={styles.addressBlock}>
                      <Text style={styles.addressType}>Office</Text>
                      <Text style={styles.addressText}>{addresses.office.fullAddress}</Text>
                    </View>
                  )}
                  {/* Fallback when addresses is a plain string */}
                  {typeof addresses === 'string' && (
                    <Text style={styles.addressText}>{addresses}</Text>
                  )}
                </View>
              )}

              {/* ── Schedule ── */}
              {scheduling && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Schedule</Text>
                  <Row
                    label="Pickup"
                    value={formatScheduleSlot(
                      scheduling.scheduledPickupDateTime,
                      scheduling.pickupDate,
                      scheduling.pickupMonth,
                      scheduling.pickupTime,
                    )}
                  />
                  <Row
                    label="Delivery"
                    value={formatScheduleSlot(
                      scheduling.scheduledDeliveryDateTime,
                      scheduling.deliveryDate,
                      scheduling.deliveryMonth,
                      scheduling.deliveryTime,
                    )}
                  />
                </View>
              )}

              {/* ── What's Next ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>What's Next?</Text>
                <Text style={styles.nextStepText}>
                  {'• Track your order status in the Orders section\n'}
                  {'• Your items will be ready as per the agreed timeline\n'}
                  {'• You\'ll receive notifications about your order status\n'}
                  {'• Show this QR code for quick verification'}
                </Text>
              </View>
            </>
          )}
        </ViewShot>

        {/* Share button */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShareReceipt}>
            <MaterialIcons name="share" size={20} color="#FF8C00" />
            <Text style={styles.actionButtonText}>Share Receipt</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('./myOrder')}
        >
          <Text style={styles.secondaryButtonText}>View Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.trackButton} onPress={handleBack}>
          <Text style={styles.trackButtonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 60,
    marginTop: -70,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButtonContainer: { padding: 8 },
  shareButton:         { padding: 8 },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  logoText:  { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  brandName: { fontSize: 18, fontWeight: '600', color: '#000' },
  headerRight: { width: 40 },

  content: { flex: 1, padding: 16 },

  successContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle:    { fontSize: 24, fontWeight: 'bold', color: '#000', marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', paddingHorizontal: 20 },

  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  qrTitle:    { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  qrSubtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF8C00',
    marginBottom: 15,
  },
  qrOrderNumber: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 15 },
  toggleQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF5E6',
    gap: 8,
  },
  toggleQRText: { fontSize: 14, fontWeight: '600', color: '#FF8C00' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 12 },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel:      { fontSize: 14, color: '#666', flex: 1 },
  detailValue:      { fontSize: 14, fontWeight: '600', color: '#000', flex: 1, textAlign: 'right' },
  detailValueAccent:{ color: '#FF8C00' },
  detailValueBold:  { fontSize: 16 },

  // ── Item block ──
  itemBlock:    { marginBottom: 4 },
  itemHeaderRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  itemName:     { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 2 },
  itemCategory: { fontSize: 12, color: '#999', fontWeight: '500' },
  itemLineTotal:{ fontSize: 16, fontWeight: 'bold', color: '#FF8C00', marginLeft: 8 },

  itemMeta:       { marginBottom: 8 },
  itemMetaText:   { fontSize: 13, color: '#666' },
  itemMetaAccent: { color: '#FF8C00', fontWeight: '600' },

  // ── Option pills ──
  optionPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  optionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  optionPillText: { fontSize: 12, color: '#444', fontWeight: '500' },
  optionPillStarch: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFF3E0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD699',
  },
  optionPillStarchText: { fontSize: 12, color: '#FF8C00', fontWeight: '600' },

  // ── Add-ons block ──
  addOnsBlock:  { marginBottom: 4 },
  addOnsLabel:  { fontSize: 12, color: '#FF8C00', fontWeight: '700', marginBottom: 4 },
  addOnPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addOnPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FF8C001A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD699',
  },
  addOnPillText: { fontSize: 12, color: '#FF8C00', fontWeight: '600' },

  // ── Cleaner ──
  cleanerName:    { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  cleanerAddress: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 4 },
  cleanerPhone:   { fontSize: 14, color: '#666', marginBottom: 4 },
  cleanerRating:  { fontSize: 14, color: '#FF8C00', fontWeight: '500' },

  // ── Addresses ──
  addressBlock: { marginBottom: 10 },
  addressType:  { fontSize: 12, fontWeight: '700', color: '#FF8C00', marginBottom: 2, textTransform: 'uppercase' },
  addressText:  { fontSize: 14, color: '#444', lineHeight: 20 },

  nextStepText: { fontSize: 14, color: '#666', lineHeight: 22 },

  actionButtonsContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#FF8C00' },

  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF8C00',
  },
  secondaryButtonText: { color: '#FF8C00', fontSize: 16, fontWeight: 'bold' },
  trackButton: {
    flex: 1,
    backgroundColor: '#FF8C00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  trackButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  retryButton: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: { paddingVertical: 12 },
  backButtonText: { color: '#666', fontSize: 16 },
});