import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import RNPickerSelect from "react-native-picker-select";
import * as ImagePicker from "expo-image-picker";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import colors from "../../assets/color";

import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// Responsive helper functions
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const responsiveWidth = (percentage: number) =>
  (percentage * SCREEN_WIDTH) / 100;
const responsiveHeight = (percentage: number) =>
  (percentage * SCREEN_WIDTH) / 100; // Using width for consistency
const responsiveFontSize = (percentage: number) =>
  Math.round((percentage * SCREEN_WIDTH) / 100);

// Redux interfaces
interface AuthState {
  token: string | null;
  user: any;
  isAuthenticated: boolean;
}

interface RootState {
  auth: AuthState;
}

// Interfaces
interface VehicleInfo {
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  noOfDoors: number;
  vehicleColor: string;
  noOfSeats: number;
  noOfBooster: number;
  vehicleNumber: string;
  registrationNumber: string;
  vehicleInspectionImage: string;
  vehicleInsuranceImage: string;
  localCertificate: string;
  insuranceProviderCompany: string;
  insuranceNumber: string;
}

interface DropdownProps {
  label: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

interface UploadedImages {
  inspection: string[];
  insurance: string[];
  certification: string[];
}

// Reusable Dropdown Component
const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = "Select...",
}) => {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dropdownContainer}>
        <RNPickerSelect
          onValueChange={(value) => onSelect(value)}
          items={options}
          value={selectedValue}
          style={pickerSelectStyles}
          placeholder={{ label: placeholder, value: "" }}
        />
      </View>
    </View>
  );
};

const VehicleInfoScreen: React.FC = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Redux state
  const { token, user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  // State for vehicle info
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    vehicleBrand: "",
    vehicleModel: "",
    vehicleYear: new Date().getFullYear() - 5,
    noOfDoors: 4,
    vehicleColor: "",
    noOfSeats: 5,
    noOfBooster: 0,
    vehicleNumber: "",
    registrationNumber: "",
    vehicleInspectionImage: "",
    vehicleInsuranceImage: "",
    localCertificate: "",
    insuranceProviderCompany: "",
    insuranceNumber: "",
  });

  const [uploadedImages, setUploadedImages] = useState<UploadedImages>({
    inspection: [],
    insurance: [],
    certification: [],
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  // Dropdown options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 20 }, (_, i) => ({
    label: String(currentYear - i),
    value: String(currentYear - i),
  }));

  const brandOptions = [
    { label: "BMW", value: "BMW" },
    { label: "Audi", value: "Audi" },
    { label: "Mercedes", value: "Mercedes" },
    { label: "Toyota", value: "Toyota" },
    { label: "Honda", value: "Honda" },
    { label: "Ford", value: "Ford" },
    { label: "Chevrolet", value: "Chevrolet" },
    { label: "Nissan", value: "Nissan" },
    { label: "Hyundai", value: "Hyundai" },
    { label: "Kia", value: "Kia" },
  ];

  const modelOptions = [
    { label: "Sedan", value: "Sedan" },
    { label: "SUV", value: "SUV" },
    { label: "Hatchback", value: "Hatchback" },
    { label: "Coupe", value: "Coupe" },
    { label: "Convertible", value: "Convertible" },
    { label: "Wagon", value: "Wagon" },
    { label: "Pickup", value: "Pickup" },
    { label: "Van", value: "Van" },
  ];

  const doorOptions = [
    { label: "2 Doors", value: "2" },
    { label: "4 Doors", value: "4" },
    { label: "5 Doors", value: "5" },
  ];

  const colorOptions = [
    { label: "Black", value: "Black" },
    { label: "White", value: "White" },
    { label: "Silver", value: "Silver" },
    { label: "Gray", value: "Gray" },
    { label: "Red", value: "Red" },
    { label: "Blue", value: "Blue" },
    { label: "Green", value: "Green" },
    { label: "Brown", value: "Brown" },
    { label: "Gold", value: "Gold" },
    { label: "Other", value: "Other" },
  ];

  const seatOptions = [
    { label: "2", value: "2" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "7", value: "7" },
    { label: "8", value: "8" },
  ];

  const boosterOptions = [
    { label: "0", value: "0" },
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
  ];

  // Check authentication on mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      Alert.alert("Authentication Required", "Please login to continue", [
        { text: "OK", onPress: () => router.push("/Login") },
      ]);
      return;
    }
    console.log("Vehicle Info Screen loaded for registration");
  }, [isAuthenticated, token]);

  // Request permissions for image picker
  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Sorry, we need camera roll permissions to upload images."
        );
      }
    })();
  }, []);

  // API helper function
  const makeApiRequest = async (
    endpoint: string,
    options: RequestInit = {}
  ) => {
    // Replace with your actual API URL
    const API_BASE_URL = "http://192.168.29.162:5000/api";
    const url = `${API_BASE_URL}${endpoint}`;

    const defaultHeaders: any = {
      Authorization: `Bearer ${token}`,
    };

    if (!(options.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
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

  // Handle input changes
  const handleInputChange = (
    field: keyof VehicleInfo,
    value: string | number
  ) => {
    setVehicleInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle image picking with Expo ImagePicker
  const handleImagePick = async (type: keyof UploadedImages) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadedImages((prev) => ({
          ...prev,
          [type]: [asset.uri],
        }));
      }
    } catch (error) {
      console.error("ImagePicker Error:", error);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  // Handle image deletion
  const handleDeleteImage = (type: keyof UploadedImages, index: number) => {
    Alert.alert("Delete Image", "Are you sure you want to delete this image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setUploadedImages((prev) => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index),
          }));
        },
      },
    ]);
  };

  // Validate form data
  const validateForm = () => {
    const requiredFields = {
      vehicleBrand: "Vehicle Brand",
      vehicleModel: "Vehicle Model",
      vehicleYear: "Vehicle Year",
      vehicleColor: "Vehicle Color",
      vehicleNumber: "Vehicle VIN Number",
      registrationNumber: "Registration Number",
      insuranceProviderCompany: "Insurance Provider",
      insuranceNumber: "Insurance Number",
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (
        !vehicleInfo[field as keyof VehicleInfo] ||
        vehicleInfo[field as keyof VehicleInfo] === 0
      ) {
        Alert.alert(
          "Missing Information",
          `Please fill in the ${label} field.`
        );
        return false;
      }
    }

    if (uploadedImages.inspection.length === 0) {
      Alert.alert(
        "Missing Document",
        "Please upload vehicle inspection document."
      );
      return false;
    }

    if (uploadedImages.insurance.length === 0) {
      Alert.alert(
        "Missing Document",
        "Please upload driver insurance document."
      );
      return false;
    }

    return true;
  };

  // Register vehicle info
  const handleRegisterVehicleInfo = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      if (!token) {
        Alert.alert("Error", "Authentication token not found");
        return;
      }

      setUpdating(true);

      const formData = new FormData();

      // Add vehicle info fields
      const vehicleData = {
        vehicleBrand: vehicleInfo.vehicleBrand,
        vehicleModel: vehicleInfo.vehicleModel,
        vehicleYear: parseInt(String(vehicleInfo.vehicleYear)),
        noOfDoors: parseInt(String(vehicleInfo.noOfDoors)),
        vehicleColor: vehicleInfo.vehicleColor,
        noOfSeats: parseInt(String(vehicleInfo.noOfSeats)),
        noOfBooster: parseInt(String(vehicleInfo.noOfBooster)),
        vehicleNumber: vehicleInfo.vehicleNumber.trim(),
        registrationNumber: vehicleInfo.registrationNumber.trim(),
        insuranceProviderCompany: vehicleInfo.insuranceProviderCompany.trim(),
        insuranceNumber: vehicleInfo.insuranceNumber.trim(),
      };

      formData.append("vehicleInfo", JSON.stringify(vehicleData));

      // Add images (Expo-specific image handling)
      if (uploadedImages.inspection.length > 0) {
        const inspectionFile = {
          uri: uploadedImages.inspection[0],
          type: "image/jpeg",
          name: "vehicle_inspection.jpg",
        } as any;
        formData.append("vehicleInspectionImage", inspectionFile);
      }

      if (uploadedImages.insurance.length > 0) {
        const insuranceFile = {
          uri: uploadedImages.insurance[0],
          type: "image/jpeg",
          name: "driver_insurance.jpg",
        } as any;
        formData.append("vehicleInsuranceImage", insuranceFile);
      }

      if (uploadedImages.certification.length > 0) {
        const certFile = {
          uri: uploadedImages.certification[0],
          type: "image/jpeg",
          name: "local_certificate.jpg",
        } as any;
        formData.append("localCertificate", certFile);
      }

      // Use POST method for registration
      const data = await makeApiRequest("/users/update-vehicle", {
        method: "POST",
        body: formData,
      });

      if (data.success) {
        Alert.alert("Success", "Vehicle information registered successfully!", [
          {
            text: "OK",
            onPress: () => router.push("/driverHome"),
          },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to register vehicle info");
      }
    } catch (error: any) {
      console.error("Registration error:", error);

      let errorMessage = "Failed to register vehicle information";

      if (error.message?.includes("non-JSON response")) {
        errorMessage =
          "Server error. Please check if the backend server is running.";
      } else if (error.message?.includes("Network request failed")) {
        errorMessage =
          "Connection failed. Please ensure:\n1. Backend server is running\n2. Check your internet connection";
      } else {
        errorMessage = error.message || "Unknown error occurred";
      }

      Alert.alert("Registration Failed", errorMessage, [
        { text: "Retry", onPress: () => handleRegisterVehicleInfo() },
        { text: "Cancel", style: "cancel" },
      ]);
    } finally {
      setUpdating(false);
    }
  };

  //   // Test connection function
  //   const testConnection = async () => {
  //     try {
  //       setLoading(true);
  //       const API_BASE_URL = 'http://localhost:5000';
  //       const response = await fetch(`${API_BASE_URL}/api/health`, {
  //         method: 'GET',
  //         headers: {
  //           'Authorization': `Bearer ${token}`,
  //         },
  //       });

  //       if (response.ok) {
  //         Alert.alert('Success', 'Connected to backend successfully!');
  //       } else {
  //         Alert.alert('Connection Issue', `Server responded with status: ${response.status}`);
  //       }
  //     } catch (error) {
  //       Alert.alert('Connection Failed', 'Cannot connect to backend server.');
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  // Render upload section
  const renderUploadSection = (
    title: string,
    type: keyof UploadedImages,
    required: boolean = false
  ) => (
    <View style={styles.uploadSection}>
      <Text style={styles.uploadTitle}>
        {title}
        {required && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>
      <View style={styles.imageRow}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleImagePick(type)}
        >
          <Text style={styles.plusIcon}>+</Text>
          <Text style={styles.uploadButtonText}>Add Photo</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {uploadedImages[type]?.map((imageUri, index) => (
            <View key={index} style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
              <TouchableOpacity
                style={styles.deleteIcon}
                onPress={() => handleDeleteImage(type, index)}
              >
                <AntDesign name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  // Show loading state
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

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={35} color="#FF8C00" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registration</Text>
          {/* <TouchableOpacity onPress={testConnection} style={styles.testButton}>
            <Text style={styles.testButtonText}>Test API</Text>
          </TouchableOpacity> */}
        </View>

        <Text style={styles.title}>Enter Your Vehicle Info</Text>
        <Text style={styles.subtitle}>Drive with your personal vehicle</Text>

        <View style={styles.formContainer}>
          <Dropdown
            label="Year *"
            options={yearOptions}
            selectedValue={String(vehicleInfo.vehicleYear)}
            onSelect={(value) =>
              handleInputChange("vehicleYear", parseInt(value))
            }
            placeholder="Select year"
          />

          <Dropdown
            label="Car Brand *"
            options={brandOptions}
            selectedValue={vehicleInfo.vehicleBrand}
            onSelect={(value) => handleInputChange("vehicleBrand", value)}
            placeholder="Select brand"
          />

          <Dropdown
            label="Model *"
            options={modelOptions}
            selectedValue={vehicleInfo.vehicleModel}
            onSelect={(value) => handleInputChange("vehicleModel", value)}
            placeholder="Select model"
          />

          <Dropdown
            label="Doors"
            options={doorOptions}
            selectedValue={String(vehicleInfo.noOfDoors)}
            onSelect={(value) =>
              handleInputChange("noOfDoors", parseInt(value))
            }
            placeholder="Select doors"
          />

          <Dropdown
            label="Color *"
            options={colorOptions}
            selectedValue={vehicleInfo.vehicleColor}
            onSelect={(value) => handleInputChange("vehicleColor", value)}
            placeholder="Select color"
          />

          <View style={styles.rowContainer}>
            <View style={styles.halfWidth}>
              <Dropdown
                label="Number Of Seats"
                options={seatOptions}
                selectedValue={String(vehicleInfo.noOfSeats)}
                onSelect={(value) =>
                  handleInputChange("noOfSeats", parseInt(value))
                }
                placeholder="Select seats"
              />
            </View>
            <View style={styles.halfWidth}>
              <Dropdown
                label="Number Of Booster"
                options={boosterOptions}
                selectedValue={String(vehicleInfo.noOfBooster)}
                onSelect={(value) =>
                  handleInputChange("noOfBooster", parseInt(value))
                }
                placeholder="Select boosters"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Vehicle's VIN Number{" "}
              <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter VIN Number"
              placeholderTextColor="#999"
              value={vehicleInfo.vehicleNumber}
              onChangeText={(text) => handleInputChange("vehicleNumber", text)}
              autoCapitalize="characters"
              maxLength={17}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Registration <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Registration Number"
              placeholderTextColor="#999"
              value={vehicleInfo.registrationNumber}
              onChangeText={(text) =>
                handleInputChange("registrationNumber", text)
              }
              autoCapitalize="characters"
            />
          </View>

          {renderUploadSection(
            "Upload Vehicle's Inspection",
            "inspection",
            true
          )}
          {renderUploadSection("Upload Driver's Insurance", "insurance", true)}
          {renderUploadSection("Local Certification", "certification")}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Insurance Provider <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Company Name"
              placeholderTextColor="#999"
              value={vehicleInfo.insuranceProviderCompany}
              onChangeText={(text) =>
                handleInputChange("insuranceProviderCompany", text)
              }
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Insurance Number <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Insurance Number"
              placeholderTextColor="#999"
              value={vehicleInfo.insuranceNumber}
              onChangeText={(text) =>
                handleInputChange("insuranceNumber", text)
              }
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.continueButton, updating && styles.disabledButton]}
            onPress={handleRegisterVehicleInfo}
            disabled={updating}
          >
            {updating ? (
              <View style={styles.loadingButtonContent}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.continueButtonText}>Registering...</Text>
              </View>
            ) : (
              <Text style={styles.continueButtonText}>Register Vehicle</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.push("/Home")}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// Custom styles for RNPickerSelect
const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    color: "#000",
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  inputAndroid: {
    fontSize: 16,
    color: "#000",
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
});

// Main styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: Platform.OS === "ios" ? 50 : 30,
  },
  headerTitle: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "500",
    marginLeft: 20,
    flex: 1,
  },
  testButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#000",
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#777",
    textAlign: "center",
    marginBottom: 30,
    marginTop: 8,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "500",
  },
  requiredAsterisk: {
    color: "#FF4444",
  },
  dropdownContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 4,
  },
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    flex: 1,
    marginHorizontal: 5,
  },
  textInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadTitle: {
    fontSize: 16,
    marginBottom: 12,
    color: "#000",
    fontWeight: "500",
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadButton: {
    width: 80,
    height: 100,
    backgroundColor: "#F7F7FA",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  plusIcon: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: "bold",
  },
  uploadButtonText: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 4,
    textAlign: "center",
  },
  imagePreviewContainer: {
    position: "relative",
    marginRight: 10,
  },
  uploadedImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
  },
  deleteIcon: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "rgba(255,68,68,0.8)",
    borderRadius: 12,
    padding: 6,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  continueButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  bottomButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: {
    backgroundColor: "#6B7280",
    padding: 16,
    borderRadius: 25,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#FF4444",
    padding: 16,
    borderRadius: 25,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default VehicleInfoScreen;
