import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from "react-native-responsive-dimensions";
import { ArrowLeft, Camera, Trash2, Plus, MapPin } from "lucide-react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../components/redux/store";
import axiosInstance from "../../api/axios";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Picker } from "@react-native-picker/picker";
import colors from "../../assets/color";

interface WorkingHours {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  is24Hours: boolean;
}

interface GarageFormData {
  garageName: string;
  about: string;
  address: string;
  contactNumber: string;
  email: string;
  price: number;
  workingHours: WorkingHours[];
  is24x7: boolean;
  vehicleType: "bike" | "car" | "both";
  spacesList: Record<string, { count: number; price: number }>;
  location: {
    type: string;
    coordinates: number[];
  };
  emergencyContact?: {
    person: string;
    number: string;
  };
}

const MerchantGarageForm = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const garageId = params.garageId as string | undefined;

  const [selectedTab, setSelectedTab] = useState("Garage");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [images, setImages] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [formData, setFormData] = useState<GarageFormData>({
    garageName: "",
    about: "",
    address: "",
    contactNumber: user?.phoneNumber || "",
    email: user?.email || "",
    price: 100,
    workingHours: [
      {
        day: "SUN",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
      {
        day: "MON",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
      {
        day: "TUE",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
      {
        day: "WED",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
      {
        day: "THU",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
      {
        day: "FRI",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
      {
        day: "SAT",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
        is24Hours: false,
      },
    ],
    is24x7: false,
    vehicleType: "both",
    spacesList: {
      A: { count: 10, price: 100 },
      B: { count: 5, price: 150 },
    },
    location: {
      type: "Point",
      coordinates: [0, 0],
    },
  });

  useEffect(() => {
    if (garageId) {
      fetchGarageDetails();
    }
    getCurrentLocation();
  }, [garageId]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setFormData((prev) => ({
        ...prev,
        location: {
          type: "Point",
          coordinates: [location.coords.longitude, location.coords.latitude],
        },
      }));
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Location Error", "Could not get your current location");
    }
  };

  const fetchGarageDetails = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/api/merchants/garage/${garageId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const garageData = response.data.data;
      setFormData({
        garageName: garageData.garageName,
        about: garageData.about,
        address: garageData.address,
        contactNumber: garageData.contactNumber,
        email: garageData.email,
        price: garageData.price || 100,
        workingHours: garageData.generalAvailable,
        is24x7: garageData.is24x7,
        vehicleType: garageData.vehicleType,
        spacesList: Object.fromEntries(garageData.spacesList),
        location: garageData.location,
        emergencyContact: garageData.emergencyContact,
      });

      if (garageData.images && garageData.images.length > 0) {
        setImages(
          garageData.images.map((uri: string) => ({
            uri,
            name: uri.split("/").pop() || "image.jpg",
            type: "image/jpeg",
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching garage details:", error);
      Alert.alert("Error", "Failed to fetch garage details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera roll permission is required");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const newImages = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.uri.split("/").pop() || `image_${Date.now()}.jpg`,
          type: "image/jpeg",
        }));
        setImages((prev) => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to select images");
    }
  };

  const handleChange = (field: keyof GarageFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWorkingHoursChange = (
    index: number,
    field: keyof WorkingHours,
    value: any
  ) => {
    const newWorkingHours = [...formData.workingHours];
    newWorkingHours[index] = {
      ...newWorkingHours[index],
      [field]: value,
    };

    setFormData((prev) => ({
      ...prev,
      workingHours: newWorkingHours,
    }));
  };

  const handleSpaceChange = (
    zone: string,
    field: "count" | "price",
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      spacesList: {
        ...prev.spacesList,
        [zone]: {
          ...prev.spacesList[zone],
          [field]: numValue,
        },
      },
    }));
  };

  const addZone = () => {
    const zones = Object.keys(formData.spacesList);
    let newZone = "A";
    if (zones.length > 0) {
      const lastZone = zones[zones.length - 1];
      newZone = String.fromCharCode(lastZone.charCodeAt(0) + 1);
    }

    setFormData((prev) => ({
      ...prev,
      spacesList: {
        ...prev.spacesList,
        [newZone]: { count: 0, price: 0 },
      },
    }));
  };

  const removeZone = (zone: string) => {
    if (Object.keys(formData.spacesList).length <= 1) {
      Alert.alert("Error", "You must have at least one zone");
      return;
    }

    const newSpaces = { ...formData.spacesList };
    delete newSpaces[zone];

    setFormData((prev) => ({
      ...prev,
      spacesList: newSpaces,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.garageName || !formData.address || !formData.contactNumber) {
      Alert.alert("Validation Error", "Please fill all required fields");
      return;
    }

    try {
      setIsLoading(true);

      const data = new FormData();

      data.append("garageName", formData.garageName);
      data.append("about", formData.about);
      data.append("address", formData.address);
      data.append("contactNumber", formData.contactNumber);
      data.append("email", formData.email);
      data.append("is24x7", formData.is24x7.toString());
      data.append("price", formData.price.toString());
      data.append("vehicleType", formData.vehicleType);
      data.append("generalAvailable", JSON.stringify(formData.workingHours));
      data.append("spacesList", JSON.stringify(formData.spacesList));
      data.append("location", JSON.stringify(formData.location));

      images.forEach((image, index) => {
        if (image.uri.startsWith("file://") || !image.uri.startsWith("http")) {
          data.append("images", {
            uri: image.uri,
            name: image.name,
            type: image.type,
          } as any);
        }
      });

      if (garageId) {
        const existingImageUrls = images
          .filter((img) => img.uri.startsWith("http"))
          .map((img) => img.uri);
        if (existingImageUrls.length > 0) {
          data.append("existingImages", JSON.stringify(existingImageUrls));
        }
      }

      const endpoint = garageId
        ? `/api/merchants/garage/update/${garageId}`
        : "http://192.168.29.162:5000/api/merchants/garage/registration";

      const method = garageId ? "put" : "post";

      const response = await axiosInstance[method](endpoint, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      Alert.alert(
        "Success",
        garageId ? "Garage updated successfully" : "Garage created successfully"
      );
      router.back();
    } catch (error: any) {
      console.error(
        "Error submitting garage:",
        error.response?.data || error.message
      );
      let errorMessage = "Failed to submit garage details";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (
        error.response?.data?.errors &&
        error.response.data.errors.length > 0
      ) {
        errorMessage =
          "Validation Errors:\n" +
          error.response.data.errors.map((e: any) => e.message).join("\n");
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  if (isLoading && !formData.garageName) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {garageId ? "Edit Garage" : "Add Garage"}
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text style={styles.submitText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Container */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedTab === "Residence" && styles.activeTab,
            ]}
            onPress={() => {
              setSelectedTab("Residence");
              router.push("/merchant/residence-form");
            }}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "Residence" && styles.activeTabText,
              ]}
            >
              Residence
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedTab === "Parking Lot" && styles.activeTab,
            ]}
            onPress={() => {
              setSelectedTab("Parking Lot");
              router.push("/merchant/parking-form");
            }}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "Parking Lot" && styles.activeTabText,
              ]}
            >
              Parking Lot
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedTab === "Garage" && styles.activeTab,
            ]}
            onPress={() => setSelectedTab("Garage")}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "Garage" && styles.activeTabText,
              ]}
            >
              Garage
            </Text>
          </TouchableOpacity>
        </View>

        {/* Image Upload */}
        <View style={styles.imageUploadContainer}>
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={handleImageUpload}
            disabled={images.length >= 5}
          >
            <Camera size={25} color={colors.brandColor} />
            <Text style={styles.imageUploadText}>
              Upload Garage Images ({images.length}/5)
            </Text>
          </TouchableOpacity>
          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.imagePreview}
                  />
                  <TouchableOpacity
                    style={styles.deleteImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Garage Details Form */}
        <View style={styles.card}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Garage Name*</Text>
            <TextInput
              style={styles.input}
              value={formData.garageName}
              onChangeText={(text) => handleChange("garageName", text)}
              placeholder="Enter garage name"
            />

            <Text style={styles.label}>About*</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.about}
              onChangeText={(text) => handleChange("about", text)}
              placeholder="Describe your garage (facilities, features, etc.)"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Address*</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => handleChange("address", text)}
              placeholder="Enter address"
            />

            <Text style={styles.label}>Contact Number*</Text>
            <TextInput
              style={styles.input}
              value={formData.contactNumber}
              onChangeText={(text) => handleChange("contactNumber", text)}
              placeholder="Enter contact number"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => handleChange("email", text)}
              placeholder="Enter email"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Average Price*</Text>
            <TextInput
              style={styles.input}
              value={formData.price.toString()}
              onChangeText={(text) =>
                handleChange("price", parseInt(text) || 0)
              }
              placeholder="Enter average price"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Vehicle Type*</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.vehicleType}
                onValueChange={(value) => handleChange("vehicleType", value)}
                style={styles.picker}
              >
                <Picker.Item label="Both Cars and Bikes" value="both" />
                <Picker.Item label="Cars Only" value="car" />
                <Picker.Item label="Bikes Only" value="bike" />
              </Picker>
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.label}>24/7 Open</Text>
              <TouchableOpacity
                style={[
                  styles.switchButton,
                  formData.is24x7 && styles.switchButtonActive,
                ]}
                onPress={() => handleChange("is24x7", !formData.is24x7)}
              >
                <Text
                  style={[
                    styles.switchText,
                    formData.is24x7 && styles.switchTextActive,
                  ]}
                >
                  {formData.is24x7 ? "YES" : "NO"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Working Hours */}
        {!formData.is24x7 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Working Hours</Text>
            {formData.workingHours.map((day, index) => (
              <View key={day.day} style={styles.dayContainer}>
                <Text style={styles.dayLabel}>{day.day}</Text>

                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Open</Text>
                  <TouchableOpacity
                    style={[
                      styles.switchButton,
                      day.isOpen && styles.switchButtonActive,
                    ]}
                    onPress={() =>
                      handleWorkingHoursChange(index, "isOpen", !day.isOpen)
                    }
                  >
                    <Text
                      style={[
                        styles.switchText,
                        day.isOpen && styles.switchTextActive,
                      ]}
                    >
                      {day.isOpen ? "YES" : "NO"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {day.isOpen && !day.is24Hours && (
                  <>
                    <Text style={styles.label}>Open Time</Text>
                    <TextInput
                      style={styles.input}
                      value={day.openTime}
                      onChangeText={(text) =>
                        handleWorkingHoursChange(index, "openTime", text)
                      }
                      placeholder="09:00"
                    />

                    <Text style={styles.label}>Close Time</Text>
                    <TextInput
                      style={styles.input}
                      value={day.closeTime}
                      onChangeText={(text) =>
                        handleWorkingHoursChange(index, "closeTime", text)
                      }
                      placeholder="17:00"
                    />
                  </>
                )}

                <View style={styles.switchContainer}>
                  <Text style={styles.label}>24 Hours</Text>
                  <TouchableOpacity
                    style={[
                      styles.switchButton,
                      day.is24Hours && styles.switchButtonActive,
                    ]}
                    onPress={() =>
                      handleWorkingHoursChange(
                        index,
                        "is24Hours",
                        !day.is24Hours
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.switchText,
                        day.is24Hours && styles.switchTextActive,
                      ]}
                    >
                      {day.is24Hours ? "YES" : "NO"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Parking Spaces */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parking Spaces</Text>
          {Object.entries(formData.spacesList).map(([zone, space]) => (
            <View key={zone} style={styles.spaceContainer}>
              <Text style={styles.zoneLabel}>Zone {zone}</Text>

              <View style={styles.spaceInputRow}>
                <View style={styles.spaceInputContainer}>
                  <Text style={styles.label}>Count</Text>
                  <TextInput
                    style={styles.input}
                    value={space.count.toString()}
                    onChangeText={(text) =>
                      handleSpaceChange(zone, "count", text)
                    }
                    placeholder="Number of slots"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.spaceInputContainer}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    value={space.price.toString()}
                    onChangeText={(text) =>
                      handleSpaceChange(zone, "price", text)
                    }
                    placeholder="Price per hour"
                    keyboardType="numeric"
                  />
                </View>

                {Object.keys(formData.spacesList).length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeZone(zone)}
                  >
                    <Trash2 size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addZone}>
            <Plus size={20} color={colors.brandColor} />
            <Text style={styles.addButtonText}>Add Zone</Text>
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location</Text>
          {currentLocation ? (
            <>
              <Text style={styles.label}>
                Latitude: {currentLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.label}>
                Longitude: {currentLocation.longitude.toFixed(6)}
              </Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={getCurrentLocation}
              >
                <MapPin size={20} color="#FFF" />
                <Text style={styles.locationButtonText}>Refresh Location</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.brandColor} />
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {garageId ? "Update Garage" : "Save Garage"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  contentContainer: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: responsiveHeight(2),
  },
  tabButton: {
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(5),
    borderRadius: 20,
    marginHorizontal: responsiveWidth(1),
    backgroundColor: "#D3D3D3",
  },
  activeTab: {
    backgroundColor: colors.brandColor,
  },
  tabText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
  },
  activeTabText: {
    color: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.black,
  },
  submitText: {
    color: colors.brandColor,
    fontSize: 16,
    fontWeight: "bold",
  },
  imageUploadContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  imageUploadButton: {
    borderWidth: 1,
    borderColor: colors.brandColor,
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  imageUploadText: {
    color: colors.brandColor,
    fontSize: 16,
    marginLeft: 10,
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  imageWrapper: {
    position: "relative",
    margin: 5,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 5,
  },
  deleteImageButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 15,
    padding: 5,
  },
  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: colors.black,
    marginBottom: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    marginBottom: 15,
  },
  picker: {
    height: 50,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.black,
    marginBottom: 15,
  },
  spaceContainer: {
    marginBottom: 15,
  },
  spaceInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  spaceInputContainer: {
    flex: 1,
    marginRight: 10,
  },
  zoneLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.black,
    marginBottom: 10,
  },
  removeButton: {
    padding: 10,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: colors.brandColor,
    borderRadius: 8,
    marginTop: 10,
  },
  addButtonText: {
    color: colors.brandColor,
    fontSize: 16,
    marginLeft: 10,
  },
  submitButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  dayContainer: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.black,
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  switchButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.brandColor,
  },
  switchButtonActive: {
    backgroundColor: colors.brandColor,
  },
  switchText: {
    fontSize: 14,
    color: colors.black,
  },
  switchTextActive: {
    color: "#FFF",
  },
  locationButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  locationButtonText: {
    color: "#FFF",
    fontSize: 16,
    marginLeft: 8,
  },
});

export default MerchantGarageForm;
