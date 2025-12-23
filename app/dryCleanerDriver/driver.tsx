import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AntDesign,
  MaterialIcons,
  Ionicons,
  FontAwesome5,
} from "@expo/vector-icons";
import { useSelector } from "react-redux";
import colors from "../../assets/color";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Redux interfaces
interface AuthState {
  token: string | null;
  user: any;
  isAuthenticated: boolean;
}

interface RootState {
  auth: AuthState;
}

// Driver Profile Interface
interface DriverProfile {
  _id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phoneNumber: string;
  country: string;
  state: string;
  zipCode: string;
  driveProfileImage?: string;
  driverLicenseImage?: string;
  driverCertificationImage?: string;
  licenseNumber: string;
  expirationDate: string;
  isVerified: boolean;
  kidsFriendly: boolean;
  carSeatsAvailable: boolean;
  availability: string[];
  vehicleInfo: {
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear: number;
    noOfDoors: number;
    vehicleColor: string;
    noOfSeats: number;
    noOfBooster: number;
    vehicleNumber: string;
    registrationNumber: string;
    insuranceProviderCompany: string;
    insuranceNumber: string;
    vehicleInspectionImage: string;
    vehicleInsuranceImage: string;
    localCertificate: string;
  };
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    creditCardImage: string;
  };
  attestation: {
    consentBackgroundCheck: boolean;
    completeASafetyHoldings: boolean;
    agreeToTerms: boolean;
    attestationDate: string;
    electronicSignature: string;
  };
  backgroudCheck: {
    checker: boolean;
    safetHolder: boolean;
  };
}

const DriverProfileScreen: React.FC = () => {
  const router = useRouter();
  const { token, user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [imageModalVisible, setImageModalVisible] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string>("");

  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert("Authentication Required", "Please login to continue", [
        { text: "OK", onPress: () => router.push("/Login") },
      ]);
      return;
    }
    fetchDriverProfile();
  }, [isAuthenticated, token]);

  const makeApiRequest = async (
    endpoint: string,
    options: RequestInit = {}
  ) => {
    const API_BASE_URL = "http://192.168.29.162:5000/api";
    const url = `${API_BASE_URL}${endpoint}`;

    const defaultHeaders: any = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error("API Request Error:", error);
      throw error;
    }
  };

  const fetchDriverProfile = async () => {
    try {
      setLoading(true);
      const data = await makeApiRequest("/users/driver/profile", {
        method: "GET",
      });

      if (data.success && data.data?.driver) {
        setDriverProfile(data.data.driver);
      } else {
        Alert.alert("Error", "Failed to load driver profile");
      }
    } catch (error: any) {
      console.error("Fetch driver profile error:", error);
      Alert.alert("Error", error.message || "Failed to load driver profile");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDriverProfile();
    setRefreshing(false);
  };

  const openDetailModal = (section: string) => {
    setSelectedSection(section);
    setModalVisible(true);
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const parseAvailability = (availability: string[]) => {
    if (!availability || availability.length === 0) return [];
    try {
      // Handle the malformed array format from the API
      const joined = availability.join("");
      const cleaned = joined.replace(/[\[\]"]/g, "");
      return cleaned.split(",").filter(Boolean);
    } catch {
      return [];
    }
  };

  const renderDetailModal = () => {
    if (!driverProfile) return null;

    let content = null;

    switch (selectedSection) {
      case "personal":
        content = (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Personal Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Full Name:</Text>
              <Text style={styles.detailValue}>
                {`${driverProfile.firstName} ${
                  driverProfile.middleName || ""
                } ${driverProfile.lastName}`.trim()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{driverProfile.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.phoneNumber}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address:</Text>
              <Text style={styles.detailValue}>
                {`${driverProfile.state}, ${driverProfile.country} - ${driverProfile.zipCode}`}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>License Number:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.licenseNumber}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>License Expiry:</Text>
              <Text style={styles.detailValue}>
                {formatDate(driverProfile.expirationDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verified:</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: driverProfile.isVerified ? "#4CAF50" : "#FF4444" },
                ]}
              >
                {driverProfile.isVerified ? "Yes" : "No"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kids Friendly:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.kidsFriendly ? "Yes" : "No"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Car Seats Available:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.carSeatsAvailable ? "Yes" : "No"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Availability:</Text>
              <Text style={styles.detailValue}>
                {parseAvailability(driverProfile.availability).join(", ") ||
                  "Not set"}
              </Text>
            </View>

            {/* Document Images */}
            <Text style={styles.sectionTitle}>Documents</Text>
            <View style={styles.imageGrid}>
              {driverProfile.driverLicenseImage && (
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(driverProfile.driverLicenseImage!)
                  }
                >
                  <Image
                    source={{ uri: driverProfile.driverLicenseImage }}
                    style={styles.thumbnail}
                  />
                  <Text style={styles.imageLabel}>License</Text>
                </TouchableOpacity>
              )}
              {driverProfile.driverCertificationImage && (
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(driverProfile.driverCertificationImage!)
                  }
                >
                  <Image
                    source={{ uri: driverProfile.driverCertificationImage }}
                    style={styles.thumbnail}
                  />
                  <Text style={styles.imageLabel}>Certification</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
        break;

      case "vehicle":
        content = (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vehicle Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Brand & Model:</Text>
              <Text style={styles.detailValue}>
                {`${driverProfile.vehicleInfo.vehicleBrand} ${driverProfile.vehicleInfo.vehicleModel}`}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Year:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.vehicleYear}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Color:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.vehicleColor}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Doors:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.noOfDoors}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Seats:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.noOfSeats}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Boosters:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.noOfBooster}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>VIN:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.vehicleNumber}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registration:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.registrationNumber}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Insurance Provider:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.insuranceProviderCompany}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Insurance Number:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.vehicleInfo.insuranceNumber}
              </Text>
            </View>

            {/* Vehicle Images */}
            <Text style={styles.sectionTitle}>Vehicle Documents</Text>
            <View style={styles.imageGrid}>
              {driverProfile.vehicleInfo.vehicleInspectionImage && (
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(
                      driverProfile.vehicleInfo.vehicleInspectionImage
                    )
                  }
                >
                  <Image
                    source={{
                      uri: driverProfile.vehicleInfo.vehicleInspectionImage,
                    }}
                    style={styles.thumbnail}
                  />
                  <Text style={styles.imageLabel}>Inspection</Text>
                </TouchableOpacity>
              )}
              {driverProfile.vehicleInfo.vehicleInsuranceImage && (
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(
                      driverProfile.vehicleInfo.vehicleInsuranceImage
                    )
                  }
                >
                  <Image
                    source={{
                      uri: driverProfile.vehicleInfo.vehicleInsuranceImage,
                    }}
                    style={styles.thumbnail}
                  />
                  <Text style={styles.imageLabel}>Insurance</Text>
                </TouchableOpacity>
              )}
              {driverProfile.vehicleInfo.localCertificate && (
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(driverProfile.vehicleInfo.localCertificate)
                  }
                >
                  <Image
                    source={{ uri: driverProfile.vehicleInfo.localCertificate }}
                    style={styles.thumbnail}
                  />
                  <Text style={styles.imageLabel}>Certificate</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
        break;

      case "bank":
        content = (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bank Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Holder:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.bankDetails.accountHolderName}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Number:</Text>
              <Text style={styles.detailValue}>
                {"*".repeat(driverProfile.bankDetails.accountNumber.length - 4)}
                {driverProfile.bankDetails.accountNumber.slice(-4)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Routing Number:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.bankDetails.routingNumber}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank Name:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.bankDetails.bankName}
              </Text>
            </View>

            {driverProfile.bankDetails.creditCardImage && (
              <>
                <Text style={styles.sectionTitle}>Card Image</Text>
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(driverProfile.bankDetails.creditCardImage)
                  }
                >
                  <Image
                    source={{ uri: driverProfile.bankDetails.creditCardImage }}
                    style={styles.largeThumbnail}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        );
        break;

      case "attestation":
        content = (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Attestation & Background Check
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Background Check Consent:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.attestation.consentBackgroundCheck
                  ? "✓ Yes"
                  : "✗ No"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Safety Holdings Complete:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.attestation.completeASafetyHoldings
                  ? "✓ Yes"
                  : "✗ No"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Terms Agreed:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.attestation.agreeToTerms ? "✓ Yes" : "✗ No"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Attestation Date:</Text>
              <Text style={styles.detailValue}>
                {formatDate(driverProfile.attestation.attestationDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Background Checker:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.backgroudCheck.checker
                  ? "✓ Verified"
                  : "✗ Not Verified"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Safety Holder:</Text>
              <Text style={styles.detailValue}>
                {driverProfile.backgroudCheck.safetHolder
                  ? "✓ Verified"
                  : "✗ Not Verified"}
              </Text>
            </View>

            {driverProfile.attestation.electronicSignature && (
              <>
                <Text style={styles.sectionTitle}>Electronic Signature</Text>
                <TouchableOpacity
                  onPress={() =>
                    openImageModal(
                      driverProfile.attestation.electronicSignature
                    )
                  }
                >
                  <Image
                    source={{
                      uri: driverProfile.attestation.electronicSignature,
                    }}
                    style={styles.largeThumbnail}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        );
        break;
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <AntDesign name="close" size={24} color="#666" />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false}>
              {content}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderImageModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={imageModalVisible}
      onRequestClose={() => setImageModalVisible(false)}
    >
      <View style={styles.imageModalOverlay}>
        <TouchableOpacity
          style={styles.imageCloseButton}
          onPress={() => setImageModalVisible(false)}
        >
          <AntDesign name="close" size={32} color="#fff" />
        </TouchableOpacity>
        <Image
          source={{ uri: selectedImage }}
          style={styles.fullImage}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );

  if (!isAuthenticated || !token) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Please login to continue</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push("/Login")}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !driverProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading driver profile...</Text>
      </View>
    );
  }

  if (!driverProfile) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="error-outline" size={64} color="#999" />
        <Text style={styles.loadingText}>No driver profile found</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchDriverProfile}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={35} color="#FF8C00" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Profile</Text>
        <TouchableOpacity onPress={fetchDriverProfile}>
          <MaterialIcons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            {driverProfile.driveProfileImage ? (
              <Image
                source={{ uri: driverProfile.driveProfileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <FontAwesome5 name="user" size={50} color="#999" />
              </View>
            )}
            {driverProfile.isVerified && (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={24} color="#4CAF50" />
              </View>
            )}
          </View>
          <Text style={styles.profileName}>
            {`${driverProfile.firstName} ${driverProfile.lastName}`}
          </Text>
          <Text style={styles.profileEmail}>{driverProfile.email}</Text>
          <Text style={styles.profilePhone}>{driverProfile.phoneNumber}</Text>
        </View>

        {/* Info Cards */}
        <View style={styles.cardsContainer}>
          {/* Personal Info Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDetailModal("personal")}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <FontAwesome5
                  name="user-circle"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <AntDesign name="right" size={20} color="#999" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardText}>
                License: {driverProfile.licenseNumber}
              </Text>
              <Text style={styles.cardText}>
                Location: {driverProfile.state}, {driverProfile.country}
              </Text>
              <Text style={styles.cardText}>
                Verified: {driverProfile.isVerified ? "✓ Yes" : "✗ No"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Vehicle Info Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDetailModal("vehicle")}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="car-sport" size={24} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Vehicle Information</Text>
              <AntDesign name="right" size={20} color="#999" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardText}>
                {driverProfile.vehicleInfo.vehicleYear}{" "}
                {driverProfile.vehicleInfo.vehicleBrand}{" "}
                {driverProfile.vehicleInfo.vehicleModel}
              </Text>
              <Text style={styles.cardText}>
                Color: {driverProfile.vehicleInfo.vehicleColor}
              </Text>
              <Text style={styles.cardText}>
                Seats: {driverProfile.vehicleInfo.noOfSeats} | Boosters:{" "}
                {driverProfile.vehicleInfo.noOfBooster}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Bank Details Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDetailModal("bank")}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <FontAwesome5
                  name="university"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.cardTitle}>Bank Details</Text>
              <AntDesign name="right" size={20} color="#999" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardText}>
                Account Holder: {driverProfile.bankDetails.accountHolderName}
              </Text>
              <Text style={styles.cardText}>
                Bank: {driverProfile.bankDetails.bankName}
              </Text>
              <Text style={styles.cardText}>
                Account: ••••{" "}
                {driverProfile.bankDetails.accountNumber.slice(-4)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Attestation Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDetailModal("attestation")}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <MaterialIcons
                  name="verified-user"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.cardTitle}>Attestation & Checks</Text>
              <AntDesign name="right" size={20} color="#999" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardText}>
                Background Check:{" "}
                {driverProfile.backgroudCheck.checker
                  ? "✓ Passed"
                  : "✗ Pending"}
              </Text>
              <Text style={styles.cardText}>
                Safety Holder:{" "}
                {driverProfile.backgroudCheck.safetHolder
                  ? "✓ Verified"
                  : "✗ Not Verified"}
              </Text>
              <Text style={styles.cardText}>
                Terms:{" "}
                {driverProfile.attestation.agreeToTerms
                  ? "✓ Agreed"
                  : "✗ Not Agreed"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderDetailModal()}
      {renderImageModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    marginTop: Platform.OS === "ios" ? 50 : 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "600",
    flex: 1,
    marginLeft: 15,
  },
  profileHeader: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  placeholderImage: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 2,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },
  profilePhone: {
    fontSize: 14,
    color: "#666",
  },
  cardsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + "20", // 20 for 12% opacity
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },
  cardContent: {
    paddingLeft: 52, // 40 (icon width) + 12 (marginRight)
  },
  cardText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 40,
    paddingBottom: 20,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 15,
    zIndex: 1,
    padding: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 20,
    textAlign: "center",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    marginTop: 24,
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + "30",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  thumbnail: {
    width: (SCREEN_WIDTH - 80) / 2,
    height: 120,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  imageLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  largeThumbnail: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    alignSelf: "center",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageCloseButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    zIndex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  fullImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
    borderRadius: 10,
  },
});

export default DriverProfileScreen;
