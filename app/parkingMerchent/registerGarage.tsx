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
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from "react-native-responsive-dimensions";
import {
  ArrowLeft,
  Camera,
  Trash2,
  Plus,
  MapPin,
  Repeat,
  Clock,
  X,
} from "lucide-react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../components/redux/store";
import axiosInstance from "../../api/axios";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Picker } from "@react-native-picker/picker";
import colors from "../../assets/color";
import TimeWheelPicker from "./Timewheelpicker";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkingHours {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  is24Hours: boolean;
}

interface IDailyRateSlot {
  label: string;
  fromTime: string;
  toTime: string;
  price: number;
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
  location: { type: string; coordinates: number[] };
  emergencyContact?: { person: string; number: string };
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

const MerchantGarageForm = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const garageId = params.garageId as string | undefined;

  const [selectedTab, setSelectedTab] = useState("Garage");
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

  const [formData, setFormData] = useState<GarageFormData>({
    garageName: "",
    about: "",
    address: "",
    contactNumber: user?.phoneNumber || "",
    email: user?.email || "",
    price: 100,
    workingHours: [
      { day: "SUN", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "MON", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "TUE", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "WED", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "THU", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "FRI", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
      { day: "SAT", isOpen: true, openTime: "09:00", closeTime: "17:00", is24Hours: false },
    ],
    is24x7: false,
    vehicleType: "both",
    spacesList: { A: { count: 10, price: 100 }, B: { count: 5, price: 150 } },
    location: { type: "Point", coordinates: [0, 0] },
    monthlyChargeEnabled: false,
    monthlyRate: 0,
    dailyRateEnabled: false,
    dailyRates: [],
  });

  useEffect(() => {
    if (garageId) fetchGarageDetails();
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
      Alert.alert("Location Error", "Could not get your current location");
    }
  };

  const fetchGarageDetails = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/merchants/garage/${garageId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // garage is nested under response.data.garage or response.data.data.garage
      const d =
        response.data?.garage ??
        response.data?.data?.garage ??
        response.data?.data ??
        response.data;
      setFormData({
        garageName:           d.garageName,
        about:                d.about,
        address:              d.address,
        contactNumber:        d.contactNumber,
        email:                d.email,
        price:                d.price || 100,
        workingHours:         d.generalAvailable,
        is24x7:               d.is24x7,
        vehicleType:          d.vehicleType,
        spacesList:           Object.fromEntries(d.spacesList),
        location:             d.location,
        emergencyContact:     d.emergencyContact,
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
      Alert.alert("Error", "Failed to fetch garage details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    try {
      const { granted } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission Denied", "Camera roll permission is required");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: Math.max(0, 5 - images.length),
      });
      if (result.canceled) return;
      if (result.assets?.length) {
        const newImages = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.uri?.split("/").pop() || `image_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        }));
        setImages((prev) => [...prev, ...newImages]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select images");
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const handleChange = (field: keyof GarageFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleWorkingHoursChange = (
    index: number,
    field: keyof WorkingHours,
    value: any,
  ) => {
    const newWorkingHours = [...formData.workingHours];
    newWorkingHours[index] = { ...newWorkingHours[index], [field]: value };
    setFormData((prev) => ({ ...prev, workingHours: newWorkingHours }));
  };

  const handleSpaceChange = (
    zone: string,
    field: "count" | "price",
    value: string,
  ) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      spacesList: {
        ...prev.spacesList,
        [zone]: { ...prev.spacesList[zone], [field]: numValue },
      },
    }));
  };

  const addZone = () => {
    const zones = Object.keys(formData.spacesList);
    let newZone = "A";
    if (zones.length > 0)
      newZone = String.fromCharCode(zones[zones.length - 1].charCodeAt(0) + 1);
    setFormData((prev) => ({
      ...prev,
      spacesList: { ...prev.spacesList, [newZone]: { count: 0, price: 0 } },
    }));
  };

  const removeZone = (zone: string) => {
    if (Object.keys(formData.spacesList).length <= 1) {
      Alert.alert("Error", "You must have at least one zone");
      return;
    }
    const newSpaces = { ...formData.spacesList };
    delete newSpaces[zone];
    setFormData((prev) => ({ ...prev, spacesList: newSpaces }));
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
      Alert.alert(
        "Validation Error",
        "Add at least one time slot when daily rate is enabled.",
      );
      return false;
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.label.trim()) {
        Alert.alert("Validation Error", `Slot ${i + 1}: label is required.`);
        return false;
      }
      if (!isValidTime(s.fromTime)) {
        Alert.alert(
          "Validation Error",
          `Slot ${i + 1}: fromTime must be HH:MM (e.g. "06:00").`,
        );
        return false;
      }
      if (!isValidTime(s.toTime)) {
        Alert.alert(
          "Validation Error",
          `Slot ${i + 1}: toTime must be HH:MM. Use "00:00" for midnight.`,
        );
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
    if (!formData.garageName || !formData.address || !formData.contactNumber) {
      Alert.alert("Validation Error", "Please fill all required fields");
      return;
    }
    if (formData.monthlyChargeEnabled && formData.monthlyRate <= 0) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid Monthly/Permit rate greater than 0.",
      );
      return;
    }
    if (!validateDailyRates()) return;

    try {
      setIsLoading(true);

      // ── Step 1: register / update garage ──────────────────────────────────
      const data = new FormData();
      data.append("garageName",    formData.garageName);
      data.append("about",         formData.about);
      data.append("address",       formData.address);
      data.append("contactNumber", formData.contactNumber);
      data.append("email",         formData.email);
      data.append("is24x7",        formData.is24x7.toString());
      data.append("price",         formData.price.toString());
      data.append("vehicleType",   formData.vehicleType);
      data.append("generalAvailable", JSON.stringify(formData.workingHours));
      data.append("spacesList",    JSON.stringify(formData.spacesList));
      data.append("location",      JSON.stringify(formData.location));
      data.append("monthlyChargeEnabled", formData.monthlyChargeEnabled.toString());
      data.append("monthlyRate",   formData.monthlyRate.toString());
      // Note: dailyRateEnabled / dailyRates go via PATCH /daily-rate-settings below

      images.forEach((image) => {
        if (image.uri.startsWith("file://") || !image.uri.startsWith("http")) {
          data.append("images", {
            uri:  image.uri,
            name: image.name,
            type: image.type,
          } as any);
        }
      });

      if (garageId) {
        const existingImageUrls = images
          .filter((img) => img.uri.startsWith("http"))
          .map((img) => img.uri);
        if (existingImageUrls.length > 0)
          data.append("existingImages", JSON.stringify(existingImageUrls));
      }

      const endpoint = garageId
        ? `/merchants/garage/update/${garageId}`
        : "/merchants/garage/registration";
      const method = garageId ? "put" : "post";

      const response = await axiosInstance[method](endpoint, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      // ── Step 2: save daily rate ────────────────────────────────────────────
      // registerGarage returns: new ApiResponse(201, { garage: newGarage })
      // ApiResponse typically wraps as { statusCode, data: { garage } }
      // Try all known shapes so this is robust.
      const body = response.data;
      const savedGarageId: string | undefined =
        garageId ??
        body?.data?.garage?._id ??
        body?.garage?._id        ??
        body?.data?._id          ??
        body?._id;

      if (savedGarageId) {
        try {
          await axiosInstance.patch(
            "/merchants/daily-rate-settings",
            {
              venueType:        "garage",
              venueId:          savedGarageId,
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
          // Garage was saved — warn but don't block navigation
          Alert.alert(
            "Warning",
            "Garage saved, but daily rate slots could not be saved: " +
              (dailyRateErr.response?.data?.message || dailyRateErr.message),
          );
          router.back();
          return;
        }
      }

      Alert.alert(
        "Success",
        garageId ? "Garage updated successfully" : "Garage created successfully",
      );
      router.back();
    } catch (error: any) {
      let errorMessage = "Failed to submit garage details";
      if (error.response?.data?.message)
        errorMessage = error.response.data.message;
      else if (error.response?.data?.errors?.length > 0)
        errorMessage =
          "Validation Errors:\n" +
          error.response.data.errors.map((e: any) => e.message).join("\n");
      else if (error.message) errorMessage = error.message;
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !formData.garageName) {
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
              {garageId ? "Edit Garage" : "Add Garage"}
            </Text>
            <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
              <Text style={styles.submitText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Container */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, selectedTab === "Residence" && styles.activeTab]}
              onPress={() => { setSelectedTab("Residence"); router.push("/merchant/residence-form"); }}
            >
              <Text style={[styles.tabText, selectedTab === "Residence" && styles.activeTabText]}>
                Residence
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, selectedTab === "Parking Lot" && styles.activeTab]}
              onPress={() => { setSelectedTab("Parking Lot"); router.push("/merchant/parking-form"); }}
            >
              <Text style={[styles.tabText, selectedTab === "Parking Lot" && styles.activeTabText]}>
                Parking Lot
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, selectedTab === "Garage" && styles.activeTab]}
              onPress={() => setSelectedTab("Garage")}
            >
              <Text style={[styles.tabText, selectedTab === "Garage" && styles.activeTabText]}>
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
                    <Image source={{ uri: image.uri }} style={styles.imagePreview} />
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

          {/* Garage Details */}
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
                onChangeText={(text) => handleChange("price", parseInt(text) || 0)}
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
                  <Picker.Item label="Cars Only"           value="car"  />
                  <Picker.Item label="Bikes Only"          value="bike" />
                </Picker>
              </View>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>24/7 Open</Text>
                <TouchableOpacity
                  style={[styles.switchButton, formData.is24x7 && styles.switchButtonActive]}
                  onPress={() => handleChange("is24x7", !formData.is24x7)}
                >
                  <Text style={[styles.switchText, formData.is24x7 && styles.switchTextActive]}>
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
                      style={[styles.switchButton, day.isOpen && styles.switchButtonActive]}
                      onPress={() => handleWorkingHoursChange(index, "isOpen", !day.isOpen)}
                    >
                      <Text style={[styles.switchText, day.isOpen && styles.switchTextActive]}>
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
                        placeholder="09:00"
                      />
                      <Text style={styles.label}>Close Time</Text>
                      <TextInput
                        style={styles.input}
                        value={day.closeTime}
                        onChangeText={(text) => handleWorkingHoursChange(index, "closeTime", text)}
                        placeholder="17:00"
                      />
                    </>
                  )}
                  <View style={styles.switchContainer}>
                    <Text style={styles.label}>24 Hours</Text>
                    <TouchableOpacity
                      style={[styles.switchButton, day.is24Hours && styles.switchButtonActive]}
                      onPress={() => handleWorkingHoursChange(index, "is24Hours", !day.is24Hours)}
                    >
                      <Text style={[styles.switchText, day.is24Hours && styles.switchTextActive]}>
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
                      onChangeText={(text) => handleSpaceChange(zone, "count", text)}
                      placeholder="Number of slots"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.spaceInputContainer}>
                    <Text style={styles.label}>Price</Text>
                    <TextInput
                      style={styles.input}
                      value={space.price.toString()}
                      onChangeText={(text) => handleSpaceChange(zone, "price", text)}
                      placeholder="Price per hour"
                      keyboardType="numeric"
                    />
                  </View>
                  {Object.keys(formData.spacesList).length > 1 && (
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeZone(zone)}>
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
                      <Text style={styles.ratePreviewLabel}>Monthly/Permit Rate</Text>
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
                <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
                  <MapPin size={20} color="#FFF" />
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
                {garageId ? "Update Garage" : "Save Garage"}
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
  container:          { flex: 1, backgroundColor: "#FAFAFA" },
  contentContainer:   { paddingBottom: 30 },
  loadingContainer:   { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },

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
  headerTitle:  { fontSize: 18, fontWeight: "bold", color: colors.black },
  submitText:   { color: colors.brandColor, fontSize: 16, fontWeight: "bold" },

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
  activeTab:     { backgroundColor: colors.brandColor },
  tabText:       { fontSize: responsiveFontSize(1.8), color: colors.black },
  activeTabText: { color: "#FFF" },

  imageUploadContainer: { paddingHorizontal: 20, paddingVertical: 15 },
  imageUploadButton: {
    borderWidth: 1,
    borderColor: colors.brandColor,
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  imageUploadText:       { color: colors.brandColor, fontSize: 16, marginLeft: 10 },
  imagePreviewContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  imageWrapper:          { position: "relative", margin: 5 },
  imagePreview:          { width: 100, height: 100, borderRadius: 5 },
  deleteImageButton: {
    position: "absolute",
    top: 5, right: 5,
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
  inputContainer: { flex: 1 },
  label:          { fontSize: 14, color: colors.gray, marginBottom: 5 },
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
  textArea:        { minHeight: 80, textAlignVertical: "top" },
  pickerContainer: { backgroundColor: "#F5F5F5", borderRadius: 8, borderWidth: 1, borderColor: colors.lightGray, marginBottom: 15 },
  picker:          { height: 50 },

  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colors.black, marginBottom: 15 },

  spaceContainer:     { marginBottom: 15 },
  spaceInputRow:      { flexDirection: "row", alignItems: "center" },
  spaceInputContainer:{ flex: 1, marginRight: 10 },
  zoneLabel:          { fontSize: 16, fontWeight: "bold", color: colors.black, marginBottom: 10 },
  removeButton:       { padding: 10 },
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
  addButtonText: { color: colors.brandColor, fontSize: 16, marginLeft: 10 },

  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  switchButton:      { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderColor: colors.brandColor },
  switchButtonActive:{ backgroundColor: colors.brandColor },
  switchText:        { fontSize: 14, color: colors.black },
  switchTextActive:  { color: "#FFF" },

  dayContainer: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  dayLabel:     { fontSize: 16, fontWeight: "bold", color: colors.black, marginBottom: 10 },

  locationButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  locationButtonText: { color: "#FFF", fontSize: 16, marginLeft: 8 },

  submitButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

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
  ratePreviewRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratePreviewLabel:{ fontSize: responsiveFontSize(1.6), color: colors.gray },
  ratePreviewValue:{ fontSize: responsiveFontSize(1.6), fontWeight: "700", color: colors.black },

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
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(1),
  },
  slotIndex: { fontSize: responsiveFontSize(1.7), fontWeight: "700", color: colors.black },
  slotTimeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(1),
  },
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

export default MerchantGarageForm;