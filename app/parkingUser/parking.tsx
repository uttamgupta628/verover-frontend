// src/pages/Parking.tsx
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { StyleSheet, View } from "react-native";

import MenuGrid from "../../components/MenuGrid";
import ParkingTitle from "../../components/ParkingTitle";
import { ParkingViewType } from "../../components/Types";

const Parking: React.FC = () => {
  const router = useRouter();

  const handleNavigate = (screen: ParkingViewType) => {
    switch (screen) {
      case "qrCode":
        router.push("/QRCode");
        break;
      case "history":
        router.push("/parkingUser/historyScreen");
        break;
      case "liveSession":
        router.push("/parkingUser/LiveSessionScreen");
        break;
      case "findParking":
        router.push("/parkingUser/FindParking");
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      <View style={styles.mainContent}>
        <ParkingTitle onBack={() => router.back()} />
        <MenuGrid />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  mainContent: {
    paddingHorizontal: 16,
    marginTop: -20,
    paddingTop: 36,
  },
});

export default Parking;
