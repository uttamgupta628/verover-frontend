import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "react-native-paper";
import { useRouter } from "expo-router";
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
}) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.parkingCard, selected && styles.selectedCard]}
      onPress={onSelect}
    >
      <View style={styles.cardContent}>
        <View
          style={[styles.typeIndicator, { backgroundColor: colors.primary }]}
        >
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

            <Text style={styles.priceText}>${price}/H</Text>
          </View>
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
  priceText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
});

export default ParkingSpotCard;


