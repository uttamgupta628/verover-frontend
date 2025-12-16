import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { BookingData } from '../types';

interface BookingHistoryCardProps {
  booking: BookingData;
  onPress?: () => void;
}

const BookingHistoryCard: React.FC<BookingHistoryCardProps> = ({ booking, onPress }) => {
  
  // Get the correct amount from multiple possible fields
  const getAmount = () => {
    // Priority order for amount fields
    if (booking.amountToPaid !== undefined && booking.amountToPaid > 0) {
      return booking.amountToPaid;
    }
    if (booking.totalAmount !== undefined && booking.totalAmount > 0) {
      return booking.totalAmount;
    }
    if (booking.pricing?.totalAmount !== undefined && booking.pricing.totalAmount > 0) {
      return booking.pricing.totalAmount;
    }
    if (booking.paymentDetails?.amount !== undefined && booking.paymentDetails.amount > 0) {
      return booking.paymentDetails.amount;
    }
    return 0;
  };

  const amount = getAmount();
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
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
    <TouchableOpacity 
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.dateText}>
            {booking.bookingPeriod?.from ? formatDate(booking.bookingPeriod.from) : 'Date N/A'}
          </Text>
          <Text style={styles.garageName} numberOfLines={1}>
            {booking.garageName || booking.placeInfo?.name || 'Unknown Garage'}
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
            <Text style={styles.detailText}>{booking.slot || 'No Slot'}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Icon source="car" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{booking.vehicleNumber || 'No Vehicle'}</Text>
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
                : '--:--'
              }
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
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>
            {amount > 0 ? `₹${amount.toFixed(2)}` : '₹0.00'}
          </Text>
        </View>
        
        <View style={styles.paymentMethodContainer}>
          {booking.paymentDetails?.method && (
            <>
              <Icon 
                source={
                  booking.paymentDetails.method === 'CASH' ? 'cash' : 
                  booking.paymentDetails.method === 'CARD' ? 'credit-card' :
                  booking.paymentDetails.method === 'UPI' ? 'cellphone' : 'wallet'
                } 
                size={16} 
                color="#6B7280" 
              />
              <Text style={styles.paymentMethodText}>
                {booking.paymentDetails.method}
              </Text>
            </>
          )}
        </View>
      </View>
      
      {booking.paymentDetails?.status === 'SUCCESS' && 
       booking.bookingPeriod?.to && 
       new Date(booking.bookingPeriod.to) > new Date() && (
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>ACTIVE</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  garageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardBody: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  amountContainer: {},
  amountLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  activeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  activeText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default BookingHistoryCard;