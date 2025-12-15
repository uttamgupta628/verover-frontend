// src/components/MenuGrid/MenuGrid.tsx
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import MenuItem from "../components/MenuItem";

const MenuGrid: React.FC = () => {
  const router = useRouter();

  return (
    <View style={styles.menuGrid}>
      <MenuItem
        icon="car"
        label="Find Parking"
        onPress={() => router.push("/parkingUser/FindParking")}
      />

      <MenuItem
        icon="clock"
        label="Live Session"
        onPress={() => router.push("/parkingUser/LiveSessionScreen")}
      />

      <MenuItem
        icon="history"
        label="History"
        onPress={() => router.push("/parkingUser/historyScreen")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
});

export default MenuGrid;
