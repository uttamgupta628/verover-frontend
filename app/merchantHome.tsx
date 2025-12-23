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
  SafeAreaView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useAppSelector } from "../components/redux/hooks";
import colors from "../assets/color";
import { images } from "../assets/images/images";
import CarRentalSlider from "../components/CarRentalSlider";

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated={true}
        backgroundColor="transparent"
        translucent={Platform.OS === 'android'}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color={colors.brandColor} />
          </TouchableOpacity>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Merchants - Home</Text>
          </View>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push("/scan")}
          >
            <Image source={images.Scanner} style={styles.scanImage} />
            <Text style={styles.scanLabel}>Scan QBR</Text>
          </TouchableOpacity>
        </View>

        {/* Slider Section */}
        <View style={styles.sliderContainer}>
          <CarRentalSlider />
        </View>

        {/* Services Title */}
        <View style={styles.servicesTitleContainer}>
          <Text style={styles.servicesTitle}>Merchant Services</Text>
          <Text style={styles.servicesSubtitle}>Manage your business</Text>
        </View>

        {/* Services Grid */}
        <View style={styles.servicesContainer}>
          {/* Parking Services */}
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/parkingMerchent/merchantParkinglotList")}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.MerchantParkLot} style={styles.parkLotImage} />
            </View>
            <Text style={styles.serviceCardText}>Parking Lot</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/parkingMerchent/merchantGarageList")}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Parking} style={styles.parkingImage} />
            </View>
            <Text style={styles.serviceCardText}>Parking Garage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/parkingMerchent/merchantResidenceList")}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Parking} style={styles.parkingImage} />
            </View>
            <Text style={styles.serviceCardText}>Residence Parking</Text>
          </TouchableOpacity>

          {/* Dry Cleaner Services */}
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/dryCleanerMerchant/merchantAddDryCleaner")}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Cleaning} style={styles.cleaningImage} />
            </View>
            <Text style={styles.serviceCardText}>Add Dry Cleaner</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/dryCleanerMerchant/orderHistory")}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialCommunityIcons
                name="book-outline"
                size={responsiveWidth(10)}
                color={colors.brandColor}
              />
            </View>
            <Text style={styles.serviceCardText}>DryCleaner History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/dryCleanerMerchant/myDryCleaners")}
          >
            <View style={styles.serviceIconContainer}>
              <Image source={images.Cleaning} style={styles.myCleaningImage} />
            </View>
            <Text style={styles.serviceCardText}>My Dry Cleaners</Text>
          </TouchableOpacity>

          {/* History */}
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/parkingMerchent/order")}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialCommunityIcons
                name="book-outline"
                size={responsiveWidth(10)}
                color={colors.brandColor}
              />
            </View>
            <Text style={styles.serviceCardText}>Parking History</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white || '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: responsiveHeight(3),
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: responsiveWidth(5),
    paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
    paddingBottom: responsiveHeight(2),
  },
  backButton: {
    padding: responsiveWidth(2),
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: responsiveWidth(2),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.4),
    color: colors.black || '#000000',
    fontWeight: '600',
    textAlign: 'center',
  },
  scanButton: {
    alignItems: 'center',
    padding: responsiveWidth(2),
  },
  scanImage: {
    width: responsiveWidth(8),
    height: responsiveWidth(8),
    resizeMode: 'contain',
  },
  scanLabel: {
    color: colors.text || '#666666',
    fontSize: responsiveFontSize(1.4),
    marginTop: responsiveHeight(0.5),
  },

  // Slider Styles
  sliderContainer: {
    height: responsiveHeight(22),
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(2),
  },

  // Services Title
  servicesTitleContainer: {
    paddingHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(2),
  },
  servicesTitle: {
    fontSize: responsiveFontSize(2.4),
    color: colors.black || '#000000',
    fontWeight: '600',
    marginBottom: responsiveHeight(0.5),
  },
  servicesSubtitle: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray || '#666666',
    fontWeight: '400',
  },

  // Services Container
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: responsiveWidth(3),
    justifyContent: 'space-between',
  },

  // Service Card Styles
  serviceCard: {
    backgroundColor: colors.white || '#FFFFFF',
    width: responsiveWidth(29),
    minHeight: responsiveHeight(16),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(2),
    marginBottom: responsiveHeight(2),
    marginHorizontal: responsiveWidth(1),
    
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    
    // Shadow for Android
    elevation: 6,
  },
  serviceIconContainer: {
    width: '100%',
    height: responsiveHeight(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveHeight(1),
  },
  serviceCardText: {
    marginTop: responsiveHeight(0.5),
    fontSize: responsiveFontSize(1.6),
    color: colors.black || '#000000',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: responsiveFontSize(2),
  },

  // Image Styles
  parkLotImage: {
    width: '40%',
    height: '60%',
    resizeMode: 'contain',
  },
  parkingImage: {
    width: '60%',
    height: '80%',
    resizeMode: 'contain',
  },
  cleaningImage: {
    width: '50%',
    height: '70%',
    resizeMode: 'contain',
  },
  myCleaningImage: {
    width: '55%',
    height: '75%',
    resizeMode: 'contain',
  },

  // Bottom Spacing
  bottomSpacing: {
    height: responsiveHeight(2),
  },
});