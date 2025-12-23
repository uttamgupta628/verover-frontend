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

interface BookingDetail {
  _id?: string;
  bookingId: string;
  type: 'G' | 'L' | 'R';

  garage?: { name: string };
  parking?: { parkingName: string };
  residence?: { residenceName: string };

  bookedSlot?: string;

  vehicleNumber?: string;

  bookingPeriod?: {
    from: string;
    to: string;
  };

  paymentDetails?: {
    status: string;
    totalAmount?: number;
    method?: string;
    transactionId?: string;
    paidAt?: string;
  };

  createdAt?: string;
}

const BookingDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [bookingData, setBookingData] = useState<BookingDetail | null>(null);

  useEffect(() => {
    try {
      if (params.bookingData) {
        const parsed = JSON.parse(params.bookingData as string);
        setBookingData(parsed);
      } else {
        Alert.alert("Error", "No booking data found");
      }
    } catch (err) {
      Alert.alert("Error", "Invalid booking data");
    }
  }, []);

  if (!bookingData) {
    return <View style={styles.centered}><Text>Loading...</Text></View>;
  }

  const formatDate = (value?: string) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status = "") => {
    switch (status.toUpperCase()) {
      case "SUCCESS": return "#10B981";
      case "PENDING": return "#F59E0B";
      case "FAILED":
      case "CANCELLED": return "#EF4444";
      default: return "#6B7280";
    }
  };

  const getDisplayName = (booking: BookingDetail) => {
    if (booking.type === "G") return booking.garage?.name || "Garage";
    if (booking.type === "L") return booking.parking?.parkingName || "Parking Lot";
    if (booking.type === "R") return booking.residence?.residenceName || "Residence";
    return "Unknown";
  };

  const getAmount = (booking: BookingDetail) => {
    return booking.paymentDetails?.totalAmount ?? 0;
  };

  const statusColor = getStatusColor(bookingData.paymentDetails?.status);

  const qrCodeValue = JSON.stringify({
    bookingId: bookingData.bookingId,
    place: getDisplayName(bookingData),
    slot: bookingData.bookedSlot,
  });

  return (
    <View style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconButton icon="arrow-left" size={26} iconColor="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Booking ID */}
        <Text style={styles.bookingIdLabel}>Booking ID</Text>
        <Text style={styles.bookingId}>{bookingData.bookingId}</Text>

        {/* Status */}
        <View style={[styles.statusContainer, { backgroundColor: `${statusColor}22` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {bookingData.paymentDetails?.status || "N/A"}
          </Text>
        </View>

        {/* QR */}
        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>Parking QR Code</Text>

          <View style={styles.qrBox}>
            <QRCode value={qrCodeValue} size={220} />
          </View>

          <Text style={styles.qrHint}>Show at the parking gate</Text>
        </View>

        {/* Detail Info */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Booking Info</Text>

          <Detail label="Place Name" value={getDisplayName(bookingData)} />

          <Detail label="Slot" value={bookingData.bookedSlot || "N/A"} />

          <Detail label="Vehicle Number" value={bookingData.vehicleNumber || "N/A"} />

          <Detail label="From" value={formatDate(bookingData.bookingPeriod?.from)} />

          <Detail label="To" value={formatDate(bookingData.bookingPeriod?.to)} />

          <Detail label="Payment Method" value={bookingData.paymentDetails?.method || "N/A"} />

          <Detail label="Amount Paid" value={`₹${getAmount(bookingData).toFixed(2)}`} highlight />
          
          {/* <Detail label="Booked On" value={formatDate(bookingData.createdAt)} /> */}

        </View>

      </ScrollView>
    </View>
  );
};

const Detail = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, highlight && styles.amountValue]}>{value}</Text>
  </View>
);

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  bookingIdLabel: { fontSize: 14, color: "#6B7280" },
  bookingId: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  statusContainer: { flexDirection: "row", padding: 8, borderRadius: 16, marginBottom: 24 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: "600" },
  qrSection: { backgroundColor: "#F9FAFB", borderRadius: 14, padding: 20, marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  qrBox: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignSelf: "center" },
  qrHint: { textAlign: "center", fontSize: 13, color: "#6B7280", marginTop: 8 },
  detailsSection: { backgroundColor: "#F9FAFB", padding: 16, borderRadius: 14 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, paddingVertical: 12, borderBottomColor: "#E5E7EB" },
  detailLabel: { fontSize: 15, color: "#4B5563" },
  detailValue: { fontSize: 15, fontWeight: "500", color: "#111827", flexShrink: 1, textAlign: "right" },
  amountValue: { color: "#10B981", fontWeight: "700" },
});

export default BookingDetailScreen;
