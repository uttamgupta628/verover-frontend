import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from "react-native-responsive-dimensions";
import { useSelector } from "react-redux";
import { RootState } from "../../components/redux/store";
import axiosInstance from "../../api/axios";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import colors from "../../assets/color";
import { ArrowLeft, Camera, X, Repeat, Clock, Plus } from "lucide-react-native";
import TimeWheelPicker from "./Timewheelpicker";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkingHours {
  day: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
  is24Hours: boolean;
}

interface IDailyRateSlot {
  label: string;
  fromTime: string;
  toTime: string;
  price: number;
}

interface ResidenceFormData {
  residenceName: string;
  about: string;
  address: string;
  gpsLocation: { type: "Point"; coordinates: number[] };
  price: number;
  contactNumber: string;
  email?: string;
  vehicleType: "bike" | "car" | "both";
  generalAvailable: WorkingHours[];
  is24x7: boolean;
  emergencyContact: { person: string; number: string };
  parking_pass: boolean;
  transportationAvailable: boolean;
  transportationTypes?: string;
  coveredDrivewayAvailable: boolean;
  coveredDrivewayTypes?: string;
  securityCamera: boolean;
  // ── Monthly plan ─────────────────────────────────────────
  monthlyChargeEnabled: boolean;
  monthlyRate: number;
  // ── Daily rate ────────────────────────────────────────────
  dailyRateEnabled: boolean;
  dailyRates: IDailyRateSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isValidTime = (t: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$|^00:00$/.test(t);

const emptySlot = (): IDailyRateSlot => ({
  label: "",
  fromTime: "06:00",
  toTime: "18:00",
  price: 0,
});

// ── Component ─────────────────────────────────────────────────────────────────

const MerchantResidenceForm = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { residenceId } = params;
  const { token, user } = useSelector((state: RootState) => state.auth);

  const [selectedTab, setSelectedTab] = useState("Residence");
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // ── Time Wheel Picker state ───────────────────────────────────────────────
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    slotIndex: number;
    field: "fromTime" | "toTime";
  } | null>(null);
  const [timePickerValue, setTimePickerValue] = useState("06:00");

  const [formData, setFormData] = useState<ResidenceFormData>({
    residenceName: "",
    about: "",
    address: "",
    price: 0,
    contactNumber: user?.phoneNumber || "",
    email: user?.email || "",
    vehicleType: "both",
    is24x7: false,
    gpsLocation: { type: "Point", coordinates: [0, 0] },
    generalAvailable: [
      { day: "SUN", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "MON", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "TUE", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "WED", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "THU", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "FRI", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "SAT", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
    ],
    emergencyContact: { person: "", number: "" },
    parking_pass: false,
    transportationAvailable: false,
    transportationTypes: "",
    coveredDrivewayAvailable: false,
    coveredDrivewayTypes: "",
    securityCamera: false,
    monthlyChargeEnabled: false,
    monthlyRate: 0,
    dailyRateEnabled: false,
    dailyRates: [],
  });

  useEffect(() => {
    if (residenceId) fetchResidenceDetails();
    requestLocationPermissionAndGetLocation();
  }, [residenceId]);

  const requestLocationPermissionAndGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required.");
        return;
      }
      getCurrentLocation();
    } catch (err) {
      console.warn(err);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      setCurrentLocation({ latitude, longitude });
      setFormData((prev) => ({
        ...prev,
        gpsLocation: { type: "Point", coordinates: [longitude, latitude] },
      }));
    } catch (error) {
      Alert.alert("Location Error", "Could not get your current location.");
    }
  };

  const fetchResidenceDetails = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(
        `/merchants/residence/${residenceId}`,
      );
      // addResidence returns the document directly:
      // ApiResponse(201, newResidence) → { data: newResidence } or { data: { data: newResidence } }
      const d =
        response.data?.data?.residenceName
          ? response.data.data
          : response.data?.residenceName
          ? response.data
          : response.data?.data ?? response.data;

      setFormData({
        ...d,
        price:                d.price || 0,
        vehicleType:          d.vehicleType || "both",
        emergencyContact:     d.emergencyContact || { person: "", number: "" },
        transportationTypes:  d.transportationTypes?.join(", ") || "",
        coveredDrivewayTypes: d.coveredDrivewayTypes?.join(", ") || "",
        monthlyChargeEnabled: d.monthlyChargeEnabled ?? false,
        monthlyRate:          d.monthlyRate ?? 0,
        dailyRateEnabled:     d.dailyRateEnabled ?? false,
        dailyRates:           d.dailyRates ?? [],
      });
      if (d.images?.length > 0) {
        setImages(
          d.images.map((uri: string) => ({
            uri,
            name: uri.split("/").pop() || "image.jpg",
            type: "image/jpeg",
          })),
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch residence details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    try {
      const { granted } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission Required", "You need to grant permission to access photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: Math.max(1, 10 - images.length),
      });
      if (result.canceled || !result.assets) return;
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri ?? "",
        name: asset.uri?.split("/").pop() || `image_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      }));
      setImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      Alert.alert("Error", "Failed to select images");
    }
  };

  const removeImage = (index: number) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  const handleChange = (field: keyof ResidenceFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleEmergencyContactChange = (
    field: "person" | "number",
    value: string,
  ) =>
    setFormData((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value },
    }));

  const handleWorkingHoursChange = (
    index: number,
    field: keyof WorkingHours,
    value: any,
  ) => {
    const newWorkingHours = [...formData.generalAvailable];
    newWorkingHours[index] = { ...newWorkingHours[index], [field]: value };
    setFormData((prev) => ({ ...prev, generalAvailable: newWorkingHours }));
  };

  // ── Daily Rate helpers ─────────────────────────────────────────────────────

  const handleDailyRateSlotChange = (
    index: number,
    field: keyof IDailyRateSlot,
    value: any,
  ) => {
    const slots = [...formData.dailyRates];
    slots[index] = { ...slots[index], [field]: value };
    handleChange("dailyRates", slots);
  };

  const addDailyRateSlot = () =>
    handleChange("dailyRates", [...formData.dailyRates, emptySlot()]);

  const removeDailyRateSlot = (index: number) => {
    const slots = [...formData.dailyRates];
    slots.splice(index, 1);
    handleChange("dailyRates", slots);
  };

  const openTimePicker = (slotIndex: number, field: "fromTime" | "toTime") => {
    const slot = formData.dailyRates[slotIndex];
    setTimePickerValue(
      (field === "fromTime" ? slot?.fromTime : slot?.toTime) || "06:00",
    );
    setTimePickerTarget({ slotIndex, field });
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (time: string) => {
    if (timePickerTarget) {
      handleDailyRateSlotChange(
        timePickerTarget.slotIndex,
        timePickerTarget.field,
        time,
      );
    }
    setTimePickerVisible(false);
    setTimePickerTarget(null);
  };

  const validateDailyRates = (): boolean => {
    if (!formData.dailyRateEnabled) return true;
    const slots = formData.dailyRates;
    if (slots.length === 0) {
      Alert.alert("Validation Error", "Add at least one time slot when daily rate is enabled.");
      return false;
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.label.trim()) {
        Alert.alert("Validation Error", `Slot ${i + 1}: label is required.`);
        return false;
      }
      if (!isValidTime(s.fromTime)) {
        Alert.alert("Validation Error", `Slot ${i + 1}: fromTime must be HH:MM (e.g. "06:00").`);
        return false;
      }
      if (!isValidTime(s.toTime)) {
        Alert.alert("Validation Error", `Slot ${i + 1}: toTime must be HH:MM. Use "00:00" for midnight.`);
        return false;
      }
      if (s.price < 0) {
        Alert.alert("Validation Error", `Slot ${i + 1}: price must be ≥ 0.`);
        return false;
      }
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (
      !formData.residenceName ||
      !formData.address ||
      !formData.contactNumber ||
      !formData.about ||
      formData.price <= 0
    ) {
      Alert.alert("Validation Error", "Please fill all required fields marked with *");
      return;
    }
    if (formData.address.trim().length < 10) {
      Alert.alert("Validation Error", "The address must be at least 10 characters long.");
      return;
    }
    if (formData.about.trim().length < 20) {
      Alert.alert("Validation Error", "The 'About' description must be at least 20 characters long.");
      return;
    }
    if (formData.monthlyChargeEnabled && formData.monthlyRate <= 0) {
      Alert.alert("Validation Error", "Please enter a valid monthly rate greater than 0.");
      return;
    }
    if (!validateDailyRates()) return;

    setIsLoading(true);
    try {
      // ── Step 1: register / update residence ───────────────────────────────
      const data = new FormData();

      // Append all fields except dailyRate ones (those go via separate endpoint)
      const skipFields: (keyof ResidenceFormData)[] = ["dailyRateEnabled", "dailyRates"];

      Object.keys(formData).forEach((key) => {
        const formKey = key as keyof ResidenceFormData;
        if (skipFields.includes(formKey)) return;

        const value = formData[formKey];
        if (["generalAvailable", "gpsLocation", "emergencyContact"].includes(formKey)) {
          data.append(formKey, JSON.stringify(value));
        } else if (["transportationTypes", "coveredDrivewayTypes"].includes(formKey)) {
          const arrayValue = (value as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          data.append(formKey, JSON.stringify(arrayValue));
        } else if (typeof value === "boolean") {
          data.append(formKey, String(value));
        } else {
          data.append(formKey, String(value));
        }
      });

      images.forEach((image) => {
        if (image.uri && !image.uri.startsWith("http")) {
          data.append("images", {
            uri:  image.uri,
            name: image.name,
            type: image.type,
          } as any);
        }
      });

      const endpoint = residenceId
        ? `/merchants/residence/update/${residenceId}`
        : "/merchants/residence/registration";
      const method = residenceId ? "put" : "post";

      const response = await axiosInstance[method](endpoint, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      // ── Step 2: save daily rate ────────────────────────────────────────────
      // addResidence: ApiResponse(201, newResidence)
      // → ApiResponse wraps as { statusCode, data: newResidence } or { data: { data: newResidence } }
      // The residence doc is returned directly (not nested under a key).
      const body = response.data;
      const savedResidenceId: string | undefined =
        (residenceId as string | undefined) ??
        body?.data?._id   ??   // ApiResponse wraps under .data
        body?._id          ??   // direct
        body?.data?.data?._id;  // double-wrapped

      if (savedResidenceId) {
        try {
          await axiosInstance.patch(
            "/merchants/daily-rate-settings",
            {
              venueType:        "residence",
              venueId:          savedResidenceId,
              dailyRateEnabled: formData.dailyRateEnabled,
              dailyRates:       formData.dailyRateEnabled
                ? formData.dailyRates.map(({ label, fromTime, toTime, price }) => ({
                    label,
                    fromTime,
                    toTime,
                    price,
                  }))
                : [],
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
        } catch (dailyRateErr: any) {
          Alert.alert(
            "Warning",
            "Residence saved, but daily rate slots could not be saved: " +
              (dailyRateErr.response?.data?.message || dailyRateErr.message),
          );
          router.back();
          return;
        }
      }

      Alert.alert(
        "Success",
        `Residence ${residenceId ? "updated" : "created"} successfully`,
      );
      router.back();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to submit residence details.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && residenceId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.contentContainer}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={30} color={colors.brandColor} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {residenceId ? "Edit Residence" : "Register Residence"}
            </Text>
            <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={colors.brandColor} />
              ) : (
                <Text style={styles.submitText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            {["Residence", "Parking Lot", "Garage"].map((tabName) => (
              <TouchableOpacity
                key={tabName}
                style={[styles.tabButton, selectedTab === tabName && styles.activeTab]}
                onPress={() => {
                  setSelectedTab(tabName);
                  if (tabName === "Parking Lot")
                    router.push("/parkingMerchent/registerParkingLot");
                  else if (tabName === "Garage")
                    router.push("/parkingMerchent/registerGarage");
                }}
              >
                <Text style={[styles.tabText, selectedTab === tabName && styles.activeTabText]}>
                  {tabName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Image Upload */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Residence Images</Text>
            <TouchableOpacity
              style={styles.imageUploadButton}
              onPress={handleImageUpload}
              disabled={images.length >= 10}
            >
              <Camera size={25} color={colors.brandColor} />
              <Text style={styles.imageUploadText}>
                Upload Images ({images.length}/10)
              </Text>
            </TouchableOpacity>
            <View style={styles.imagePreviewContainer}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.deleteImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <X size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <Text style={styles.label}>Residence Name*</Text>
            <TextInput
              style={styles.input}
              value={formData.residenceName}
              onChangeText={(text) => handleChange("residenceName", text)}
              placeholder="e.g., Downtown Cozy Stay"
            />
            <Text style={styles.label}>Vehicle Type Supported*</Text>
            <View style={styles.vehicleTypeContainer}>
              {(["bike", "car", "both"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicleType === type && styles.activeVehicleTypeButton,
                  ]}
                  onPress={() => handleChange("vehicleType", type)}
                >
                  <Text
                    style={[
                      styles.vehicleTypeButtonText,
                      formData.vehicleType === type && styles.activeVehicleTypeButtonText,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Address*</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => handleChange("address", text)}
              placeholder="Enter full address"
            />
            <Text style={styles.helperText}>Minimum 10 characters required</Text>
            <Text style={styles.label}>Price per night (₹)*</Text>
            <TextInput
              style={styles.input}
              value={String(formData.price)}
              onChangeText={(text) => handleChange("price", parseFloat(text) || 0)}
              placeholder="e.g., 50"
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>About this residence*</Text>
            <TextInput
              style={[styles.input, { height: responsiveHeight(12), textAlignVertical: "top" }]}
              value={formData.about}
              onChangeText={(text) => handleChange("about", text)}
              placeholder="Describe your residence"
              multiline
            />
            <Text style={styles.helperText}>Minimum 20 characters required</Text>
          </View>

          {/* Amenities */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Amenities & Features</Text>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Security Camera</Text>
              <Switch
                trackColor={{ false: "#767577", true: colors.brandColor }}
                thumbColor="#f4f3f4"
                value={formData.securityCamera}
                onValueChange={(value) => handleChange("securityCamera", value)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Parking Pass Provided</Text>
              <Switch
                trackColor={{ false: "#767577", true: colors.brandColor }}
                thumbColor="#f4f3f4"
                value={formData.parking_pass}
                onValueChange={(value) => handleChange("parking_pass", value)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Transportation Available</Text>
              <Switch
                trackColor={{ false: "#767577", true: colors.brandColor }}
                thumbColor="#f4f3f4"
                value={formData.transportationAvailable}
                onValueChange={(value) => handleChange("transportationAvailable", value)}
              />
            </View>
            {formData.transportationAvailable && (
              <>
                <Text style={styles.label}>Transportation Types</Text>
                <TextInput
                  style={styles.input}
                  value={formData.transportationTypes}
                  onChangeText={(text) => handleChange("transportationTypes", text)}
                  placeholder="e.g., Bus, Metro, Airport Shuttle"
                />
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.label}>Covered Driveway</Text>
              <Switch
                trackColor={{ false: "#767577", true: colors.brandColor }}
                thumbColor="#f4f3f4"
                value={formData.coveredDrivewayAvailable}
                onValueChange={(value) => handleChange("coveredDrivewayAvailable", value)}
              />
            </View>
            {formData.coveredDrivewayAvailable && (
              <>
                <Text style={styles.label}>Covered Driveway Types</Text>
                <TextInput
                  style={styles.input}
                  value={formData.coveredDrivewayTypes}
                  onChangeText={(text) => handleChange("coveredDrivewayTypes", text)}
                  placeholder="e.g., Garage, Carport"
                />
              </>
            )}
          </View>

          {/* Contact & Availability */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contact & Availability</Text>
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
              placeholder="Enter contact email"
              keyboardType="email-address"
            />
            <View style={styles.switchContainer}>
              <Text style={styles.label}>24/7 Check-in</Text>
              <TouchableOpacity
                style={[styles.switchButton, formData.is24x7 && styles.switchButtonActive]}
                onPress={() => handleChange("is24x7", !formData.is24x7)}
              >
                <Text style={[styles.switchText, formData.is24x7 && { color: "#FFF" }]}>
                  {formData.is24x7 ? "YES" : "NO"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Working Hours */}
          {!formData.is24x7 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Working Hours</Text>
              {formData.generalAvailable.map((day, index) => (
                <View key={day.day} style={styles.dayContainer}>
                  <Text style={styles.dayLabel}>{day.day}</Text>
                  <View style={styles.switchContainer}>
                    <Text style={styles.label}>Open</Text>
                    <TouchableOpacity
                      style={[styles.switchButton, day.isOpen && styles.switchButtonActive]}
                      onPress={() => handleWorkingHoursChange(index, "isOpen", !day.isOpen)}
                    >
                      <Text style={[styles.switchText, day.isOpen && { color: "#FFF" }]}>
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
                        onChangeText={(text) => handleWorkingHoursChange(index, "openTime", text)}
                        placeholder="e.g., 09:00"
                      />
                      <Text style={styles.label}>Close Time</Text>
                      <TextInput
                        style={styles.input}
                        value={day.closeTime}
                        onChangeText={(text) => handleWorkingHoursChange(index, "closeTime", text)}
                        placeholder="e.g., 17:00"
                      />
                    </>
                  )}
                  {day.isOpen && (
                    <View style={styles.switchContainer}>
                      <Text style={styles.label}>24 Hours for this day</Text>
                      <TouchableOpacity
                        style={[styles.switchButton, day.is24Hours && styles.switchButtonActive]}
                        onPress={() => handleWorkingHoursChange(index, "is24Hours", !day.is24Hours)}
                      >
                        <Text style={[styles.switchText, day.is24Hours && { color: "#FFF" }]}>
                          {day.is24Hours ? "YES" : "NO"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ── Monthly Plan ──────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderLeft}>
                <View style={styles.planIconWrap}>
                  <Repeat size={18} color={colors.brandColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Monthly/Permit Plan</Text>
                  <Text style={styles.planSubtitle}>
                    Allow customers to subscribe on a Monthly/Permit basis
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: "#D1D5DB", true: colors.brandColor }}
                thumbColor="#FFFFFF"
                value={formData.monthlyChargeEnabled}
                onValueChange={(value) => {
                  handleChange("monthlyChargeEnabled", value);
                  if (!value) handleChange("monthlyRate", 0);
                }}
              />
            </View>
            {formData.monthlyChargeEnabled && (
              <View style={styles.rateContainer}>
                <Text style={styles.label}>Monthly/Permit Rate per Slot*</Text>
                <View style={styles.rateInputRow}>
                  <Text style={styles.ratePrefix}>₹</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={formData.monthlyRate > 0 ? formData.monthlyRate.toString() : ""}
                    onChangeText={(text) => handleChange("monthlyRate", parseFloat(text) || 0)}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.gray}
                  />
                  <Text style={styles.rateSuffix}>/mo</Text>
                </View>
                {formData.monthlyRate > 0 && (
                  <View style={styles.ratePreview}>
                    <View style={styles.ratePreviewRow}>
                      <Text style={styles.ratePreviewLabel}>Monthly Rate</Text>
                      <Text style={styles.ratePreviewValue}>
                        ₹{formData.monthlyRate.toFixed(2)}/mo per slot
                      </Text>
                    </View>
                    <View style={styles.ratePreviewRow}>
                      <Text style={styles.ratePreviewLabel}>Annual per slot</Text>
                      <Text style={styles.ratePreviewValue}>
                        ₹{(formData.monthlyRate * 12).toFixed(2)}/yr
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Daily Rate ────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderLeft}>
                <View style={styles.planIconWrap}>
                  <Clock size={18} color={colors.brandColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Daily Rate (Time Slots)</Text>
                  <Text style={styles.planSubtitle}>
                    Define flat-fee time windows charged per booking
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: "#D1D5DB", true: colors.brandColor }}
                thumbColor="#FFFFFF"
                value={formData.dailyRateEnabled}
                onValueChange={(value) => {
                  handleChange("dailyRateEnabled", value);
                  if (!value) handleChange("dailyRates", []);
                }}
              />
            </View>

            {formData.dailyRateEnabled && (
              <View style={styles.dailyRateBody}>
                <Text style={styles.dailyRateHint}>
                  Each window is charged once the booking enters it, regardless
                  of duration. The last slot repeats for any overflow beyond midnight.
                </Text>

                {formData.dailyRates.map((slot, index) => (
                  <View key={index} style={styles.slotCard}>
                    <View style={styles.slotHeader}>
                      <Text style={styles.slotIndex}>Slot {index + 1}</Text>
                      <TouchableOpacity onPress={() => removeDailyRateSlot(index)}>
                        <X size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Label</Text>
                    <TextInput
                      style={styles.input}
                      value={slot.label}
                      onChangeText={(t) => handleDailyRateSlotChange(index, "label", t)}
                      placeholder="e.g. Morning, Peak Hours"
                    />

                    <View style={styles.slotTimeRow}>
                      <View style={styles.slotTimeGroup}>
                        <Text style={styles.label}>From</Text>
                        <TouchableOpacity
                          style={styles.timePickerButton}
                          onPress={() => openTimePicker(index, "fromTime")}
                          activeOpacity={0.7}
                        >
                          <Clock size={15} color={colors.brandColor} style={{ marginRight: 6 }} />
                          <Text style={styles.timePickerButtonText}>
                            {slot.fromTime || "Set time"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.slotTimeDivider}>
                        <Text style={styles.slotTimeDividerText}>→</Text>
                      </View>
                      <View style={styles.slotTimeGroup}>
                        <Text style={styles.label}>To</Text>
                        <TouchableOpacity
                          style={styles.timePickerButton}
                          onPress={() => openTimePicker(index, "toTime")}
                          activeOpacity={0.7}
                        >
                          <Clock size={15} color={colors.brandColor} style={{ marginRight: 6 }} />
                          <Text style={styles.timePickerButtonText}>
                            {slot.toTime || "Set time"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.label}>Flat Fee (₹)</Text>
                    <View style={styles.rateInputRow}>
                      <Text style={styles.ratePrefix}>₹</Text>
                      <TextInput
                        style={styles.rateInput}
                        value={slot.price > 0 ? slot.price.toString() : ""}
                        onChangeText={(t) =>
                          handleDailyRateSlotChange(index, "price", parseFloat(t) || 0)
                        }
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.gray}
                      />
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSlotButton} onPress={addDailyRateSlot}>
                  <Plus size={18} color={colors.brandColor} />
                  <Text style={styles.addSlotText}>Add Time Slot</Text>
                </TouchableOpacity>
              </View>
            )}
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
                  onPress={requestLocationPermissionAndGetLocation}
                >
                  <Text style={styles.locationButtonText}>Refresh Location</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="small" color={colors.brandColor} />
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {residenceId ? "Update Residence" : "Save Residence"}
              </Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* ── Time Wheel Picker Modal ── */}
      <TimeWheelPicker
        visible={timePickerVisible}
        value={timePickerValue}
        title={
          timePickerTarget?.field === "fromTime"
            ? "Select Start Time"
            : "Select End Time"
        }
        accentColor={colors.brandColor}
        onConfirm={handleTimeConfirm}
        onCancel={() => {
          setTimePickerVisible(false);
          setTimePickerTarget(null);
        }}
      />
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: "#F7F8FA" },
  contentContainer:  { paddingBottom: responsiveHeight(5) },
  loadingContainer:  { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(2),
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  headerTitle: { fontSize: responsiveFontSize(2.5), color: colors.black, fontWeight: "700" },
  submitText:  { color: colors.brandColor, fontSize: responsiveFontSize(2), fontWeight: "bold" },

  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: responsiveHeight(2),
  },
  tabButton: {
    paddingVertical: responsiveHeight(1.2),
    paddingHorizontal: responsiveWidth(5),
    borderRadius: 20,
    marginHorizontal: responsiveWidth(1),
    backgroundColor: "#E0E0E0",
  },
  activeTab:     { backgroundColor: colors.brandColor },
  tabText:       { fontSize: responsiveFontSize(1.8), color: colors.black, fontWeight: "500" },
  activeTabText: { color: "#FFF" },

  card: {
    backgroundColor: "#FFF",
    marginHorizontal: responsiveWidth(4),
    marginBottom: responsiveHeight(2),
    padding: responsiveWidth(4),
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1.5),
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingBottom: responsiveHeight(1),
  },

  imageUploadButton: {
    borderWidth: 1.5,
    borderColor: colors.brandColor,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: responsiveWidth(4),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  imageUploadText: {
    color: colors.brandColor,
    fontSize: responsiveFontSize(1.8),
    marginLeft: responsiveWidth(2),
    fontWeight: "600",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: responsiveHeight(2),
  },
  imageWrapper: {
    position: "relative",
    marginRight: responsiveWidth(2),
    marginBottom: responsiveWidth(2),
  },
  imagePreview:     { width: responsiveWidth(20), height: responsiveWidth(20), borderRadius: 8 },
  deleteImageButton:{ position: "absolute", top: -8, right: -8, backgroundColor: "#FFF", borderRadius: 12, padding: 2 },

  label:      { fontSize: responsiveFontSize(1.9), color: colors.gray, marginBottom: responsiveHeight(1), fontWeight: "500" },
  helperText: { fontSize: responsiveFontSize(1.6), color: colors.gray, marginTop: -responsiveHeight(1.5), marginBottom: responsiveHeight(1.5), paddingLeft: responsiveWidth(1) },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(2),
  },

  vehicleTypeContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: responsiveHeight(2) },
  vehicleTypeButton: {
    flex: 1,
    paddingVertical: responsiveHeight(1.5),
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    alignItems: "center",
    marginHorizontal: responsiveWidth(1),
  },
  activeVehicleTypeButton:     { borderColor: colors.brandColor, backgroundColor: "#E3F2FD" },
  vehicleTypeButtonText:       { fontSize: responsiveFontSize(1.8), color: colors.gray, fontWeight: "600" },
  activeVehicleTypeButtonText: { color: colors.brandColor },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(2),
    paddingVertical: responsiveHeight(0.5),
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(2),
    paddingVertical: responsiveHeight(0.5),
  },
  switchButton:      { paddingVertical: responsiveHeight(0.5), paddingHorizontal: responsiveWidth(4), borderRadius: 15, borderWidth: 1, borderColor: colors.lightGray, backgroundColor: "#F5F5F5" },
  switchButtonActive:{ backgroundColor: colors.brandColor, borderColor: colors.brandColor },
  switchText:        { fontSize: responsiveFontSize(1.6), color: colors.gray, fontWeight: "600" },

  dayContainer: { marginBottom: responsiveHeight(2), paddingBottom: responsiveHeight(2), borderBottomWidth: 1, borderBottomColor: "#EEE" },
  dayLabel:     { fontSize: responsiveFontSize(2), fontWeight: "bold", color: colors.black, marginBottom: responsiveHeight(1) },

  locationButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 8,
    alignItems: "center",
    marginTop: responsiveHeight(1),
  },
  locationButtonText: { color: "#FFF", fontSize: responsiveFontSize(1.8), fontWeight: "600" },

  submitButton: {
    backgroundColor: colors.brandColor,
    marginHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(2),
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: responsiveHeight(2),
  },
  submitButtonText: { color: "#FFF", fontSize: responsiveFontSize(2.2), fontWeight: "bold" },

  // ── Shared plan card ──────────────────────────────────────────────────────
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.5),
  },
  planHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  planIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFF3E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: responsiveWidth(3),
  },
  planSubtitle: { fontSize: responsiveFontSize(1.5), color: colors.gray, marginTop: 2 },

  // ── Rate input ────────────────────────────────────────────────────────────
  rateContainer: { marginTop: responsiveHeight(0.5) },
  rateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: responsiveWidth(4),
    height: 52,
    backgroundColor: "#F5F5F5",
    marginBottom: responsiveHeight(1),
  },
  ratePrefix: { fontSize: responsiveFontSize(2.2), fontWeight: "700", color: colors.gray, marginRight: 6 },
  rateInput:  { flex: 1, fontSize: responsiveFontSize(2.2), fontWeight: "700", color: colors.black },
  rateSuffix: { fontSize: responsiveFontSize(1.6), color: colors.gray },
  ratePreview: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: responsiveWidth(4),
    marginTop: responsiveHeight(0.5),
    gap: 8,
  },
  ratePreviewRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratePreviewLabel: { fontSize: responsiveFontSize(1.6), color: colors.gray },
  ratePreviewValue: { fontSize: responsiveFontSize(1.6), fontWeight: "700", color: colors.black },

  // ── Daily rate ────────────────────────────────────────────────────────────
  dailyRateBody: { marginTop: responsiveHeight(0.5) },
  dailyRateHint: {
    fontSize: responsiveFontSize(1.5),
    color: colors.gray,
    marginBottom: responsiveHeight(1.5),
    lineHeight: responsiveHeight(2.2),
  },
  slotCard: {
    backgroundColor: "#F9F9FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8F0",
    padding: responsiveWidth(3.5),
    marginBottom: responsiveHeight(1.5),
  },
  slotHeader:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: responsiveHeight(1) },
  slotIndex:           { fontSize: responsiveFontSize(1.7), fontWeight: "700", color: colors.black },
  slotTimeRow:         { flexDirection: "row", alignItems: "flex-end", gap: responsiveWidth(2), marginBottom: responsiveHeight(1) },
  slotTimeGroup:       { flex: 1 },
  slotTimeDivider:     { paddingBottom: responsiveHeight(1.2), justifyContent: "flex-end" },
  slotTimeDividerText: { fontSize: responsiveFontSize(2), color: colors.gray, fontWeight: "700" },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(1.2),
    marginBottom: responsiveHeight(1),
  },
  timePickerButtonText: { fontSize: responsiveFontSize(1.9), fontWeight: "700", color: colors.brandColor },
  addSlotButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.brandColor,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: responsiveHeight(1.5),
    gap: responsiveWidth(2),
    marginTop: responsiveHeight(0.5),
  },
  addSlotText: { fontSize: responsiveFontSize(1.7), color: colors.brandColor, fontWeight: "600" },
});

export default MerchantResidenceForm;