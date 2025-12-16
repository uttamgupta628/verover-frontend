import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import colors from '../../assets/color';

const { width, height } = Dimensions.get('window');
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFontSize = (size: number) => {
  const scale = Math.min(width / 375, height / 812);
  return size * scale;
};

interface BookingData {
  bookingId: string;
  garageName: string;
  address: string;
  slot: string;
  vehicleNumber: string;
  bookingPeriod: {
    from: string;
    to: string;
  };
  pricing: {
    basePrice: number;
    discount: number;
    totalAmount: number;
  };
  paymentMethod: string;
  type: 'G' | 'L' | 'R';
  owner: string;
  contactNumber: string;
}

export default function BookingBill() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const viewShotRef = useRef<ViewShot>(null);

  // Parse booking data
  const bookingData: BookingData = React.useMemo(() => {
    try {
      if (params.bookingData) {
        const dataStr = Array.isArray(params.bookingData)
          ? params.bookingData[0]
          : params.bookingData;
        return JSON.parse(dataStr);
      }
      return null;
    } catch (error) {
      console.error('Error parsing booking data:', error);
      return null;
    }
  }, [params.bookingData]);

  if (!bookingData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No booking data available</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/userHome')}
        >
          <Text style={styles.buttonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (from: string, to: string) => {
    const start = new Date(from);
    const end = new Date(to);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'G':
        return 'Garage';
      case 'L':
        return 'Parking Lot';
      case 'R':
        return 'Residence';
      default:
        return 'Parking';
    }
  };

  // QR Code data - can be booking ID or full URL
  const qrCodeValue = bookingData.bookingId;

  const handleShare = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share Booking Receipt',
          });
        } else {
          // Fallback to text sharing
          await Share.share({
            message: `Booking Confirmation\nID: ${bookingData.bookingId}\nVehicle: ${bookingData.vehicleNumber}\nAmount: $${bookingData.pricing.totalAmount.toFixed(2)}`,
          });
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handleDownload = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        Alert.alert('Success', 'Receipt saved to gallery');
      }
    } catch (error) {
      console.error('Error downloading:', error);
      Alert.alert('Error', 'Failed to save receipt');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/userHome')}>
          <Ionicons name="close" size={28} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Receipt</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.billContainer}>
            {/* Success Icon */}
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              <Text style={styles.successText}>Booking Confirmed!</Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={qrCodeValue}
                  size={200}
                  backgroundColor="white"
                  color="black"
                  // logo={require('../assets/images/images/logo.png')} 
                  logoSize={40}
                  logoBackgroundColor="white"
                  logoMargin={2}
                />
              </View>
              <Text style={styles.qrLabel}>Scan at Entry</Text>
              <Text style={styles.bookingId}>ID: {bookingData.bookingId}</Text>
            </View>

            {/* Divider */}
            <View style={styles.dashedDivider} />

            {/* Booking Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Booking Details</Text>

              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="garage"
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{getTypeLabel(bookingData.type)}</Text>
                  <Text style={styles.detailValue}>{bookingData.garageName}</Text>
                  <Text style={styles.detailSubValue}>{bookingData.address}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="car" size={20} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Vehicle Number</Text>
                  <Text style={styles.detailValue}>{bookingData.vehicleNumber}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="parking"
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Parking Slot</Text>
                  <Text style={styles.detailValue}>{bookingData.slot}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Check-in Time</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(bookingData.bookingPeriod.from)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Check-out Time</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(bookingData.bookingPeriod.to)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="hourglass" size={20} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>
                    {calculateDuration(
                      bookingData.bookingPeriod.from,
                      bookingData.bookingPeriod.to
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.solidDivider} />

            {/* Payment Details */}
            <View style={styles.paymentSection}>
              <Text style={styles.sectionTitle}>Payment Summary</Text>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Base Price</Text>
                <Text style={styles.priceValue}>
                  ${bookingData.pricing.basePrice.toFixed(2)}
                </Text>
              </View>

              {bookingData.pricing.discount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={[styles.priceValue, styles.discountText]}>
                    -${bookingData.pricing.discount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  ${bookingData.pricing.totalAmount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.paymentMethodRow}>
                <MaterialCommunityIcons
                  name="credit-card"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.paymentMethodText}>
                  Paid via {bookingData.paymentMethod}
                </Text>
              </View>
            </View>

            {/* Contact Info */}
            <View style={styles.contactSection}>
              <View style={styles.contactRow}>
                <Ionicons name="person" size={18} color="#666" />
                <Text style={styles.contactText}>{bookingData.owner}</Text>
              </View>
              <View style={styles.contactRow}>
                <Ionicons name="call" size={18} color="#666" />
                <Text style={styles.contactText}>{bookingData.contactNumber}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Thank you for your booking!</Text>
              <Text style={styles.footerSubText}>
                Show this QR code at the entrance
              </Text>
            </View>
          </View>
        </ViewShot>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
            <Ionicons name="download" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => router.replace('/userHome')}
          >
            <Ionicons name="home" size={24} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

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
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: '600',
    color: colors.black,
  },
  placeholder: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  billContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  successBadge: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successText: {
    fontSize: responsiveFontSize(24),
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 10,
  },
  qrSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  qrLabel: {
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
    color: colors.black,
    marginTop: 15,
  },
  bookingId: {
    fontSize: responsiveFontSize(12),
    color: '#666',
    marginTop: 5,
  },
  dashedDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    marginVertical: 20,
  },
  solidDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  detailsSection: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '700',
    color: colors.black,
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: responsiveFontSize(12),
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: responsiveFontSize(15),
    fontWeight: '600',
    color: colors.black,
  },
  detailSubValue: {
    fontSize: responsiveFontSize(12),
    color: '#888',
    marginTop: 2,
  },
  paymentSection: {
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: responsiveFontSize(14),
    color: '#666',
  },
  priceValue: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: colors.black,
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 5,
  },
  totalLabel: {
    fontSize: responsiveFontSize(16),
    fontWeight: '700',
    color: colors.black,
  },
  totalValue: {
    fontSize: responsiveFontSize(18),
    fontWeight: '700',
    color: colors.primary,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  paymentMethodText: {
    fontSize: responsiveFontSize(14),
    color: '#666',
    marginLeft: 8,
  },
  contactSection: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: responsiveFontSize(13),
    color: '#666',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: colors.black,
  },
  footerSubText: {
    fontSize: responsiveFontSize(12),
    color: '#666',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: colors.primary,
    marginTop: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 18,
    color: colors.primary,
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});