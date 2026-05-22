import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useSelector } from "react-redux";
import axiosInstance from "../../api/axios";
import colors from "../../assets/color";
import { images } from "../../assets/images/images";
import { RootState } from "../../components/redux/store";
import TimeWheelPicker from "./Timewheelpicker";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpaceInfo {
  count: number;
  price: number;
}

interface WorkingHours {
  day: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
  is24Hours: boolean;
}

interface IDailyRateSlot {
  _id?: string;
  label: string;
  fromTime: string;
  toTime: string;
  price: number;
}

interface IParkingLot {
  _id: string;
  parkingName: string;
  about: string;
  address: string;
  contactNumber: string;
  email?: string;
  price: number;
  images: string[];
  spacesList: Record<string, SpaceInfo>;
  generalAvailable: WorkingHours[];
  is24x7: boolean;
  gpsLocation: { type: "Point"; coordinates: [number, number] };
  isActive: boolean;
  monthlyChargeEnabled: boolean;
  monthlyRate: number;
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

const ParkingDetails = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { token } = useSelector((state: RootState) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [parkingLotDetails, setParkingLotDetails] = useState<IParkingLot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IParkingLot>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDailyRateSaving, setIsDailyRateSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{
    day: string;
    field: "open" | "close";
  } | null>(null);
  const [localImages, setLocalImages] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ── Time Wheel Picker state ───────────────────────────────────────────────
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    slotIndex: number;
    field: "fromTime" | "toTime";
  } | null>(null);
  const [timePickerValue, setTimePickerValue] = useState("06:00");

  const parkingLotId = params.parkingLotId as string;
  const parkingLotDataString = params.parkingLotData as string | undefined;
  const parkingLotData = parkingLotDataString
    ? JSON.parse(parkingLotDataString)
    : undefined;

  // ── Guard unsaved changes ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!isEditing) return;
      e.preventDefault();
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, isEditing]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchParkingLotDetails = useCallback(
    async (showLoader = true) => {
      if (isEditing) return;
      if (!parkingLotId) { setError("No parking lot ID provided."); return; }
      try {
        if (showLoader) setIsLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/merchants/parkinglot/${parkingLotId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data?.success && response.data.data) {
          const fd = response.data.data;
          const formattedSpacesList = fd.spacesList
            ? Object.fromEntries(
                Object.entries(fd.spacesList).map(([k, v]: [string, any]) => [
                  k,
                  { count: v.count, price: v.price },
                ])
              )
            : {};
          const fullData: IParkingLot = {
            ...fd,
            spacesList: formattedSpacesList,
            generalAvailable: fd.generalAvailable || [],
            images: fd.images || [],
            gpsLocation: fd.gpsLocation || { type: "Point", coordinates: [0, 0] },
            price: fd.price || 0,
            monthlyChargeEnabled: fd.monthlyChargeEnabled ?? false,
            monthlyRate: fd.monthlyRate ?? 0,
            dailyRateEnabled: fd.dailyRateEnabled ?? false,
            dailyRates: fd.dailyRates ?? [],
          };
          setParkingLotDetails(fullData);
          if (!isEditing) setFormData(fullData);
          setLocalImages(
            fullData.images.map((uri) => ({
              uri,
              name: uri.split("/").pop() || "image.jpg",
              type: "image/jpeg",
            }))
          );
        } else {
          throw new Error(response.data?.message || "Invalid response.");
        }
      } catch (err: any) {
        setError("Failed to load: " + (err.response?.data?.message || err.message));
      } finally {
        if (showLoader) setIsLoading(false);
        setRefreshing(false);
      }
    },
    [parkingLotId, token, isEditing]
  );

  // ── Focus effect ───────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (isEditing) return;
      if (parkingLotId) {
        fetchParkingLotDetails();
      } else if (parkingLotData) {
        const formattedSpacesList = parkingLotData.spacesList
          ? Object.fromEntries(
              Object.entries(parkingLotData.spacesList).map(
                ([k, v]: [string, any]) => [k, { count: v.count, price: v.price }]
              )
            )
          : {};
        const fullData: IParkingLot = {
          ...parkingLotData,
          spacesList: formattedSpacesList,
          generalAvailable: parkingLotData.generalAvailable || [],
          images: parkingLotData.images || [],
          gpsLocation: parkingLotData.gpsLocation || { type: "Point", coordinates: [0, 0] },
          price: parkingLotData.price || 0,
          monthlyChargeEnabled: parkingLotData.monthlyChargeEnabled ?? false,
          monthlyRate: parkingLotData.monthlyRate ?? 0,
          dailyRateEnabled: parkingLotData.dailyRateEnabled ?? false,
          dailyRates: parkingLotData.dailyRates ?? [],
        };
        setParkingLotDetails(fullData);
        if (!isEditing) setFormData(fullData);
        setLocalImages(
          fullData.images.map((uri) => ({
            uri,
            name: uri.split("/").pop() || "image.jpg",
            type: "image/jpeg",
          }))
        );
      } else {
        setError("No parking lot information provided.");
      }
    }, [fetchParkingLotDetails, parkingLotId, parkingLotData, isEditing])
  );

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteParkingLot = () => {
    if (!parkingLotId) { Alert.alert("Error", "Parking Lot ID not found."); return; }
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this parking lot? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await axiosInstance.delete(
                `/merchants/parkinglot/delete/${parkingLotId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert("Success", "Parking Lot deleted successfully.");
              router.back();
            } catch (err: any) {
              Alert.alert(
                "Deletion Failed",
                err.response?.data?.message || "Something went wrong"
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Image helpers ──────────────────────────────────────────────────────────
  const handleNextImage = () =>
    setCurrentImageIndex((prev) =>
      prev === localImages.length - 1 ? 0 : prev + 1
    );
  const handlePrevImage = () =>
    setCurrentImageIndex((prev) =>
      prev === 0 ? localImages.length - 1 : prev - 1
    );

  const handleRefresh = useCallback(async () => {
    if (isEditing) {
      Alert.alert(
        "Cannot Refresh",
        "Please save or cancel your changes before refreshing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard & Refresh",
            style: "destructive",
            onPress: async () => {
              setIsEditing(false);
              setRefreshing(true);
              await fetchParkingLotDetails(false);
            },
          },
        ]
      );
      return;
    }
    setRefreshing(true);
    await fetchParkingLotDetails(false);
  }, [fetchParkingLotDetails, isEditing]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof IParkingLot, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleDayChange = (index: number, field: string, value: any) => {
    const updated = [...(formData.generalAvailable || [])];
    updated[index] = { ...updated[index], [field]: value };
    handleInputChange("generalAvailable", updated);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime && showTimePicker) {
      const timeStr = `${selectedTime
        .getHours()
        .toString()
        .padStart(2, "0")}:${selectedTime
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      const dayIndex =
        formData.generalAvailable?.findIndex(
          (d) => d.day === showTimePicker.day
        ) ?? -1;
      if (dayIndex !== -1 && formData.generalAvailable) {
        const newGA = [...formData.generalAvailable];
        if (showTimePicker.field === "open") newGA[dayIndex].openTime = timeStr;
        else newGA[dayIndex].closeTime = timeStr;
        handleInputChange("generalAvailable", newGA);
      }
    }
    setShowTimePicker(null);
  };

  const handleSpaceChange = (
    zone: string,
    field: keyof SpaceInfo,
    value: string
  ) => {
    const numValue =
      field === "count" ? parseInt(value) || 0 : parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      spacesList: {
        ...prev.spacesList,
        [zone]: {
          ...(prev.spacesList?.[zone] || { count: 0, price: 0 }),
          [field]: numValue,
        },
      },
    }));
  };

  const handleImagePickerForEdit = async () => {
    try {
      const { granted } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "You need to grant permission to access the photo library."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: Math.max(0, 5 - localImages.length),
      });
      if (result.canceled) return;
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.uri?.split("/").pop() || `image_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      }));
      setLocalImages((prev) => [...prev, ...newImages]);
    } catch {
      Alert.alert("Error", "Failed to select images");
    }
  };

  const removeLocalImage = (index: number) => {
    const updated = [...localImages];
    updated.splice(index, 1);
    setLocalImages(updated);
    if (currentImageIndex >= updated.length && updated.length > 0)
      setCurrentImageIndex(updated.length - 1);
    else if (updated.length === 0) setCurrentImageIndex(0);
  };

  // ── Daily Rate helpers ─────────────────────────────────────────────────────
  const handleDailyRateSlotChange = (
    index: number,
    field: keyof IDailyRateSlot,
    value: any
  ) => {
    const slots = [...(formData.dailyRates || [])];
    slots[index] = { ...slots[index], [field]: value };
    handleInputChange("dailyRates", slots);
  };

  const addDailyRateSlot = () =>
    handleInputChange("dailyRates", [
      ...(formData.dailyRates || []),
      emptySlot(),
    ]);

  const removeDailyRateSlot = (index: number) => {
    const slots = [...(formData.dailyRates || [])];
    slots.splice(index, 1);
    handleInputChange("dailyRates", slots);
  };

  // ── Time Wheel Picker helpers ──────────────────────────────────────────────
  const openTimePicker = (
    slotIndex: number,
    field: "fromTime" | "toTime"
  ) => {
    const slot = formData.dailyRates?.[slotIndex];
    setTimePickerValue(
      (field === "fromTime" ? slot?.fromTime : slot?.toTime) || "06:00"
    );
    setTimePickerTarget({ slotIndex, field });
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (time: string) => {
    if (timePickerTarget) {
      handleDailyRateSlotChange(
        timePickerTarget.slotIndex,
        timePickerTarget.field,
        time
      );
    }
    setTimePickerVisible(false);
    setTimePickerTarget(null);
  };

  // ── Save daily rate ────────────────────────────────────────────────────────
  const handleSaveDailyRate = async () => {
    if (!parkingLotId) return;
    const slots: IDailyRateSlot[] = formData.dailyRates || [];

    if (formData.dailyRateEnabled) {
      if (slots.length === 0) {
        Alert.alert(
          "Validation Error",
          "Add at least one time slot when daily rate is enabled."
        );
        return;
      }
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s.label.trim()) {
          Alert.alert("Validation Error", `Slot ${i + 1}: label is required.`);
          return;
        }
        if (!isValidTime(s.fromTime)) {
          Alert.alert(
            "Validation Error",
            `Slot ${i + 1}: fromTime must be HH:MM (e.g. "06:00").`
          );
          return;
        }
        if (!isValidTime(s.toTime)) {
          Alert.alert(
            "Validation Error",
            `Slot ${i + 1}: toTime must be HH:MM. Use "00:00" for midnight.`
          );
          return;
        }
        if (s.price < 0) {
          Alert.alert("Validation Error", `Slot ${i + 1}: price must be ≥ 0.`);
          return;
        }
      }
    }

    try {
      setIsDailyRateSaving(true);
      const response = await axiosInstance.patch(
        "/merchants/daily-rate-settings",
        {
          venueType: "parking",
          venueId: parkingLotId,
          dailyRateEnabled: formData.dailyRateEnabled ?? false,
          dailyRates: slots.map(({ _id, ...rest }) => rest),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.success) {
        Alert.alert("Success", "Daily rate settings saved.");
        await fetchParkingLotDetails(false);
      } else {
        throw new Error(response.data?.message || "Save failed");
      }
    } catch (err: any) {
      const responseData = err.response?.data;
      const issues: any[] =
        responseData?.issues ||
        responseData?.data?.issues ||
        responseData?.errors ||
        [];

      let msg: string;

      if (Array.isArray(issues) && issues.length > 0) {
        msg = issues
          .map((issue: any) => {
            const pathStr =
              Array.isArray(issue.path) && issue.path.length > 0
                ? issue.path
                    .map((p: any) =>
                      typeof p === "number" ? `Slot ${p + 1}` : p
                    )
                    .filter(
                      (p: any) =>
                        p !== "dailyRates" &&
                        p !== "fromTime" &&
                        p !== "toTime"
                    )
                    .join(" → ")
                : null;
            return pathStr ? `${pathStr}: ${issue.message}` : issue.message;
          })
          .join("\n");
      } else {
        msg =
          responseData?.message ||
          err.message ||
          "Failed to save daily rate settings.";
      }

      Alert.alert("Error", msg);
    } finally {
      setIsDailyRateSaving(false);
    }
  };

  // ── Update main details ────────────────────────────────────────────────────
  const handleUpdateParkingLot = async () => {
    if (!parkingLotId || !formData) return;
    if (formData.monthlyChargeEnabled && (formData.monthlyRate ?? 0) <= 0) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid Monthly/Permit rate greater than 0."
      );
      return;
    }
    try {
      setIsUpdating(true);
      setError(null);

      const data = new FormData();
      data.append("parkingName", formData.parkingName || "");
      data.append("about", formData.about || "");
      data.append("address", formData.address || "");
      data.append("contactNumber", formData.contactNumber || "");
      if (formData.email) data.append("email", formData.email);
      data.append("is24x7", String(formData.is24x7 || false));
      data.append("price", String(formData.price || 0));
      data.append("isActive", String(formData.isActive || false));
      data.append("monthlyChargeEnabled", String(formData.monthlyChargeEnabled || false));
      data.append("monthlyRate", String(formData.monthlyRate || 0));
      data.append("generalAvailable", JSON.stringify(formData.generalAvailable || []));
      data.append("spacesList", JSON.stringify(formData.spacesList || {}));
      data.append(
        "gpsLocation",
        JSON.stringify(
          formData.gpsLocation || { type: "Point", coordinates: [0, 0] }
        )
      );

      const newFiles = localImages.filter((img) => !img.uri.startsWith("http"));
      const existingUrls = localImages
        .filter((img) => img.uri.startsWith("http"))
        .map((img) => img.uri);
      data.append("existingImages", JSON.stringify(existingUrls));
      newFiles.forEach((image) =>
        data.append("images", {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as any)
      );

      const response = await axiosInstance.put(
        `/merchants/parkinglot/update/${parkingLotId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data?.success) {
        await handleSaveDailyRate();
        Alert.alert("Success", "Parking Lot updated successfully");
        setIsEditing(false);
        await fetchParkingLotDetails(false);
      } else {
        throw new Error(response.data?.message || "Update failed");
      }
    } catch (err: any) {
      const responseData = err.response?.data;
      const issues: any[] =
        responseData?.issues ||
        responseData?.data?.issues ||
        responseData?.errors ||
        [];

      let msg: string;

      if (Array.isArray(issues) && issues.length > 0) {
        msg = issues
          .map((issue: any) => {
            const pathStr =
              Array.isArray(issue.path) && issue.path.length > 0
                ? issue.path
                    .map((p: any) =>
                      typeof p === "number" ? `Slot ${p + 1}` : p
                    )
                    .filter(
                      (p: any) =>
                        p !== "dailyRates" &&
                        p !== "fromTime" &&
                        p !== "toTime"
                    )
                    .join(" → ")
                : null;
            return pathStr ? `${pathStr}: ${issue.message}` : issue.message;
          })
          .join("\n");
      } else {
        msg =
          responseData?.message ||
          err.message ||
          "Failed to update parking lot.";
      }

      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    if (!parkingLotDetails) return;
    setIsEditing(false);
    setFormData({ ...parkingLotDetails });
    setLocalImages(
      parkingLotDetails.images.map((uri) => ({
        uri,
        name: uri.split("/").pop() || "image.jpg",
        type: "image/jpeg",
      }))
    );
    setError(null);
  };

  const handleStartEditing = () => {
    if (parkingLotDetails && !formData.parkingName)
      setFormData({ ...parkingLotDetails });
    setIsEditing(true);
  };

  // ── Loading / Error guards ─────────────────────────────────────────────────
  if (isLoading && !parkingLotDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
        <Text style={styles.loadingText}>Loading parking lot details...</Text>
      </View>
    );
  }

  if (error && !parkingLotDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Parking Lot Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={60} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchParkingLotDetails()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!parkingLotDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Parking Lot Details</Text>
          <TouchableOpacity
            onPress={() => router.push("/parkingMerchent/registerParkingLot")}
          >
            <Plus size={35} color={colors.brandColor} />
          </TouchableOpacity>
        </View>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            No parking lot information available
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/parkingMerchent/registerParkingLot")}
          >
            <Text style={styles.addButtonText}>Add New Parking Lot</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            enabled={!isEditing && !isUpdating}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                Alert.alert(
                  "Discard changes?",
                  "You have unsaved changes. Leave anyway?",
                  [
                    { text: "Stay", style: "cancel" },
                    {
                      text: "Discard",
                      style: "destructive",
                      onPress: () => router.back(),
                    },
                  ]
                );
              } else {
                router.back();
              }
            }}
          >
            <ArrowLeft size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEditing ? "Edit Parking Lot" : parkingLotDetails.parkingName}
          </Text>
          <View style={styles.headerActions}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  disabled={isUpdating}
                >
                  <Text
                    style={[
                      styles.cancelText,
                      isUpdating && styles.disabledText,
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpdateParkingLot}
                  disabled={isUpdating}
                  style={[
                    styles.saveButton,
                    isUpdating && styles.saveButtonDisabled,
                  ]}
                >
                  <Text style={styles.saveText}>
                    {isUpdating ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={handleStartEditing}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteParkingLot}>
                  <Trash2 size={25} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Error Banner ────────────────────────────────────────────────── */}
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <X size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Image Gallery ────────────────────────────────────────────────── */}
        <View style={styles.imageGalleryContainer}>
          {localImages.length > 0 ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: localImages[currentImageIndex].uri }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
              {isEditing && (
                <TouchableOpacity
                  style={styles.deleteGalleryImageButton}
                  onPress={() => removeLocalImage(currentImageIndex)}
                >
                  <X size={20} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Image
              source={images.defaultParkingLot}
              style={styles.mainImagePlaceholder}
              resizeMode="cover"
            />
          )}
          {localImages.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.arrowButton, styles.leftArrow]}
                onPress={handlePrevImage}
              >
                <ChevronLeft size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, styles.rightArrow]}
                onPress={handleNextImage}
              >
                <ChevronRight size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {localImages.length}
                </Text>
              </View>
            </>
          )}
          {isEditing && (
            <TouchableOpacity
              style={styles.addImagesButton}
              onPress={handleImagePickerForEdit}
            >
              <Text style={styles.addImagesText}>Add/Replace Images</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Basic Info ──────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.label}>Parking Lot Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.parkingName || ""}
              onChangeText={(t) => handleInputChange("parkingName", t)}
              placeholder="Enter parking lot name"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.displayValue}>{parkingLotDetails.parkingName}</Text>
          )}

          <Text style={styles.label}>Address</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.address || ""}
              onChangeText={(t) => handleInputChange("address", t)}
              placeholder="Enter address"
              multiline
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.displayValue}>{parkingLotDetails.address}</Text>
          )}

          <Text style={styles.label}>Price per Hour</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.price?.toString() || ""}
              onChangeText={(t) =>
                handleInputChange("price", parseFloat(t) || 0)
              }
              keyboardType="numeric"
              placeholder="Enter price"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.priceValue}>
              ₹{parkingLotDetails.price?.toFixed(2) || "0.00"}/hr
            </Text>
          )}

          <View style={styles.switchContainer}>
            <Text style={styles.label}>24/7 Open</Text>
            {isEditing ? (
              <Switch
                value={formData.is24x7 || false}
                onValueChange={(v) => handleInputChange("is24x7", v)}
                trackColor={{ false: "#767577", true: colors.brandColor }}
                disabled={isUpdating}
              />
            ) : (
              <Text style={styles.displayValue}>
                {parkingLotDetails.is24x7 ? "Yes" : "No"}
              </Text>
            )}
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Active Listing</Text>
            {isEditing ? (
              <Switch
                value={formData.isActive || false}
                onValueChange={(v) => handleInputChange("isActive", v)}
                trackColor={{ false: "#767577", true: colors.brandColor }}
                disabled={isUpdating}
              />
            ) : (
              <Text style={styles.displayValue}>
                {parkingLotDetails.isActive ? "Yes" : "No"}
              </Text>
            )}
          </View>
        </View>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.aboutInput]}
              value={formData.about || ""}
              onChangeText={(t) => handleInputChange("about", t)}
              multiline
              placeholder="Describe your parking lot"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.aboutText}>
              {parkingLotDetails.about || "No description provided"}
            </Text>
          )}
        </View>

        {/* ── Contact ─────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.label}>Contact Number</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.contactNumber || ""}
              onChangeText={(t) => handleInputChange("contactNumber", t)}
              placeholder="Contact number"
              keyboardType="phone-pad"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.displayValue}>
              {parkingLotDetails.contactNumber}
            </Text>
          )}
          <Text style={styles.label}>Email</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.email || ""}
              onChangeText={(t) => handleInputChange("email", t)}
              placeholder="Email"
              keyboardType="email-address"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.displayValue}>
              {parkingLotDetails.email || "Not provided"}
            </Text>
          )}
        </View>

        {/* ── Monthly Plan ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.planCardHeader}>
            <View style={styles.planIconWrap}>
              <Repeat size={18} color={colors.brandColor} />
            </View>
            <Text style={styles.sectionTitle}>Monthly/Permit Plan</Text>
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Enable Monthly/Permit Plans</Text>
            {isEditing ? (
              <Switch
                value={formData.monthlyChargeEnabled || false}
                onValueChange={(v) => {
                  handleInputChange("monthlyChargeEnabled", v);
                  if (!v) handleInputChange("monthlyRate", 0);
                }}
                trackColor={{ false: "#767577", true: colors.brandColor }}
                disabled={isUpdating}
              />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: parkingLotDetails.monthlyChargeEnabled
                      ? "#F0FDF4"
                      : "#F5F5F5",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: parkingLotDetails.monthlyChargeEnabled
                        ? "#22C55E"
                        : colors.gray,
                    },
                  ]}
                >
                  {parkingLotDetails.monthlyChargeEnabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
            )}
          </View>

          {isEditing && formData.monthlyChargeEnabled && (
            <View style={styles.rateContainer}>
              <Text style={styles.label}>Monthly/Permit Rate per Slot</Text>
              <View style={styles.rateInputRow}>
                <Text style={styles.ratePrefix}>₹</Text>
                <TextInput
                  style={styles.rateInput}
                  value={
                    formData.monthlyRate && formData.monthlyRate > 0
                      ? formData.monthlyRate.toString()
                      : ""
                  }
                  onChangeText={(t) =>
                    handleInputChange("monthlyRate", parseFloat(t) || 0)
                  }
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.gray}
                  editable={!isUpdating}
                />
                <Text style={styles.rateSuffix}>/mo</Text>
              </View>
              {(formData.monthlyRate ?? 0) > 0 && (
                <View style={styles.ratePreview}>
                  <View style={styles.ratePreviewRow}>
                    <Text style={styles.ratePreviewLabel}>Monthly/Permit Rate</Text>
                    <Text style={styles.ratePreviewValue}>
                      ₹{(formData.monthlyRate ?? 0).toFixed(2)}/mo per slot
                    </Text>
                  </View>
                  <View style={styles.ratePreviewRow}>
                    <Text style={styles.ratePreviewLabel}>Annual per slot</Text>
                    <Text style={styles.ratePreviewValue}>
                      ₹{((formData.monthlyRate ?? 0) * 12).toFixed(2)}/yr
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {!isEditing && parkingLotDetails.monthlyChargeEnabled && (
            <View style={styles.planViewRow}>
              <Text style={styles.label}>Monthly/Permit Rate</Text>
              <Text style={styles.planRateDisplay}>
                ₹{parkingLotDetails.monthlyRate.toFixed(2)}
                <Text style={styles.planRateSuffix}>/mo per slot</Text>
              </Text>
            </View>
          )}
        </View>

        {/* ── Daily Rate ──────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.planCardHeader}>
            <View style={styles.planIconWrap}>
              <Clock size={18} color={colors.brandColor} />
            </View>
            <Text style={styles.sectionTitle}>Daily Rate (Time Slots)</Text>
          </View>

          <Text style={styles.dailyRateHint}>
            Define flat-fee time windows. Each window is charged once the
            booking enters it, regardless of duration. The last slot repeats
            for any overflow beyond midnight.
          </Text>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Enable Daily Rate Slots</Text>
            {isEditing ? (
              <Switch
                value={formData.dailyRateEnabled || false}
                onValueChange={(v) => {
                  handleInputChange("dailyRateEnabled", v);
                  if (!v) handleInputChange("dailyRates", []);
                }}
                trackColor={{ false: "#767577", true: colors.brandColor }}
                disabled={isUpdating}
              />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: parkingLotDetails.dailyRateEnabled
                      ? "#F0FDF4"
                      : "#F5F5F5",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: parkingLotDetails.dailyRateEnabled
                        ? "#22C55E"
                        : colors.gray,
                    },
                  ]}
                >
                  {parkingLotDetails.dailyRateEnabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
            )}
          </View>

          {/* ── Edit mode — slot builder ── */}
          {isEditing && formData.dailyRateEnabled && (
            <View>
              {(formData.dailyRates || []).map((slot, index) => (
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
                    onChangeText={(t) =>
                      handleDailyRateSlotChange(index, "label", t)
                    }
                    placeholder="e.g. Morning, Peak Hours"
                    editable={!isUpdating}
                  />

                  {/* ── Time row with wheel picker buttons ── */}
                  <View style={styles.slotTimeRow}>
                    <View style={styles.slotTimeGroup}>
                      <Text style={styles.label}>From</Text>
                      <TouchableOpacity
                        style={styles.timePickerButton}
                        onPress={() => openTimePicker(index, "fromTime")}
                        activeOpacity={0.7}
                        disabled={isUpdating}
                      >
                        <Clock
                          size={15}
                          color={colors.brandColor}
                          style={{ marginRight: 6 }}
                        />
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
                        disabled={isUpdating}
                      >
                        <Clock
                          size={15}
                          color={colors.brandColor}
                          style={{ marginRight: 6 }}
                        />
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
                        handleDailyRateSlotChange(
                          index,
                          "price",
                          parseFloat(t) || 0
                        )
                      }
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.gray}
                      editable={!isUpdating}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSlotButton}
                onPress={addDailyRateSlot}
                disabled={isUpdating}
              >
                <Plus size={18} color={colors.brandColor} />
                <Text style={styles.addSlotText}>Add Time Slot</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveDailyRateButton,
                  isDailyRateSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveDailyRate}
                disabled={isDailyRateSaving || isUpdating}
              >
                {isDailyRateSaving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveDailyRateText}>Save Daily Rate</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── View mode — slot list ── */}
          {!isEditing && parkingLotDetails.dailyRateEnabled && (
            <View>
              {parkingLotDetails.dailyRates.length === 0 ? (
                <Text style={styles.noSlotsText}>No slots configured yet.</Text>
              ) : (
                parkingLotDetails.dailyRates.map((slot, index) => (
                  <View key={index} style={styles.slotViewRow}>
                    <View style={styles.slotViewLeft}>
                      <Text style={styles.slotViewLabel}>{slot.label}</Text>
                      <Text style={styles.slotViewTime}>
                        {slot.fromTime} – {slot.toTime}
                      </Text>
                    </View>
                    <Text style={styles.slotViewPrice}>
                      ₹{slot.price.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── Parking Zones ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parking Zones & Spaces</Text>
          {Object.entries(
            formData.spacesList || parkingLotDetails.spacesList || {}
          ).map(([zone, spaceInfo]) => (
            <View key={zone} style={styles.zoneContainer}>
              <Text style={styles.zoneLabel}>Zone {zone}</Text>
              {isEditing ? (
                <View style={styles.spaceInputRow}>
                  <View style={styles.spaceInputGroup}>
                    <Text style={styles.label}>Number of Slots</Text>
                    <TextInput
                      style={styles.input}
                      value={spaceInfo?.count?.toString() || "0"}
                      onChangeText={(t) => handleSpaceChange(zone, "count", t)}
                      keyboardType="numeric"
                      editable={!isUpdating}
                    />
                  </View>
                  <View style={styles.spaceInputGroup}>
                    <Text style={styles.label}>Price for Zone (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={spaceInfo?.price?.toString() || "0"}
                      onChangeText={(t) => handleSpaceChange(zone, "price", t)}
                      keyboardType="decimal-pad"
                      editable={!isUpdating}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.spaceInfoRow}>
                  <View style={styles.spaceInfoItem}>
                    <Text style={styles.spaceInfoLabel}>Slots:</Text>
                    <Text style={styles.spaceInfoValue}>
                      {spaceInfo?.count || 0}
                    </Text>
                  </View>
                  <View style={styles.spaceInfoItem}>
                    <Text style={styles.spaceInfoLabel}>Price:</Text>
                    <Text style={styles.spaceInfoValue}>
                      ₹{spaceInfo?.price?.toFixed(2) || "0.00"}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))}
          {isEditing && (
            <TouchableOpacity
              style={[styles.editZonesButton, isUpdating && styles.disabledButton]}
              onPress={() =>
                router.push({
                  pathname: "/parkingMerchent/registerParkingLot",
                  params: { parkingLotId },
                })
              }
              disabled={isUpdating}
            >
              <Text style={styles.editZonesText}>Add/Remove Zones</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Working Hours ────────────────────────────────────────────────── */}
        {!formData.is24x7 && !parkingLotDetails.is24x7 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Working Hours</Text>
            {(
              formData.generalAvailable || parkingLotDetails.generalAvailable
            )?.map((day, index) => (
              <View key={day.day} style={styles.dayContainer}>
                <Text style={styles.dayLabel}>{day.day}</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Open</Text>
                  {isEditing ? (
                    <Switch
                      value={day.isOpen || false}
                      onValueChange={(v) => handleDayChange(index, "isOpen", v)}
                      trackColor={{ false: "#767577", true: colors.brandColor }}
                      disabled={isUpdating}
                    />
                  ) : (
                    <Text style={styles.displayValue}>
                      {day.isOpen ? "Yes" : "No"}
                    </Text>
                  )}
                </View>
                {day.isOpen && !day.is24Hours && (
                  <>
                    <Text style={styles.label}>Open Time</Text>
                    {isEditing ? (
                      <TouchableOpacity
                        style={[
                          styles.timeInputButton,
                          isUpdating && styles.disabledButton,
                        ]}
                        onPress={() =>
                          !isUpdating &&
                          setShowTimePicker({ day: day.day, field: "open" })
                        }
                        disabled={isUpdating}
                      >
                        <Text
                          style={[
                            styles.timeInputText,
                            isUpdating && styles.disabledText,
                          ]}
                        >
                          {day.openTime || "Select open time"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.displayValue}>
                        {day.openTime || "Not set"}
                      </Text>
                    )}
                    <Text style={styles.label}>Close Time</Text>
                    {isEditing ? (
                      <TouchableOpacity
                        style={[
                          styles.timeInputButton,
                          isUpdating && styles.disabledButton,
                        ]}
                        onPress={() =>
                          !isUpdating &&
                          setShowTimePicker({ day: day.day, field: "close" })
                        }
                        disabled={isUpdating}
                      >
                        <Text
                          style={[
                            styles.timeInputText,
                            isUpdating && styles.disabledText,
                          ]}
                        >
                          {day.closeTime || "Select close time"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.displayValue}>
                        {day.closeTime || "Not set"}
                      </Text>
                    )}
                  </>
                )}
                {day.isOpen && (
                  <View style={styles.switchContainer}>
                    <Text style={styles.label}>24 Hours for this day</Text>
                    {isEditing ? (
                      <Switch
                        value={day.is24Hours}
                        onValueChange={(v) =>
                          handleDayChange(index, "is24Hours", v)
                        }
                        trackColor={{ false: "#767577", true: colors.brandColor }}
                        disabled={isUpdating}
                      />
                    ) : (
                      <Text style={styles.displayValue}>
                        {day.is24Hours ? "Yes" : "No"}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Location ────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location Information</Text>
          <Text style={styles.label}>GPS Coordinates</Text>
          <Text style={styles.displayValue}>
            {parkingLotDetails.gpsLocation?.coordinates[1]?.toFixed(6)},{" "}
            {parkingLotDetails.gpsLocation?.coordinates[0]?.toFixed(6)}
          </Text>
        </View>

        {/* ── Bottom Actions ───────────────────────────────────────────────── */}
        {isEditing && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.cancelButton, isUpdating && styles.disabledButton]}
              onPress={handleCancelEdit}
              disabled={isUpdating}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  isUpdating && styles.disabledText,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.updateButton, isUpdating && styles.disabledButton]}
              onPress={handleUpdateParkingLot}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.updateButtonText}>Update Parking Lot</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Native DateTimePicker for working hours */}
        {showTimePicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
        )}
      </ScrollView>

      {/* ── Time Wheel Picker Modal for Daily Rate Slots ── */}
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
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  loadingText: {
    marginTop: responsiveHeight(2),
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(2),
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    marginTop: Platform.OS === "ios" ? responsiveHeight(6) : 0,
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(4),
  },
  editText: {
    color: colors.brandColor,
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
  },
  cancelText: {
    color: colors.error,
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(0.8),
    borderRadius: 6,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveText: { color: "#FFF", fontSize: responsiveFontSize(1.8), fontWeight: "600" },
  disabledText: { opacity: 0.5 },
  disabledButton: { opacity: 0.5 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(10),
  },
  errorText: {
    fontSize: responsiveFontSize(2),
    color: colors.error,
    textAlign: "center",
    marginTop: responsiveHeight(2),
    marginBottom: responsiveHeight(4),
  },
  retryButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(8),
    paddingVertical: responsiveHeight(1.5),
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(10),
  },
  noDataText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    textAlign: "center",
    marginBottom: responsiveHeight(4),
  },
  addButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(8),
    paddingVertical: responsiveHeight(1.5),
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: responsiveWidth(4),
    marginHorizontal: responsiveWidth(4),
    marginTop: responsiveHeight(2),
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorBannerText: {
    flex: 1,
    color: colors.error,
    fontSize: responsiveFontSize(1.6),
    marginHorizontal: responsiveWidth(2),
  },
  imageGalleryContainer: {
    position: "relative",
    marginBottom: responsiveHeight(2),
  },
  imageWrapper: { position: "relative" },
  galleryImage: {
    width: "100%",
    height: responsiveHeight(30),
    backgroundColor: "#E0E0E0",
  },
  deleteGalleryImageButton: {
    position: "absolute",
    top: responsiveHeight(1),
    right: responsiveWidth(4),
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: responsiveWidth(1.5),
  },
  mainImagePlaceholder: { width: "100%", height: responsiveHeight(30) },
  arrowButton: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -20 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 25,
    padding: responsiveWidth(2),
  },
  leftArrow: { left: responsiveWidth(3) },
  rightArrow: { right: responsiveWidth(3) },
  imageCounter: {
    position: "absolute",
    bottom: responsiveHeight(1),
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: { color: "#FFF", fontSize: responsiveFontSize(1.4) },
  addImagesButton: {
    position: "absolute",
    bottom: responsiveHeight(2),
    right: responsiveWidth(4),
    backgroundColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(1),
    borderRadius: 6,
  },
  addImagesText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.6),
    fontWeight: "600",
  },
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
  label: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
    marginBottom: responsiveHeight(0.5),
    fontWeight: "500",
  },
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
  displayValue: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(2),
    fontWeight: "500",
  },
  priceValue: {
    fontSize: responsiveFontSize(2),
    color: colors.brandColor,
    fontWeight: "bold",
    marginBottom: responsiveHeight(2),
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(2),
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
  aboutInput: { height: responsiveHeight(12), textAlignVertical: "top" },
  aboutText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    lineHeight: responsiveHeight(2.5),
  },
  zoneContainer: {
    marginBottom: responsiveHeight(3),
    paddingBottom: responsiveHeight(2),
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  zoneLabel: {
    fontSize: responsiveFontSize(1.9),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1.5),
  },
  spaceInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: responsiveWidth(2),
  },
  spaceInputGroup: { flex: 1 },
  spaceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    padding: responsiveWidth(3),
    borderRadius: 8,
  },
  spaceInfoItem: { flexDirection: "row", alignItems: "center" },
  spaceInfoLabel: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
    marginRight: responsiveWidth(2),
  },
  spaceInfoValue: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    fontWeight: "600",
  },
  editZonesButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(1.5),
    borderRadius: 8,
    alignItems: "center",
    marginTop: responsiveHeight(1),
  },
  editZonesText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
  },
  dayContainer: {
    marginBottom: responsiveHeight(2),
    paddingBottom: responsiveHeight(2),
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  dayLabel: {
    fontSize: responsiveFontSize(1.9),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1.5),
  },
  timeInputButton: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    marginBottom: responsiveHeight(2),
  },
  timeInputText: { fontSize: responsiveFontSize(1.8), color: colors.black },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(2),
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    gap: responsiveWidth(3),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingVertical: responsiveHeight(2),
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.gray,
    fontSize: responsiveFontSize(1.9),
    fontWeight: "600",
  },
  updateButton: {
    flex: 2,
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(2),
    borderRadius: 12,
    alignItems: "center",
  },
  updateButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.9),
    fontWeight: "bold",
  },

  // ── Plan shared ────────────────────────────────────────────────────────────
  planCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(0.5),
  },
  planIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFF3E5",
    justifyContent: "center",
    alignItems: "center",
  },
  statusPill: {
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: { fontSize: responsiveFontSize(1.5), fontWeight: "700" },
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
  ratePrefix: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "700",
    color: colors.gray,
    marginRight: 6,
  },
  rateInput: {
    flex: 1,
    fontSize: responsiveFontSize(2.2),
    fontWeight: "700",
    color: colors.black,
  },
  rateSuffix: { fontSize: responsiveFontSize(1.6), color: colors.gray },
  ratePreview: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: responsiveWidth(4),
    marginTop: responsiveHeight(0.5),
    gap: 8,
  },
  ratePreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratePreviewLabel: { fontSize: responsiveFontSize(1.6), color: colors.gray },
  ratePreviewValue: {
    fontSize: responsiveFontSize(1.6),
    fontWeight: "700",
    color: colors.black,
  },
  planViewRow: { marginTop: responsiveHeight(0.5) },
  planRateDisplay: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "900",
    color: colors.brandColor,
    marginTop: 2,
  },
  planRateSuffix: {
    fontSize: responsiveFontSize(1.4),
    fontWeight: "400",
    color: colors.gray,
  },

  // ── Daily rate ─────────────────────────────────────────────────────────────
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
  slotIndex: {
    fontSize: responsiveFontSize(1.7),
    fontWeight: "700",
    color: colors.black,
  },
  slotTimeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(1),
  },
  slotTimeGroup: { flex: 1 },
  slotTimeDivider: {
    paddingBottom: responsiveHeight(1.2),
    justifyContent: "flex-end",
  },
  slotTimeDividerText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    fontWeight: "700",
  },
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
  timePickerButtonText: {
    fontSize: responsiveFontSize(1.9),
    fontWeight: "700",
    color: colors.brandColor,
  },
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
    marginBottom: responsiveHeight(1.5),
  },
  addSlotText: {
    fontSize: responsiveFontSize(1.7),
    color: colors.brandColor,
    fontWeight: "600",
  },
  saveDailyRateButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    paddingVertical: responsiveHeight(1.5),
    alignItems: "center",
    marginTop: responsiveHeight(0.5),
  },
  saveDailyRateText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "700",
  },
  slotViewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: responsiveHeight(1.2),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  slotViewLeft: { flex: 1 },
  slotViewLabel: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
    color: colors.black,
  },
  slotViewTime: {
    fontSize: responsiveFontSize(1.5),
    color: colors.gray,
    marginTop: 2,
  },
  slotViewPrice: {
    fontSize: responsiveFontSize(2),
    fontWeight: "800",
    color: colors.brandColor,
  },
  noSlotsText: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    textAlign: "center",
    paddingVertical: responsiveHeight(1),
  },
});

export default ParkingDetails;