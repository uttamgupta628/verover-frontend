import React, { useEffect } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  StatusBar,
  StyleSheet,
  Text,
  Image,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppSelector } from "../components/redux/hooks";
import colors from "../assets/color";
import { images } from "../assets/images/images";
import CarRentalSlider from "../components/CarRentalSlider";

const { width, height } = Dimensions.get("window");
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFontSize = (size: number) => {
  const scale = Math.min(width / 375, height / 812);
  return size * scale;
};

export default function MerchantHome() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  // Check if user is actually a merchant
  useEffect(() => {
    if (user?.userType !== "merchant") {
      router.replace("/userHome");
    }
  }, [user]);

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated={true}
        backgroundColor="transparent"
      />

      {/* Header - Exact same layout as original */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <View style={styles.titleWrapper}>
          <Text style={styles.titleText}>Merchants - Home</Text>
        </View>
        <TouchableOpacity
          style={styles.scanContainer}
          onPress={() => {
            router.push("/scan");
          }}
        >
          <Image source={images.Scanner} style={styles.scanImage} />
          <Text style={styles.scanLabel}>Scan QBR</Text>
        </TouchableOpacity>
      </View>

      {/* Car Rental Slider */}
      <View style={styles.sliderWrapper}>
        <CarRentalSlider />
      </View>

      {/* First Row - Exact same spacing */}
      <View style={styles.firstRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            router.push("/parkingMerchent/merchantParkinglotList");
          }}
        >
          <Image source={images.MerchantParkLot} style={styles.parkLotImage} />
          <Text style={styles.buttonText}>Parking Lot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            router.push("/parkingMerchent/merchantGarageList");
          }}
        >
          <Image source={images.Parking} style={styles.parkingImage} />
          <Text style={styles.buttonText}>Parking Garage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            router.push("/parkingMerchent/merchantResidenceList");
          }}
        >
          <Image source={images.Parking} style={styles.parkingImage} />
          <Text style={styles.buttonText}>Residence Parking</Text>
        </TouchableOpacity>
      </View>

      {/* Second Row - Exact same spacing */}
      <View style={styles.secondRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            router.push("/dryCleanerMerchant/merchantAddDryCleaner");
          }}
        >
          <Image source={images.Cleaning} style={styles.cleaningImage} />
          <Text style={styles.buttonText}>Add Dry Cleaner</Text>
        </TouchableOpacity>
        {/* <TouchableOpacity
          style={styles.buttonMargin}
          onPress={() => {
            router.push("/dryCleanerMerchant");
          }}
        >
          <MaterialCommunityIcons
            name="plus-thick"
            size={30}
            color={colors.brandColor}
          />
          <Text style={styles.buttonText}>Add Parking</Text>
        </TouchableOpacity> */}
        <TouchableOpacity
          style={styles.buttonMargin}
          onPress={() => {
            router.push("/dryCleanerMerchant/orderHistory");
          }}
        >
          <MaterialCommunityIcons
            name="book-outline"
            size={30}
            color={colors.brandColor}
          />
          <Text style={styles.buttonText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { marginLeft: 20 }]}
          onPress={() => {
            router.push("/dryCleanerMerchant/myDryCleaners");
          }}
        >
          
          <Image source={images.Cleaning} style={styles.myCleaningImage} />
          <Text style={styles.buttonText}>My Dry Cleaners</Text>
        </TouchableOpacity>
      </View>

      {/* Third Row - Exact same spacing */}
      <View style={styles.thirdRow}>
        
        {/* Optional: Add more buttons here if needed */}
        <View style={styles.placeholderButton} />
        <View style={styles.placeholderButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: responsiveWidth(90),
    justifyContent: "space-between",
    marginTop: "0%",
  },
  titleWrapper: {
    width: responsiveWidth(60),
  },
  titleText: {
    fontSize: responsiveFontSize(20),
    color: colors.black,
    textAlign: "center",
  },
  scanContainer: {
    alignItems: "center",
  },
  scanImage: {
    width: responsiveWidth(8),
    height: responsiveHeight(4),
  },
  scanLabel: {
    color: colors.text,
    fontSize: responsiveFontSize(1.6),
  },
  sliderWrapper: {
    height: responsiveHeight(20),
    width: "100%",
  },
  firstRow: {
    marginTop: "10%",
    width: responsiveWidth(90),
    height: responsiveHeight(12),
    justifyContent: "space-between",
    flexDirection: "row",
  },
  secondRow: {
    marginTop: "5%",
    width: responsiveWidth(90),
    height: responsiveHeight(12),
    flexDirection: "row",
  },
  thirdRow: {
    marginTop: "5%",
    width: responsiveWidth(90),
    height: responsiveHeight(12),
    flexDirection: "row",
  },
  button: {
    backgroundColor: colors.white,
    width: "30%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonMargin: {
    backgroundColor: colors.white,
    width: "30%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
    marginLeft: "5%",
  },
  buttonText: {
    marginTop: "5%",
    color: colors.black,
    textAlign: "center",
    fontSize: responsiveFontSize(15),
  },
  parkLotImage: {
    width: "30%",
    height: "20%",
  },
  parkingImage: {
    width: "50%",
    height: "35%",
  },
  cleaningImage: {
    width: "35%",
    height: "35%",
  },
  myCleaningImage: {
    width: "40%",
    height: "40%",
  },
  placeholderButton: {
    width: "30%",
    height: "100%",
    marginLeft: "5%",
  },
});
