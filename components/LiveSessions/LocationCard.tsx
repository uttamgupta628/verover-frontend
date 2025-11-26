import { StyleSheet, Text, View } from "react-native";
import React from "react";
import color from "../../assets/color";

interface LocationProps {
  name?: string;
  address?: string;
  rate?: number;
  price?: number;
}

const LocationCard = ({
  name = "Central Shopping Centre (Garage)",
  address = "123, Lincoln Street, New York",
  rate = 4.2,
  price = 5.0,
}: LocationProps) => {
  return (
    <View style={styles.locationCard}>
      {/* Initial Circle */}
      <View style={styles.locationInitial}>
        <Text style={styles.initialText}>
          {name?.charAt(0)?.toUpperCase() || "G"}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.locationDetails}>
        <Text style={styles.locationName}>{name}</Text>
        <Text style={styles.locationAddress}>{address}</Text>

        <View style={styles.locationMeta}>
          <Text style={styles.meta}>5 min</Text>
          <Text style={styles.rating}>⭐ {rate}</Text>
          <Text style={styles.price}>${price.toFixed(2)}/H</Text>
        </View>
      </View>
    </View>
  );
};

export default LocationCard;

const styles = StyleSheet.create({
  locationCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    flexDirection: "row",
    marginTop: "5%",
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  locationInitial: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  initialText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  locationDetails: {
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
  locationMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  meta: {
    fontSize: 14,
    color: "#666666",
  },
  rating: {
    fontSize: 14,
    color: "#666666",
  },
  price: {
    fontSize: 14,
    color: color.primary,
    fontWeight: "600",
  },
});
