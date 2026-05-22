import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "react-native-paper";
import colors from "../../assets/color";

interface ParkingSpotCardProps {
  type: "G" | "L" | "R";
  id?: string;
  title: string;
  address: string;
  duration: string;
  rating: string;
  price: number | string;
  selected: boolean;
  onSelect: () => void;
  onClick?: () => void;
  isMonthly?: boolean;
  monthlyRate?: number;
}

const ParkingSpotCard: React.FC<ParkingSpotCardProps> = ({
  type,
  id,
  title,
  address,
  duration,
  rating,
  price,
  selected,
  onSelect,
  onClick,
  isMonthly,
  monthlyRate,
}) => {
  const showMonthly = isMonthly && monthlyRate && monthlyRate > 0;

  return (
    <TouchableOpacity
      style={[styles.parkingCard, selected && styles.selectedCard]}
      onPress={onSelect}
    >
      <View style={styles.cardContent}>
        <View style={[styles.typeIndicator, { backgroundColor: colors.primary }]}>
          <Text style={styles.typeText}>{type}</Text>
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardAddress}>{address}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.cardMetrics}>
              <Icon source="clock-outline" size={16} color="#333" />
              <Text style={styles.durationText}>{duration}</Text>
              <View style={styles.ratingContainer}>
                <Icon source="star" size={16} color={colors.primary} />
                <Text style={styles.ratingText}> {rating}</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              {showMonthly ? (
                <>
                  <Text style={styles.priceText}>${monthlyRate}/mo</Text>
                  <Text style={styles.priceSubText}>${price}/hr</Text>
                </>
              ) : (
                <Text style={styles.priceText}>${price}/hr</Text>
              )}
            </View>
          </View>
          {/* Monthly badge */}
          {showMonthly && (
            <View style={styles.monthlyBadge}>
              <Text style={styles.monthlyBadgeText}>📅 Monthly plan available</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  parkingCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    marginBottom: 12,
    marginHorizontal: 8,
    padding: 16,
  },
  selectedCard: {
    backgroundColor: "#FFF3E9",
  },
  cardContent: {
    flexDirection: "row",
    gap: 16,
  },
  typeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 4,
  },
  cardAddress: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  durationText: {
    fontSize: 14,
    color: "#666666",
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 14,
    color: "#666666",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  priceSubText: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  monthlyBadge: {
    marginTop: 8,
    backgroundColor: colors.primary + "18",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.primary + "44",
  },
  monthlyBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "500",
  },
});

export default ParkingSpotCard;