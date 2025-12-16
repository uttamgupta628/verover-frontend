import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../assets/color';

const { width, height } = Dimensions.get('window');
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFontSize = (size: number) => {
  const scale = Math.min(width / 375, height / 812);
  return size * scale;
};

export default function BookingDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Parse the booking data
  const bookingData = params.bookingData 
    ? JSON.parse(params.bookingData as string) 
    : null;

  if (!bookingData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No booking data available</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerText}>Booking Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  bookingData.status === 'completed'
                    ? '#4CAF50'
                    : bookingData.status === 'confirmed'
                    ? '#2196F3'
                    : '#FF9800',
              },
            ]}
          >
            <Text style={styles.statusText}>
              {bookingData.status?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
        </View>

        {/* Garage Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Garage Information</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Garage Name" value={bookingData.garage?.name} />
            <InfoRow label="Address" value={bookingData.garage?.address} />
            <InfoRow label="Contact" value={bookingData.garage?.contactNumber} />
            <View style={styles.divider} />
            <Text style={styles.subSectionTitle}>Owner Details</Text>
            <InfoRow label="Name" value={bookingData.garage?.owner?.name} />
            <InfoRow label="Email" value={bookingData.garage?.owner?.email} />
            <InfoRow label="Phone" value={bookingData.garage?.owner?.phone} />
          </View>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Name" value={bookingData.customer?.name} />
            <InfoRow label="Email" value={bookingData.customer?.email} />
            <InfoRow label="Phone" value={bookingData.customer?.phone} />
          </View>
        </View>

        {/* Booking Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Vehicle Number" value={bookingData.vehicleNumber} />
            <InfoRow label="Booked Slot" value={bookingData.bookedSlot} />
            <InfoRow
              label="Start Time"
              value={formatDate(bookingData.bookingPeriod?.startTime)}
            />
            <InfoRow
              label="End Time"
              value={formatDate(bookingData.bookingPeriod?.endTime)}
            />
            <InfoRow label="Price Rate" value={`₹${bookingData.priceRate}`} />
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.infoCard}>
            <InfoRow
              label="Total Amount"
              value={`₹${bookingData.paymentDetails?.totalAmount}`}
              valueStyle={styles.amountText}
            />
            <InfoRow
              label="Amount Paid"
              value={`₹${bookingData.paymentDetails?.amountPaid}`}
            />
            <InfoRow
              label="Discount"
              value={`₹${bookingData.paymentDetails?.discount || 0}`}
            />
            <InfoRow
              label="Payment Status"
              value={bookingData.paymentDetails?.status?.toUpperCase()}
            />
            <InfoRow
              label="Payment Method"
              value={bookingData.paymentDetails?.method}
            />
            {bookingData.paymentDetails?.paidAt && (
              <InfoRow
                label="Paid At"
                value={formatDate(bookingData.paymentDetails.paidAt)}
              />
            )}
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

// Helper component for info rows
const InfoRow = ({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value?: string;
  valueStyle?: any;
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.label}>{label}:</Text>
    <Text style={[styles.value, valueStyle]}>{value || 'N/A'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 5,
  },
  headerText: {
    fontSize: responsiveFontSize(20),
    fontWeight: '600',
    color: colors.black,
  },
  placeholder: {
    width: 38,
  },
  scrollView: {
    flex: 1,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '700',
    color: colors.black,
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: colors.brandColor,
    marginTop: 5,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: responsiveFontSize(14),
    color: colors.black,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  amountText: {
    color: colors.brandColor,
    fontSize: responsiveFontSize(16),
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 15,
  },
  errorText: {
    fontSize: responsiveFontSize(16),
    color: '#FF0000',
    textAlign: 'center',
    marginTop: 50,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.brandColor,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
  },
  bottomSpace: {
    height: 30,
  },
});