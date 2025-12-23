import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { BookingData } from '../types';

interface BookingHistoryCardProps {
  booking: BookingData;
  onPress?: () => void;
}

const BookingHistoryCard: React.FC<BookingHistoryCardProps> = ({ booking, onPress }) => {

  // Get place name based on booking type
  const getPlaceName = () => {
    if (booking.type === 'G') return booking.garage?.name;
    if (booking.type === 'L') return booking.parking?.name;
    if (booking.type === 'R') return booking.residence?.name;
    return "Unknown";
  };

  // Get amount
  const amount = booking.paymentDetails?.totalAmount || 0;

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Status color
  const getStatusColor = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS': return '#10B981';
      case 'PENDING': return '#F59E0B';
      case 'CANCELLED': return '#EF4444';
      case 'FAILED': return '#DC2626';
      case 'REFUNDED': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const statusColor = getStatusColor(booking.paymentDetails?.status);

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.7}>
      
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.dateText}>
            {formatDate(booking.createdAt)}
          </Text>

          <Text style={styles.placeText} numberOfLines={1}>
            {getPlaceName()}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {booking.paymentDetails?.status || 'UNKNOWN'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Icon source="map-marker" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {booking.bookedSlot || 'No Slot'}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Icon source="account" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {booking.customer?.phone || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Icon source="clock-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {booking.bookingPeriod?.from
                ? new Date(booking.bookingPeriod.from).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit'
                  })
                : '--:--'}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Icon source="timer" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {(() => {
                if (booking.bookingPeriod?.from && booking.bookingPeriod?.to) {
                  const start = new Date(booking.bookingPeriod.from);
                  const end = new Date(booking.bookingPeriod.to);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  return `${hours.toFixed(1)} hrs`;
                }
                return 'N/A';
              })()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>
            ₹{amount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.paymentMethodContainer}>
          <Icon source="wallet" size={16} color="#6B7280" />
          <Text style={styles.paymentMethodText}>
            {booking.paymentDetails?.status || 'N/A'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateText: { fontSize: 12, color: '#6B7280' },
  placeText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardBody: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailItem: { flexDirection: 'row', alignItems: 'center' },
  detailText: { marginLeft: 6, fontSize: 14, color: '#4B5563' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  amountLabel: { fontSize: 12, color: '#6B7280' },
  amountValue: { fontSize: 18, color: '#FF9800', fontWeight: '700' },
  paymentMethodContainer: { flexDirection: 'row', alignItems: 'center' },
  paymentMethodText: { color: '#6B7280', marginLeft: 4 }
});

export default BookingHistoryCard;
