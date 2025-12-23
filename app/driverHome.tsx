import React from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  Image,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import CarRentalSlider from "../components/CarRentalSlider";
import colors from "../assets/color";
import { images } from "../assets/images/images";

export default function DriverMainHome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // Helper functions for responsive design
  const responsiveWidth = (value: number) => (value * width) / 100;
  const responsiveHeight = (value: number) => (value * height) / 100;
  const responsiveFontSize = (value: number) =>
    Math.round((value * width) / 100);

  // Calculate button size based on screen width
  const buttonSize = width < 768 ? "small" : width < 1024 ? "medium" : "large";

  const styles = createStyles({
    responsiveWidth,
    responsiveHeight,
    responsiveFontSize,
    buttonSize,
    width,
    height,
  });

  const renderButton = (
    onPress: () => void,
    imageSource: any,
    text: string,
    imageStyle?: any
  ) => (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Image
        source={imageSource}
        style={[styles.buttonImage, imageStyle]}
        resizeMode="contain"
      />
      <Text style={styles.buttonText} numberOfLines={2} adjustsFontSizeToFit>
        {text}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Driver - Home</Text>
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => router.push("/scan")}
        >
          <Image
            source={images.Scanner}
            style={styles.scanImage}
            resizeMode="contain"
          />
          <Text style={styles.scanText}>Scan QBR</Text>
        </TouchableOpacity>
      </View>

      {/* Slider Section */}
      <View style={styles.sliderContainer}>
        <CarRentalSlider />
      </View>

      {/* Buttons Grid - Responsive layout */}
      <View style={styles.buttonsGrid}>
        {/* Row 1 */}
        <View style={styles.buttonRow}>
          {/* {renderButton(
            () => router.push('/RideTrackingLocate'),
            images.Ride,
            'Locate Rider'
          )} */}
          {renderButton(
            () => router.push("/dryCleanerDriver/orderRequest"),
            images.Cleaning,
            "Dry Cleaning",
            styles.cleaningImage
          )}
          {renderButton(
            () => router.push("/dryCleanerDriver/driverHistory"),
            images.Cleaning,
            "Driver History",
            styles.cleaningImage
          )}
          {renderButton(
            () => router.push("/dryCleanerDriver/Vehicleinfo"),
            images.Ride,
            "Driver Registration"
          )}
          {renderButton(
            () => router.push("dryCleanerDriver/driver"),
            images.Ride,
            "My Info",
            styles.foodImage
          )}
        </View>

        {/* Row 2 */}
        <View style={styles.buttonRow}>
          {/* {renderButton(
            () => router.push('/QRCode'),
            images.Scanner,
            'Scan QBR',
            styles.scanButtonImage
          )} */}
          {/* {renderButton(
            () => router.push('/MicroMobility'),
            images.MicroMobility,
            'Micro Mobility',
            styles.microImage
          )} */}
        </View>

        {/* Row 3 - Single button centered on mobile, full width on larger screens */}
        <View style={styles.singleButtonRow}></View>
      </View>
    </ScrollView>
  );
}

interface StyleProps {
  responsiveWidth: (value: number) => number;
  responsiveHeight: (value: number) => number;
  responsiveFontSize: (value: number) => number;
  buttonSize: "small" | "medium" | "large";
  width: number;
  height: number;
}

const createStyles = ({
  responsiveWidth,
  responsiveHeight,
  responsiveFontSize,
  buttonSize,
  width,
  height,
}: StyleProps) => {
  const isSmallScreen = width < 768;
  const isMediumScreen = width >= 768 && width < 1024;
  const isLargeScreen = width >= 1024;

  const buttonWidth = isSmallScreen
    ? responsiveWidth(30)
    : isMediumScreen
    ? responsiveWidth(28)
    : responsiveWidth(25);

  const buttonHeight = isSmallScreen
    ? responsiveHeight(12)
    : isMediumScreen
    ? responsiveHeight(10)
    : responsiveHeight(8);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },
    contentContainer: {
      flexGrow: 1,
      alignItems: "center",
      paddingBottom: responsiveHeight(5),
      paddingHorizontal: isSmallScreen
        ? responsiveWidth(5)
        : isMediumScreen
        ? responsiveWidth(10)
        : responsiveWidth(15),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginTop: responsiveHeight(isSmallScreen ? 3 : 5),
      marginBottom: responsiveHeight(2),
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: responsiveFontSize(
        isSmallScreen ? 5 : isMediumScreen ? 4.5 : 4
      ),
      color: colors.black,
      fontWeight: "600",
    },
    scanButton: {
      alignItems: "center",
      justifyContent: "center",
      padding: responsiveWidth(2),
      marginLeft: responsiveWidth(2),
    },
    scanImage: {
      width: responsiveWidth(isSmallScreen ? 8 : 7),
      height: responsiveHeight(isSmallScreen ? 4 : 3.5),
      marginBottom: responsiveHeight(0.5),
    },
    scanText: {
      color: colors.text,
      fontSize: responsiveFontSize(isSmallScreen ? 3 : 2.8),
      textAlign: "center",
    },
    sliderContainer: {
      width: "100%",
      height: responsiveHeight(isSmallScreen ? 20 : isMediumScreen ? 18 : 16),
      marginBottom: responsiveHeight(3),
    },
    buttonsGrid: {
      width: "100%",
      maxWidth: 1200,
      alignSelf: "center",
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      width: "100%",
      marginBottom: responsiveHeight(3),
    },

    singleButtonRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      marginTop: responsiveHeight(1),
    },
    button: {
      backgroundColor: colors.white,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: responsiveWidth(4),
      shadowColor: "#000",
      shadowOffset: {
        width: responsiveWidth(0.5),
        height: responsiveHeight(0.5),
      },
      shadowOpacity: 0.2,
      shadowRadius: responsiveWidth(2),
      elevation: 5,
      padding: responsiveWidth(3),
      width: buttonWidth,
      height: buttonHeight,
      minHeight: responsiveHeight(10),

      alignSelf: "center",
      marginBottom: isSmallScreen ? responsiveHeight(3) : responsiveHeight(1),
    },
    buttonImage: {
      width: responsiveWidth(isSmallScreen ? 12 : 10),
      height: responsiveHeight(isSmallScreen ? 6 : 5),
      marginBottom: responsiveHeight(1),
    },
    cleaningImage: {
      width: responsiveWidth(isSmallScreen ? 10 : 9),
      height: responsiveHeight(isSmallScreen ? 6 : 5.5),
    },
    foodImage: {
      width: responsiveWidth(isSmallScreen ? 11 : 10),
      height: responsiveHeight(isSmallScreen ? 6 : 5.5),
    },
    microImage: {
      width: responsiveWidth(isSmallScreen ? 11 : 10),
      height: responsiveHeight(isSmallScreen ? 6.5 : 6),
    },
    scanButtonImage: {
      width: responsiveWidth(isSmallScreen ? 10 : 9),
      height: responsiveHeight(isSmallScreen ? 5 : 4.5),
    },
    buttonText: {
      color: colors.black,
      fontSize: responsiveFontSize(isSmallScreen ? 3.5 : 3.2),
      fontWeight: "500",
      textAlign: "center",
      lineHeight: responsiveFontSize(4),
      marginTop: responsiveHeight(0.5),
    },
  });
};
