import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import colors from "../../assets/color";
import { images } from "../../assets/images/images";
import Contact from "../../components/Garage/Conatact";

import axiosInstance from "../../api/axios";
import {
  GarageMerchantDetails,
  ParkingLot,
  Residence,
  User,
} from "../../types";

import { responsiveHeight } from "react-native-responsive-dimensions";

const GarageScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const lot =
    typeof params.lot === "string" ? JSON.parse(params.lot) : params.lot;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [merchantDetails, setMerchantDetails] = useState<
    | (Partial<GarageMerchantDetails> & { owner?: User } & Partial<ParkingLot> &
        Partial<Residence>)
    | null
  >(null);

  // Fetch merchant details
  useEffect(() => {
    if (!params.type || !lot?._id) return;

    const merchantType =
      params.type === "G"
        ? "garage"
        : params.type === "L"
        ? "parkinglot"
        : "residence";

    axiosInstance
      .get(`merchants/${merchantType}/${lot._id}`)
      .then((res) => {
        setMerchantDetails(res.data.data);
      })
      .catch((err) => console.log(err));
  }, [params, lot]);

  const handlePrevImage = () =>
    setCurrentImageIndex((prev) => Math.max(0, prev - 1));

  const handleNextImage = () =>
    setCurrentImageIndex((prev) =>
      Math.min(prev + 1, (merchantDetails?.images?.length || 0) - 1)
    );

  const ParkingInfoCard = useCallback(() => {
    const name =
      (params.type === "L" && lot?.parkingName) ||
      (params.type === "G" && lot?.garageName) ||
      (params.type === "R" && lot?.residenceName);

    return (
      <View style={styles.parkingInfoCard}>
        <View style={styles.typeIndicator}>
          <Text style={styles.typeText}>{params.type}</Text>
        </View>

        <View style={styles.infoContent}>
          <Text style={styles.parkingTitle}>{name || "Parking Location"}</Text>

          <Text style={styles.parkingAddress}>
            {lot?.address || "Address not provided"}
          </Text>

          <View style={styles.parkingMetrics}>
            <View style={styles.metric}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color="#666"
              />
              <Text style={styles.metricText}>5 min</Text>
            </View>

            <View style={styles.metric}>
              <MaterialCommunityIcons
                name="star"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.metricText}>4.2</Text>
            </View>

            <Text style={styles.priceText}>₹{lot?.price}/H</Text>
          </View>
        </View>
      </View>
    );
  }, [params, lot]);

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={28}
              color={colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Parking Details</Text>
        </View>

        {/* Image Gallery */}
        <View style={styles.imageGalleryContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={
                merchantDetails?.images
                  ? { uri: merchantDetails.images[currentImageIndex] }
                  : images.garage
              }
              style={styles.parkingImage}
            />
          </View>

          {(merchantDetails?.images?.length || 0) > 1 && (
            <>
              <TouchableOpacity
                style={[styles.arrowButton, styles.leftArrow]}
                onPress={handlePrevImage}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={26}
                  color="#FFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.arrowButton, styles.rightArrow]}
                onPress={handleNextImage}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={26}
                  color="#FFF"
                />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Parking Info Card */}
        <ParkingInfoCard />

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Parking Info</Text>

          <View style={styles.parkingCard}>
            <View style={styles.infoItem}>
              <Text style={styles.subTitle}>About :</Text>
              <Text style={styles.description}>
                {lot?.about || "No description provided."}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.subTitle}>Time Availability :</Text>
              <Text style={styles.availabilityText}>24 X 7</Text>
            </View>
          </View>
        </View>

        {/* Contact Info */}
        <Contact
          name={`${merchantDetails?.owner?.firstName || "User"} ${
            merchantDetails?.owner?.lastName || ""
          }`}
          phoneNo={
            merchantDetails?.contactNumber ||
            merchantDetails?.owner?.phoneNumber ||
            "+911234567890"
          }
        />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Price per Hour</Text>
          <Text style={styles.price}>₹{lot?.price}/H</Text>
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          onPress={() =>
            router.push({
              pathname: "/ParkingSpace",
              params: {
                type: params.type,
                lot: JSON.stringify(lot),
                endTime: params.endTime,
              },
            })
          }
        >
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ------------------ Styles ------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 60,
    marginTop: "20%",
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: "#000000",
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: 50,
  },
  imageGalleryContainer: {
    height: responsiveHeight(30),
    width: "90%",
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    alignSelf: "center",
    borderRadius: 50,
  },
  imageContainer: {
    height: 180,
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    overflow: "hidden",
  },
  parkingImage: {
    width: "100%",
    height: "100%",
  },
  parkingInfoCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 12,
  },
  parkingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  typeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  typeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoCard: {
    padding: 0, // Override padding from parkingInfoCard
  },
  infoSection: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: "#F5F5F5",
  },
  infoItem: {
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  parkingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 4,
  },
  parkingAddress: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  parkingMetrics: {
    flexDirection: "row",
    alignItems: "center",
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metricText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  // infoSection: {
  //   padding: 16,
  //   borderTopWidth: 8,
  //   borderTopColor: '#F5F5F5',
  // },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666666",
    lineHeight: 20,
  },
  availabilityText: {
    fontSize: 14,
    color: "#666666",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
  },
  contactImage: {
    marginRight: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contactDetails: {
    flex: 1,
    justifyContent: "center",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },
  contactPhone: {
    fontSize: 14,
    color: "#666666",
  },
  callButton: {
    backgroundColor: "#666666",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 16,
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneIcon: {
    margin: 0,
    padding: 0,
    marginLeft: -8,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666666",
  },
  price: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  arrowButton: {
    position: "absolute",
    top: "50%",
    marginTop: -22, // Adjust to vertically center
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  leftArrow: {
    left: -10,
  },
  rightArrow: {
    right: -10,
  },
});

export default GarageScreen;
