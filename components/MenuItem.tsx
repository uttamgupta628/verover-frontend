import React from "react";
import { StyleSheet, View, TouchableOpacity, Text, Image } from "react-native";
import { images } from "../assets/images/images"
// import colors from "../../assets/color";

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onPress }) => {
  // Cleaner icon resolver
  const getIcon = () => {
    switch (icon) {
      case "car":
        return images.Parking;
      case "qrcode":
        return images.Scanner;
      case "clock":
        return images.live;
      case "history":
      default:
        return images.history;
    }
  };

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Image source={getIcon()} style={styles.menuImage} resizeMode="contain" />
      </View>

      <Text style={styles.menuLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
    margin: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    elevation: 4, // Works on Android only (still OK in Expo)
  },
  menuIconContainer: {
    marginBottom: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "400",
    color: "#333333",
    textAlign: "center",
  },
  menuImage: {
    width: 48,
    height: 48,
  },
});

export default MenuItem;
