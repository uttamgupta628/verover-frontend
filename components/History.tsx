// src/components/History/History.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import { IconButton, Card, Button } from "react-native-paper";
import colors from "../assets/color";
import { BookingData } from "../types";
import { useRouter } from "expo-router";

// Utility functions
function isoDateToString(date: string) {
  let d = new Date(date);
  return d.toDateString() + " " + d.toLocaleTimeString();
}

function calculateDuration(ss: string, ee: string) {
  let s = new Date(ss),
    e = new Date(ee);
  let t = e.getTime() - s.getTime();
  let d,
    res = "";

  if (t > 24 * 60 * 60 * 1000) {
    d = Math.floor(t / (24 * 60 * 60 * 1000));
    res += ` ${d} day${d > 1 ? "s" : ""}`;
    t -= d * 24 * 60 * 60 * 1000;
  }
  if (t > 60 * 60 * 1000) {
    d = Math.floor(t / (60 * 60 * 1000));
    res += ` ${d} hour${d > 1 ? "s" : ""}`;
    t -= d * 60 * 60 * 1000;
  }
  if (t > 60 * 1000) {
    d = Math.floor(t / (60 * 1000));
    res += ` ${d} minute${d > 1 ? "s" : ""}`;
    t -= d * 60 * 1000;
  }

  return res.trim();
}

interface HistoryItemProps {
  initial: string;
  location: string;
  address: string;
  duration: string;
  rating: number;
  price: number;
  sessionId: string;
  startTime: string;
  endTime: string;
  timeUsed: string;
  pricePerHour: number;
  onPress: () => void;
  onQRPress: () => void;
}

const HistoryItem = ({
  initial,
  location,
  address,
  duration,
  rating,
  price,
  sessionId,
  startTime,
  endTime,
  timeUsed,
  pricePerHour,
  onPress,
  onQRPress,
}: HistoryItemProps) => (
  <Card style={styles.card}>
    <TouchableOpacity onPress={onPress}>
      <View style={styles.locationSection}>
        <View
          style={[
            styles.initialCircle,
            {
              backgroundColor:
                initial === "G" ? colors.primary : "#FF9800",
            },
          ]}
        >
          <Text style={styles.initialText}>{initial}</Text>
        </View>

        <View style={styles.locationInfo}>
          <Text style={styles.locationName}>{location}</Text>
          <Text style={styles.locationAddress}>{address}</Text>

          <View style={styles.metaInfo}>
            <Text style={styles.duration}>{duration}</Text>
            <Text style={styles.rating}>⭐ {rating}</Text>
            <Text style={styles.price}>${price.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Session Details */}
      <View style={styles.detailsSection}>
        <DetailRow label="Session ID" value={`#${sessionId}`} />
        <DetailRow label="Started At" value={startTime} />
        <DetailRow label="End At" value={endTime} />
        <DetailRow label="Time Used" value={timeUsed} />
        <DetailRow
          label="Price Per Hour"
          value={`$${pricePerHour.toFixed(2)}/H`}
        />
      </View>
    </TouchableOpacity>

    {/* Action Buttons */}
    <View style={styles.actionButtons}>
      <Button
        mode="outlined"
        onPress={onQRPress}
        style={styles.qrButton}
        labelStyle={styles.buttonLabel}
      >
        View QR Code
      </Button>
    </View>
  </Card>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

interface HistoryProps {
  onBack: () => void;
  bookingList: BookingData[];
}

const History = ({ onBack, bookingList }: HistoryProps) => {
  const router = useRouter();

  const handleQRCodePress = (bookingId: string) => {
    router.push(`/QRCode?bookingId=${bookingId}`);
  };

  const handleLiveSessionPress = (bookingId: string, type: string) => {
    router.push(`/LiveSession?bookingId=${bookingId}&type=${type}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <IconButton icon="arrow-left" size={24} iconColor={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
      </View>

      {/* History List */}
      <ScrollView style={styles.content}>
        {bookingList.map((item, index) => (
          <HistoryItem
            key={index}
            initial={item.type}
            location={
              item.type === "G"
                ? item.garage.name
                : item.type === "L"
                ? item.parking.name
                : item.residence.name
            }
            address={
              item.type === "G"
                ? item.garage.address
                : item.type === "L"
                ? item.parking.address
                : item.residence.address
            }
            duration={calculateDuration(
              item.bookingPeriod.from,
              item.bookingPeriod.to
            )}
            rating={4.2}
            price={item.priceRate || 100}
            sessionId={item._id}
            startTime={isoDateToString(item.bookingPeriod.from)}
            endTime={isoDateToString(item.bookingPeriod.to)}
            timeUsed={calculateDuration(
              item.bookingPeriod.from,
              item.bookingPeriod.to
            )}
            pricePerHour={item.priceRate || 100}
            onPress={() =>
              handleLiveSessionPress(item._id, item.type)
            }
            onQRPress={() => handleQRCodePress(item._id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

/* ---------- Styles ----------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#FFFFFF",
    marginTop: "20%",
  },
  content: {
    flex: 1,
    padding: 8,
  },
  card: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    marginHorizontal: 10,
    marginTop: "3%",
  },
  locationSection: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  initialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  initialText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  duration: {
    fontSize: 14,
    color: "#666666",
  },
  rating: {
    fontSize: 14,
    color: "#666666",
  },
  price: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  backButton: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333333",
  },
  detailsSection: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666666",
  },
  detailValue: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  qrButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonLabel: {
    fontSize: 12,
  },
});

export default History;
