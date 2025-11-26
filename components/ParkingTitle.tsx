import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import colors from "../assets/color";

interface ParkingTitleProps {
  onBack: () => void;
}

const ParkingTitle: React.FC<ParkingTitleProps> = ({ onBack }) => (
  <View style={styles.titleContainer}>
    <TouchableOpacity onPress={onBack} style={styles.backButton}>
      <MaterialCommunityIcons
        name="arrow-left"
        size={30}
        color={colors.primary}
      />
    </TouchableOpacity>

    <View>
      <Text style={styles.title}>Parking</Text>
      <Text style={styles.subtitle}>Find And Book Parking Near You</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: "20%",
    marginBottom: 24,
  },
  backButton: {
    marginRight: 8,
    marginTop: -10,
  },
  title: {
    fontSize: 24,
    fontWeight: "400",
    color: "#333333",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
  },
});

export default ParkingTitle;
