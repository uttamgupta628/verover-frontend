import React, { useEffect } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  Image,
  View,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import colors from "../assets/color";
import SwiperComponent from "./SwiperComponent";
import { images } from "../assets/images/images";

export default function OnboardingScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/login");
  };

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated={true}
        backgroundColor="transparent"
      />

      {/* V LOGO */}
      <View style={styles.logoContainer}>
        <Image
          source={images.Vlogo}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* SWIPER TEXT */}
      <View style={styles.textContainer}>
        <SwiperComponent />
      </View>

      {/* CAR IMAGE */}
      <View style={styles.carImageContainer}>
        <Image
          source={images.Car}
          style={styles.carImage}
          resizeMode="contain"
        />
      </View>

      {/* CURVE DESIGN */}
      <View style={styles.curveContainer}>
        <Image
          source={images.Curve}
          style={styles.curveImage}
          resizeMode="contain"
        />
      </View>

      {/* GET STARTED BUTTON */}
      <TouchableOpacity
        onPress={handleGetStarted}
        style={styles.getStartedButton}
        activeOpacity={0.7}
      >
        <View>
          <Text style={styles.getStartedText}>Get Started</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  // Logo
  logoContainer: {
    width: responsiveWidth(50),
    alignSelf: "flex-start",
    marginTop: responsiveHeight(10),
    height: responsiveHeight(20),
    marginLeft: responsiveWidth(7),
  },
  logoImage: {
    width: "60%",
    height: "100%",
  },

  // Text/Swiper container
  textContainer: {
    height: responsiveHeight(20),
    width: responsiveWidth(60),
    alignSelf: "flex-start",
    marginLeft: responsiveWidth(10),
  },

  // Car image
  carImageContainer: {
    height: responsiveHeight(35),
    width: responsiveWidth(100),
  },
  carImage: {
    width: "100%",
    height: "100%",
  },

  // Curve design
  curveContainer: {
    width: responsiveWidth(95),
    alignSelf: "flex-end",
    height: responsiveHeight(30),
    position: "absolute",
    bottom: -30,
    zIndex: 2,
  },
  curveImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },

  // Get Started button
  getStartedButton: {
    flexDirection: "row",
    position: "absolute",
    bottom: responsiveHeight(4),
    right: responsiveWidth(5),
    alignItems: "center",

    zIndex: 5,
  },

  getStartedText: {
    fontSize: responsiveFontSize(2.2),
    color: colors.white,
    fontWeight: "bold",
  },

  arrow: {
    fontSize: responsiveFontSize(2.5),
    color: colors.white,
    marginLeft: 5,
  },
});
