import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ImageSourcePropType,
  Linking,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import colors from "../assets/color";
import { ParkingViewType } from "../components/Types";
import { images } from "../assets/images/images";

import SessionDetails from "./LiveSessions/SessionDetails";
import LocationCard from "./LiveSessions/LocationCard";
import Contact from "./LiveSessions/Contact";

import {
  responsiveFontSize,
  responsiveWidth,
} from "react-native-responsive-dimensions";

import { BookingData } from "../types";
import { calculateDuration } from "../utils/slotIdConverter";

interface LiveSessionProps {
  onBack: () => void;
  onNavigate: (screen: ParkingViewType) => void;
  qrCode: string;
  bookingData?: BookingData;
}

interface SessionDetailItemProps {
  icon: ImageSourcePropType | React.ReactNode;
  label: string;
  value: string;
  valueStyle?: any;
}

const handleCall = () => {
  Linking.openURL("tel:+11048285215");
};

const SessionDetailItem = ({
  icon,
  label,
  value,
  valueStyle,
}: SessionDetailItemProps) => (
  <View style={styles.detailItem}>
    {React.isValidElement(icon) ? (
      icon
    ) : (
      <Image source={icon as ImageSourcePropType} style={styles.detailIcon} />
    )}

    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  </View>
);

const PaymentDetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <View style={styles.paymentRow}>
    <Text style={styles.paymentLabel}>{label}</Text>
    <Text style={styles.paymentValue}>{value}</Text>
  </View>
);

const LiveSession: React.FC<LiveSessionProps> = ({
  onBack,
  onNavigate,
  qrCode,
  bookingData,
}) => {
  const parkingId = bookingData?._id || "#unknown";

  const startedDate = new Date(bookingData?.bookingPeriod.from || "");
  const endDate = new Date(bookingData?.bookingPeriod.to || "");

  function calculateTime(sd: Date, ed: Date) {
    let t = ed.getTime() - sd.getTime();
    let d = 0;
    let res = "";

    if (t > 1000 * 60 * 60 * 24) {
      d = Math.floor(t / (1000 * 60 * 60 * 24));
      res += `${d} day${d > 1 ? "s" : ""}`;
      t -= d * 1000 * 60 * 60 * 24;
    }

    if (t > 1000 * 60 * 60) {
      d = Math.floor(t / (1000 * 60 * 60));
      res += ` ${d} hour${d > 1 ? "s" : ""}`;
      t -= d * 1000 * 60 * 60;
    } else if (t > 1000 * 60) {
      d = Math.floor(t / (1000 * 60));
      res += ` ${d} minute${d > 1 ? "s" : ""}`;
    }

    return res.trim();
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* ---------- Header ---------- */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={onBack}
              style={{ width: "10%", alignItems: "center" }}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={30}
                color={colors.primary}
              />
            </TouchableOpacity>

            <View style={{ width: "50%" }}>
              <Text style={styles.title}>Session Summary</Text>
            </View>

            <Text style={styles.parkingId}>#{parkingId}</Text>
          </View>
        </View>

        {/* ---------- Bill Section ---------- */}
        <View style={styles.billSection}>
          <Text style={styles.billLabel}>Your bill is</Text>
          <Text style={styles.billAmount}>
            {(bookingData?.paymentDetails.amountPaid || 0).toFixed(2)}
          </Text>
          <Text style={styles.billTime}>
            {new Date(bookingData?.paymentDetails.paidAt || "").toString()}
          </Text>
          <View style={styles.divider} />
        </View>

        {/* ---------- Location Card ---------- */}
        <LocationCard
          name={
            bookingData?.type === "G"
              ? bookingData?.garage?.name
              : bookingData?.type === "L"
              ? bookingData?.parking?.name
              : bookingData?.residence?.name
          }
          price={bookingData?.priceRate}
          address={
            bookingData?.type === "G"
              ? bookingData?.garage?.address
              : bookingData?.type === "L"
              ? bookingData?.parking?.address
              : bookingData?.residence?.address
          }
        />

        {/* ---------- Session Details ---------- */}
        <SessionDetails
          parkingSlotId={bookingData?.bookedSlot || "A 001"}
          duration={calculateDuration(
            bookingData?.bookingPeriod.from || "",
            bookingData?.bookingPeriod.to || ""
          )}
          startingFrom={new Date(
            bookingData?.bookingPeriod.from || ""
          ).toLocaleString()}
        />

        {/* ---------- Payment Summary ---------- */}
        <View style={styles.paymentSection}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>
            Payment Summary
          </Text>

          <View style={styles.paymentContent}>
            <PaymentDetailRow
              label="Started At"
              value={
                startedDate.toDateString() +
                " " +
                startedDate.toLocaleTimeString()
              }
            />
            <PaymentDetailRow
              label="End At"
              value={endDate.toDateString() + " " + endDate.toLocaleTimeString()}
            />
            <PaymentDetailRow
              label="Time Used"
              value={calculateTime(startedDate, endDate)}
            />
            <PaymentDetailRow
              label="Price Per Hour"
              value={"$" + (bookingData?.priceRate?.toFixed(2) || "0")}
            />
            <PaymentDetailRow
              label="Base Price"
              value={`$${(
                bookingData?.paymentDetails.totalAmount || 0
              ).toFixed(2)}`}
            />
            <PaymentDetailRow
              label="Discount"
              value={`- $${(
                bookingData?.paymentDetails.discount || 0
              ).toFixed(2)}`}
            />
            <PaymentDetailRow
              label="Platform Charge"
              value={`$${(
                bookingData?.paymentDetails.platformCharge || 0
              ).toFixed(2)}`}
            />
            <PaymentDetailRow
              label="Total Price"
              value={`$${(
                bookingData?.paymentDetails.amountPaid || 0
              ).toFixed(2)}`}
            />

            <View style={styles.totalPayment}>
              <Text style={styles.totalLabel}>
                Total Payment{" "}
                <Text style={styles.approved}>(Approved)</Text>
              </Text>
              <Text style={styles.totalAmount}>
                $
                {(
                  bookingData?.paymentDetails.amountPaid || 0
                ).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* ---------- Contact ---------- */}
        <Contact
          name={
            bookingData?.type === "G"
              ? bookingData?.garage?.ownerName
              : bookingData?.type === "L"
              ? bookingData?.parking?.ownerName
              : bookingData?.residence?.ownerName || "John Doe"
          }
          phoneNo={
            bookingData?.type === "G"
              ? bookingData?.garage?.contactNumber
              : bookingData?.type === "L"
              ? bookingData?.parking?.contactNumber
              : bookingData?.residence?.contactNumber || "1234567890"
          }
        />

        <TouchableOpacity onPress={onBack} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel Parking</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------- Footer QR ---------- */}
      <TouchableOpacity
        style={styles.footer}
        onPress={() => onNavigate("qrCode")}
      >
        <View style={styles.footerContent}>
          <Text style={styles.footerText}>My QR Code</Text>
          <Image source={images.Scanner} style={styles.qrImage} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

/* ---------------------- STYLES ---------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },

  header: {
    padding: 16,
    backgroundColor: "#FFECE5",
    marginTop: "15%",
    width: responsiveWidth(100),
    alignItems: "center",
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    width: responsiveWidth(100),
  },

  title: {
    fontSize: responsiveFontSize(1.9),
    color: "#333333",
  },

  parkingId: {
    color: colors.primary,
    fontSize: responsiveFontSize(1.5),
    paddingRight: "10%",
  },

  content: {
    flex: 1,
  },

  billSection: {
    padding: 24,
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    marginBottom: 4,
  },

  billLabel: {
    fontSize: 16,
    color: "#666666",
  },

  billAmount: {
    fontSize: 40,
    fontWeight: "bold",
    color: colors.primary,
    marginVertical: 8,
  },

  billTime: {
    fontSize: 14,
    color: "#666666",
  },

  divider: {
    height: 2,
    backgroundColor: "#E0E0E0",
    marginTop: 16,
    width: "80%",
  },

  // Payment Summary
  paymentSection: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
  },

  paymentContent: {
    gap: 12,
  },

  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  paymentLabel: {
    fontSize: 14,
    color: "#666666",
  },

  paymentValue: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "500",
  },

  totalPayment: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    marginTop: 8,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },

  approved: {
    color: colors.primary,
    fontSize: 14,
  },

  totalAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
  },

  cancelButton: {
    margin: 16,
    backgroundColor: "#666666",
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  footer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    width: "100%",
  },

  footerContent: {
    alignItems: "center",
    justifyContent: "center",
  },

  footerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
  },

  qrImage: {
    width: 48,
    height: 48,
  },

  // Details items
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  detailIcon: {
    width: 24,
    height: 24,
  },

  detailLabel: {
    fontSize: 14,
    color: "#666666",
  },

  detailValue: {
    fontSize: 16,
    color: "#333333",
    fontWeight: "500",
  },
});

export default LiveSession;
