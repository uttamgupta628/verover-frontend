// app/parkingUser/booking-detail.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconButton } from "react-native-paper";
import QRCode from "react-native-qrcode-svg";

// Define the BookingData type locally if not imported
interface BookingData {
  _id?: string;
  bookingId: string;
  type: 'G' | 'L' | 'R';
  garageName: string;
  slot: string;
  vehicleNumber?: string;
  bookingPeriod: {
    from: string;
    to: string;
  };
  paymentDetails: {
    status: string;
    amount: number;
    method: string;
    transactionId?: string;
    paidAt?: string;
  };
  pricing?: {
    totalAmount: number;
  };
  createdAt?: string;
}

const BookingDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);

  useEffect(() => {
    try {
      console.log("📥 Received booking params:", {
        hasParams: !!params.bookingData,
        paramsLength: params.bookingData?.length || 0
      });
      
      if (params.bookingData) {
        const parsedData = JSON.parse(params.bookingData as string);
        console.log("✅ Successfully parsed booking data:", {
          bookingId: parsedData.bookingId || parsedData._id,
          type: parsedData.type
        });
        setBookingData(parsedData);
      } else {
        Alert.alert("Error", "No booking data found");
        console.log("❌ No booking data in params");
      }
    } catch (error) {
      console.error("❌ Error parsing booking data:", error);
      Alert.alert("Error", "Failed to load booking details");
    }
  }, [params.bookingData]);

  if (!bookingData) {
    return (
      <View style={styles.centered}>
        <Text>Loading booking details...</Text>
      </View>
    );
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS': return '#10B981';
      case 'PENDING': return '#F59E0B';
      case 'CANCELLED': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const statusColor = getStatusColor(bookingData.paymentDetails?.status);
  
  // Create QR code value
  const qrCodeValue = JSON.stringify({
    bookingId: bookingData.bookingId || bookingData._id,
    garageName: bookingData.garageName,
    slot: bookingData.slot,
    vehicle: bookingData.vehicleNumber,
    timestamp: new Date().toISOString(),
  });

  const getDisplayAmount = (booking: BookingData | null) => {
  if (!booking) return 0;
  
  // Check all possible amount fields
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
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconButton icon="arrow-left" size={28} iconColor="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Booking ID */}
        <View style={styles.bookingIdContainer}>
          <Text style={styles.bookingIdLabel}>Booking ID</Text>
          <Text style={styles.bookingId}>
            {bookingData.bookingId || bookingData._id || 'N/A'}
          </Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusContainer, { backgroundColor: `${statusColor}20` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {bookingData.paymentDetails?.status || 'UNKNOWN'}
          </Text>
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>Parking QR Code</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={qrCodeValue}
              size={220}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>
          <Text style={styles.qrHint}>
            Show this QR code at the parking entrance
          </Text>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Garage Name</Text>
            <Text style={styles.detailValue}>{bookingData.garageName}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Parking Slot</Text>
            <Text style={styles.detailValue}>{bookingData.slot}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Number</Text>
            <Text style={styles.detailValue}>{bookingData.vehicleNumber || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From</Text>
            <Text style={styles.detailValue}>
              {formatDate(bookingData.bookingPeriod?.from)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To</Text>
            <Text style={styles.detailValue}>
              {formatDate(bookingData.bookingPeriod?.to)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Method</Text>
            <Text style={styles.detailValue}>
              {bookingData.paymentDetails?.method || 'N/A'}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
  <Text style={styles.detailLabel}>Amount Paid</Text>
  <Text style={[styles.detailValue, styles.amountText]}>
    ₹{getDisplayAmount(bookingData).toFixed(2)}
  </Text>
</View>
          
          {bookingData.createdAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booked On</Text>
              <Text style={styles.detailValue}>
                {formatDate(bookingData.createdAt)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            Alert.alert(
              "Need Help?",
              "Contact support: support@vervoer.com",
              [{ text: "OK" }]
            );
          }}
        >
          <Text style={styles.actionButtonText}>Get Help</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => {
            // Add functionality to extend booking
            Alert.alert(
              "Extend Booking",
              "This feature will be available soon!",
              [{ text: "OK" }]
            );
          }}
        >
          <Text style={styles.primaryButtonText}>Extend Booking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  bookingIdContainer: {
    marginBottom: 16,
  },
  bookingIdLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  bookingId: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  qrSection: {
    alignItems: "center",
    marginBottom: 32,
    padding: 20,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  qrContainer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  qrHint: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  detailsSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailLabel: {
    fontSize: 15,
    color: "#4B5563",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
    textAlign: "right",
    flexShrink: 1,
  },
  amountText: {
    fontWeight: "700",
    color: "#10B981",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4B5563",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default BookingDetailScreen;