import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconButton } from "react-native-paper";
import color from "../../assets/color";
import { getSpacDetailsFromID } from "../../utils/slotIdConverter";

interface SessionDetailsProps {
  parkingSlotId?: string;
  startingFrom: string;
  duration: string;
}

const SessionDetails = ({
  parkingSlotId,
  startingFrom,
  duration,
}: SessionDetailsProps) => {
  const { zone, slot: parkingNumber } =
    getSpacDetailsFromID(parkingSlotId || "A 001") || {};

  return (
    <View style={styles.detailsSection}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>Current Session Details</Text>
      </View>

      <View style={styles.detailsContent}>
        {/* Row: Zone + Parking Number */}
        <View style={styles.detailsRow}>
          {/* Zone */}
          {parkingSlotId && (
            <View style={styles.detailsColumn}>
              <Text style={[styles.detailLabel, styles.primaryText]}>
                Zone
              </Text>

              <View style={styles.valueRow}>
                <IconButton
                  icon="car"
                  size={20}
                  iconColor="white"
                  style={styles.iconBox}
                />
                <Text style={[styles.detailValue, styles.primaryValue]}>
                  {zone}
                </Text>
              </View>
            </View>
          )}

          {/* Parking Number */}
          <View style={styles.detailsColumn}>
            <Text style={[styles.detailLabel, styles.primaryText]}>
              Parking Number
            </Text>

            <View style={styles.valueRow}>
              <IconButton
                icon="alpha-p"
                size={20}
                iconColor="white"
                style={styles.iconBox}
              />
              <Text style={[styles.detailValue, styles.primaryValue]}>
                {parkingNumber}
              </Text>
            </View>
          </View>
        </View>

        {/* Starting From */}
        <View style={styles.detailsColumn}>
          <Text style={[styles.detailLabel, styles.primaryText]}>
            Starting From
          </Text>

          <View style={styles.valueRow}>
            <IconButton
              icon="calendar-range"
              size={20}
              iconColor="white"
              style={styles.iconBox}
            />
            <Text style={[styles.detailValue, styles.primaryValue]}>
              {startingFrom}
            </Text>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.detailsColumn}>
          <Text style={[styles.detailLabel, styles.primaryText]}>
            Duration
          </Text>

          <View style={styles.valueRow}>
            <IconButton
              icon="calendar-range"
              size={20}
              iconColor="white"
              style={styles.iconBox}
            />
            <Text style={[styles.detailValue, styles.primaryValue]}>
              {duration}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default SessionDetails;

const styles = StyleSheet.create({
  detailsSection: {
    marginBottom: 16,
  },
  titleContainer: {
    backgroundColor: "#F5F5F5",
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
  },
  detailsContent: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailsColumn: {
    flex: 1,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  primaryText: {
    color: color.primary,
  },
  iconBox: {
    backgroundColor: "#F99006",
    borderRadius: 12,
  },
  primaryValue: {
    color: color.black,
    fontWeight: "400",
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
