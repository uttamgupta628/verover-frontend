import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "react-native-paper";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
import colors from "../../assets/color";

interface ReceiptProps {
  visible: boolean;
  onClose: () => void;
  bookingData: {
    bookingId: string;
    garageName: string;
    slot: string;
    bookingPeriod: {
      from: string;
      to: string;
    };
    vehicleNumber: string;
    pricing: {
      basePrice: number;
      discount: number;
      totalAmount: number;
    };
    placeInfo: {
      name: string;
      address: string;
      phoneNo: string;
      owner: string;
    };
  };
  type: "G" | "L" | "R";
}

const BookingReceipt: React.FC<ReceiptProps> = ({
  visible,
  onClose,
  bookingData,
  type,
}) => {
  const receiptRef = useRef<View>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDuration = (from: string, to: string) => {
    const start = new Date(from);
    const end = new Date(to);
    const diffMs = end.getTime() - start.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  const getBookingType = () => {
    switch (type) {
      case "G":
        return "Garage";
      case "L":
        return "Parking Lot";
      case "R":
        return "Residence";
      default:
        return "Parking";
    }
  };

  // Create QR code data
  const qrData = JSON.stringify({
    bookingId: bookingData.bookingId,
    vehicleNumber: bookingData.vehicleNumber,
    location: bookingData.placeInfo.name,
    slot: bookingData.slot,
    from: bookingData.bookingPeriod.from,
    to: bookingData.bookingPeriod.to,
    amount: bookingData.pricing.totalAmount,
    type: getBookingType(),
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (!receiptRef.current) {
        Alert.alert("Error", "Receipt not ready for download");
        return;
      }

      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant permission to save receipts to your gallery.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                // You can use Linking.openSettings() here if needed
                Alert.alert(
                  "Info",
                  "Please enable media library permissions in your device settings."
                );
              },
            },
          ]
        );
        return;
      }

      // Add a small delay to ensure the view is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Capture the receipt as image
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      console.log("Captured URI:", uri);

      if (!uri) {
        throw new Error("Failed to capture receipt");
      }

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(uri);

      // Try to create/get album
      try {
        const album = await MediaLibrary.getAlbumAsync("Vervoer Receipts");
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync("Vervoer Receipts", asset, false);
        }
      } catch (albumError) {
        console.log("Album creation skipped, image saved to gallery");
      }

      Alert.alert(
        "Success! 🎉",
        "Receipt has been saved to your gallery in the 'Vervoer Receipts' album.",
        [
          {
            text: "Share",
            onPress: async () => {
              try {
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                  await Sharing.shareAsync(uri, {
                    mimeType: "image/png",
                    dialogTitle: "Share Receipt",
                  });
                }
              } catch (shareError) {
                console.error("Share error:", shareError);
              }
            },
          },
          { text: "OK", style: "default" },
        ]
      );
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert(
        "Error",
        `Failed to save receipt: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Booking Confirmed!</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon source="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Receipt Content - This is what gets captured */}
            <View
              ref={receiptRef}
              collapsable={false}
              style={styles.receiptContainer}
            >
              {/* Success Icon */}
              <View style={styles.successIconContainer}>
                <Icon source="check-circle" size={64} color={colors.primary} />
              </View>

              {/* Booking ID */}
              <View style={styles.bookingIdContainer}>
                <Text style={styles.bookingIdLabel}>Booking ID</Text>
                <Text style={styles.bookingIdText}>
                  {bookingData.bookingId}
                </Text>
              </View>

              {/* Location Details */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon source="map-marker" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Location Details</Text>
                </View>
                <Text style={styles.locationName}>
                  {bookingData.placeInfo.name}
                </Text>
                <Text style={styles.locationAddress}>
                  {bookingData.placeInfo.address}
                </Text>
                <Text style={styles.infoText}>
                  Type: {getBookingType()} • Slot: {bookingData.slot}
                </Text>
              </View>

              {/* Booking Period */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon
                    source="clock-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.sectionTitle}>Booking Period</Text>
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>Start Time</Text>
                    <Text style={styles.timeValue}>
                      {formatDate(bookingData.bookingPeriod.from)}
                    </Text>
                  </View>
                  <View style={styles.timeDivider} />
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>End Time</Text>
                    <Text style={styles.timeValue}>
                      {formatDate(bookingData.bookingPeriod.to)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.durationText}>
                  Duration:{" "}
                  {calculateDuration(
                    bookingData.bookingPeriod.from,
                    bookingData.bookingPeriod.to
                  )}
                </Text>
              </View>

              {/* Vehicle Details */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon source="car" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Vehicle Details</Text>
                </View>
                <Text style={styles.vehicleNumber}>
                  {bookingData.vehicleNumber}
                </Text>
              </View>

              {/* Payment Details */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon source="cash" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Payment Details</Text>
                </View>
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
                <View style={styles.divider} />
                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Total Paid</Text>
                  <Text style={styles.totalValue}>
                    ${bookingData.pricing.totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Contact Information */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon source="phone" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                </View>
                <Text style={styles.contactName}>
                  {bookingData.placeInfo.owner}
                </Text>
                <Text style={styles.contactPhone}>
                  {bookingData.placeInfo.phoneNo}
                </Text>
              </View>

              {/* QR Code */}
              <View style={styles.qrSection}>
                <Text style={styles.qrTitle}>Scan for Quick Access</Text>
                <View style={styles.qrCodeContainer}>
                  <QRCode value={qrData} size={200} />
                </View>
                <Text style={styles.qrSubtitle}>
                  Show this QR code at the entrance
                </Text>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Thank you for choosing Vervoer!
                </Text>
                <Text style={styles.footerSubtext}>
                  Generated on {formatDate(new Date().toISOString())}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            
            <TouchableOpacity
  style={styles.doneButton}
  disabled={isDownloading}
  onPress={() => {
    router.push("/userHome"); 
  }}
>
  <Text style={styles.doneButtonText}>Done</Text>
</TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "95%",
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  receiptContainer: {
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  successIconContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  bookingIdContainer: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  bookingIdLabel: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 4,
  },
  bookingIdText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginLeft: 8,
  },
  locationName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666666",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  timeColumn: {
    flex: 1,
  },
  timeDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 12,
  },
  timeLabel: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000000",
  },
  durationText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  vehicleNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 2,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666666",
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000000",
  },
  discountText: {
    color: "#4CAF50",
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: "#666666",
  },
  qrSection: {
    alignItems: "center",
    marginVertical: 24,
    paddingVertical: 20,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
  },
  qrCodeContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrSubtitle: {
    fontSize: 12,
    color: "#666666",
    marginTop: 12,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    paddingTop: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: "#999999",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  downloadButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  doneButton: {
    paddingHorizontal: 180,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F99026",
    justifyContent: "center",
    alignItems: "center",
  },
  doneButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default BookingReceipt;
