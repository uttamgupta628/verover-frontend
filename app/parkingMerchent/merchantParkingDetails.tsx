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
  Plus,
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
  gpsLocation: {
    type: "Point";
    coordinates: [number, number];
  };
  isActive: boolean;
}

const ParkingDetails = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { token } = useSelector((state: RootState) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [parkingLotDetails, setParkingLotDetails] =
    useState<IParkingLot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IParkingLot>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{
    day: string;
    field: "open" | "close";
  } | null>(null);
  const [localImages, setLocalImages] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const parkingLotId = params.parkingLotId as string;
  const parkingLotDataString = params.parkingLotData as string | undefined;
  const parkingLotData = parkingLotDataString
    ? JSON.parse(parkingLotDataString)
    : undefined;

  // Prevent navigation loss when editing
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (isEditing) {
        e.preventDefault();
        Alert.alert(
          "Discard changes?",
          "You have unsaved changes. Are you sure you want to discard them and leave?",
          [
            { text: "Don't leave", style: "cancel", onPress: () => {} },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => navigation.dispatch(e.data.action),
            },
          ]
        );
      }
    });

    return unsubscribe;
  }, [navigation, isEditing]);

  const fetchParkingLotDetails = useCallback(
    async (showLoader = true) => {
      // Don't fetch if user is editing
      if (isEditing) {
        console.log("Skipping fetch - user is editing");
        return;
      }

      if (!parkingLotId) {
        setError("No parking lot ID provided.");
        return;
      }

      try {
        if (showLoader) setIsLoading(true);
        setError(null);

        const response = await axiosInstance.get(
          `/merchants/parkinglot/${parkingLotId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data && response.data.success && response.data.data) {
          const fetchedData = response.data.data;
          const formattedSpacesList = fetchedData.spacesList
            ? Object.fromEntries(
                Object.entries(fetchedData.spacesList).map(
                  ([key, value]: [string, any]) => [
                    key,
                    { count: value.count, price: value.price },
                  ]
                )
              )
            : {};

          const fullParkingLotData: IParkingLot = {
            ...fetchedData,
            spacesList: formattedSpacesList,
            generalAvailable: fetchedData.generalAvailable || [],
            images: fetchedData.images || [],
            gpsLocation: fetchedData.gpsLocation || {
              type: "Point",
              coordinates: [0, 0],
            },
            price: fetchedData.price || 0,
          };

          setParkingLotDetails(fullParkingLotData);
          // Only update formData if not editing
          if (!isEditing) {
            setFormData(fullParkingLotData);
          }
          setLocalImages(
            fullParkingLotData.images.map((uri) => ({
              uri,
              name: uri.split("/").pop() || "image.jpg",
              type: "image/jpeg",
            }))
          );
        } else {
          throw new Error(
            response.data?.message ||
              "Invalid response structure or parking lot not found."
          );
        }
      } catch (err: any) {
        console.error(
          "Error fetching parking lot details:",
          err.response?.data || err.message
        );
        setError(
          "Failed to load parking lot details: " +
            (err.response?.data?.message ||
              err.message ||
              "An unexpected error occurred.")
        );
      } finally {
        if (showLoader) setIsLoading(false);
        setRefreshing(false);
      }
    },
    [parkingLotId, token, isEditing]
  );

  const handleDeleteParkingLot = async () => {
    if (!parkingLotId) {
      Alert.alert("Error", "Parking Lot ID not found. Cannot delete.");
      return;
    }

    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this parking lot? This action cannot be undone.",
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
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              Alert.alert(
                "Success",
                "Parking Lot has been deleted successfully."
              );

              router.back();
            } catch (err: any) {
              console.error("Deletion Error:", err.response?.data || err);
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

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === localImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? localImages.length - 1 : prevIndex - 1
    );
  };

  const handleRefresh = useCallback(async () => {
    // Don't refresh if user is editing
    if (isEditing) {
      Alert.alert(
        "Cannot Refresh",
        "Please save or cancel your changes before refreshing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard Changes & Refresh",
            style: "destructive",
            onPress: async () => {
              setIsEditing(false);
              setRefreshing(true);
              await fetchParkingLotDetails(false);
              setRefreshing(false);
            },
          },
        ]
      );
      return;
    }

    setRefreshing(true);
    await fetchParkingLotDetails(false);
    setRefreshing(false);
  }, [fetchParkingLotDetails, isEditing]);

  useFocusEffect(
    useCallback(() => {
      // Don't reload if user is editing
      if (isEditing) {
        console.log("Skipping focus reload - user is editing");
        return;
      }

      if (parkingLotId) {
        fetchParkingLotDetails();
      } else if (parkingLotData) {
        const formattedSpacesList = parkingLotData.spacesList
          ? Object.fromEntries(
              Object.entries(parkingLotData.spacesList).map(
                ([key, value]: [string, any]) => [
                  key,
                  { count: value.count, price: value.price },
                ]
              )
            )
          : {};

        const fullParkingLotData: IParkingLot = {
          ...parkingLotData,
          spacesList: formattedSpacesList,
          generalAvailable: parkingLotData.generalAvailable || [],
          images: parkingLotData.images || [],
          gpsLocation: parkingLotData.gpsLocation || {
            type: "Point",
            coordinates: [0, 0],
          },
          price: parkingLotData.price || 0,
        };

        setParkingLotDetails(fullParkingLotData);
        // Only update formData if not editing
        if (!isEditing) {
          setFormData(fullParkingLotData);
        }
        setLocalImages(
          fullParkingLotData.images.map((uri) => ({
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

  const handleInputChange = (field: keyof IParkingLot, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDayChange = (index: number, field: string, value: any) => {
    const updatedDays = [...(formData.generalAvailable || [])];
    updatedDays[index] = {
      ...updatedDays[index],
      [field]: value,
    };
    handleInputChange("generalAvailable", updatedDays);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime && showTimePicker) {
      const timeString = `${selectedTime
        .getHours()
        .toString()
        .padStart(2, "0")}:${selectedTime
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      const dayIndex =
        formData.generalAvailable?.findIndex(
          (d) => d.day === showTimePicker.day
        ) || -1;

      if (dayIndex !== -1 && formData.generalAvailable) {
        const newGeneralAvailable = [...formData.generalAvailable];
        if (showTimePicker.field === "open") {
          newGeneralAvailable[dayIndex].openTime = timeString;
        } else {
          newGeneralAvailable[dayIndex].closeTime = timeString;
        }
        handleInputChange("generalAvailable", newGeneralAvailable);
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
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "You need to grant permission to access photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - localImages.length,
      });

      if (result.canceled || !result.assets) return;

      const newImages = result.assets.map((asset) => ({
        uri: asset.uri || "",
        name: asset.uri.split("/").pop() || `image_${Date.now()}.jpg`,
        type: "image/jpeg",
      }));
      setLocalImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to select images");
    }
  };

  const removeLocalImage = (index: number) => {
    const newImages = [...localImages];
    newImages.splice(index, 1);
    setLocalImages(newImages);

    if (currentImageIndex >= newImages.length && newImages.length > 0) {
      setCurrentImageIndex(newImages.length - 1);
    } else if (newImages.length === 0) {
      setCurrentImageIndex(0);
    }
  };

  const handleUpdateParkingLot = async () => {
    if (!parkingLotId || !formData) return;

    try {
      setIsUpdating(true);
      setError(null);

      const data = new FormData();

      // Add all fields to FormData
      data.append("parkingName", formData.parkingName || "");
      data.append("about", formData.about || "");
      data.append("address", formData.address || "");
      data.append("contactNumber", formData.contactNumber || "");
      if (formData.email) data.append("email", formData.email);
      data.append("is24x7", (formData.is24x7 || false).toString());
      data.append("price", (formData.price || 0).toString());
      data.append("isActive", (formData.isActive || false).toString());

      // Append JSON data
      data.append(
        "generalAvailable",
        JSON.stringify(formData.generalAvailable || [])
      );
      data.append("spacesList", JSON.stringify(formData.spacesList || {}));
      data.append(
        "gpsLocation",
        JSON.stringify(
          formData.gpsLocation || { type: "Point", coordinates: [0, 0] }
        )
      );

      // Handle images
      const newLocalFiles = localImages.filter(
        (img) => !img.uri.startsWith("http")
      );
      const existingImages = localImages
        .filter((img) => img.uri.startsWith("http"))
        .map((img) => img.uri);

      // Append existing image URLs as string array
      data.append("existingImages", JSON.stringify(existingImages));

      // Append new images
      newLocalFiles.forEach((image) => {
        data.append("images", {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as any);
      });

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
        Alert.alert("Success", "Parking Lot updated successfully");
        setIsEditing(false);
        await fetchParkingLotDetails(false);
      } else {
        throw new Error(response.data?.message || "Update failed");
      }
    } catch (err: any) {
      console.error(
        "Error updating parking lot:",
        err.response?.data || err.message
      );
      let errorMessage = "Failed to update parking lot";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (
        err.response?.data?.errors &&
        err.response.data.errors.length > 0
      ) {
        errorMessage =
          "Validation Errors:\n" +
          err.response.data.errors.map((e: any) => e.message).join("\n");
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    if (parkingLotDetails) {
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
    }
  };

  const handleStartEditing = () => {
    // Make sure formData is populated with current details before editing
    if (parkingLotDetails && !formData.parkingName) {
      setFormData({ ...parkingLotDetails });
    }
    setIsEditing(true);
  };

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

  return (
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isEditing) {
              Alert.alert(
                "Discard changes?",
                "You have unsaved changes. Are you sure you want to leave?",
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
                  style={[styles.cancelText, isUpdating && styles.disabledText]}
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

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={20} color={colors.error} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <X size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Image & Image Gallery with Carousel */}
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

        {/* Carousel Arrow Buttons */}
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

      {/* Basic Info Card */}
      <View style={styles.card}>
        <View style={styles.infoContent}>
          <Text style={styles.label}>Parking Lot Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.parkingName || ""}
              onChangeText={(text) => handleInputChange("parkingName", text)}
              placeholder="Enter parking lot name"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.displayValue}>
              {parkingLotDetails.parkingName}
            </Text>
          )}

          <Text style={styles.label}>Address</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.address || ""}
              onChangeText={(text) => handleInputChange("address", text)}
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
              onChangeText={(text) =>
                handleInputChange("price", parseFloat(text) || 0)
              }
              keyboardType="numeric"
              placeholder="Enter price"
              editable={!isUpdating}
            />
          ) : (
            <Text style={styles.priceValue}>
              ${parkingLotDetails.price?.toFixed(2) || "0.00"}/hr
            </Text>
          )}

          <View style={styles.switchContainer}>
            <Text style={styles.label}>24/7 Open</Text>
            {isEditing ? (
              <Switch
                value={formData.is24x7 || false}
                onValueChange={(value) => handleInputChange("is24x7", value)}
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
                onValueChange={(value) => handleInputChange("isActive", value)}
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
      </View>

      {/* About Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>About</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.aboutInput]}
            value={formData.about || ""}
            onChangeText={(text) => handleInputChange("about", text)}
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

      {/* Contact Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact Information</Text>

        <Text style={styles.label}>Contact Number</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.contactNumber || ""}
            onChangeText={(text) => handleInputChange("contactNumber", text)}
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
            onChangeText={(text) => handleInputChange("email", text)}
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

      {/* Parking Zones */}
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
                    onChangeText={(text) =>
                      handleSpaceChange(zone, "count", text)
                    }
                    keyboardType="numeric"
                    placeholder="Number of slots"
                    editable={!isUpdating}
                  />
                </View>

                <View style={styles.spaceInputGroup}>
                  <Text style={styles.label}>Price for Zone ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={spaceInfo?.price?.toString() || "0"}
                    onChangeText={(text) =>
                      handleSpaceChange(zone, "price", text)
                    }
                    keyboardType="decimal-pad"
                    placeholder="Price for zone"
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
                    ${spaceInfo?.price?.toFixed(2) || "0.00"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}

        {isEditing && (
          <TouchableOpacity
            style={[
              styles.editZonesButton,
              isUpdating && styles.disabledButton,
            ]}
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

      {/* Working Hours */}
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
                    onValueChange={(value) =>
                      handleDayChange(index, "isOpen", value)
                    }
                    trackColor={{ false: "#767577", true: colors.brandColor }}
                    disabled={isUpdating}
                  />
                ) : (
                  <Text style={styles.displayValue}>
                    {day.isOpen || false ? "Yes" : "No"}
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
                      onValueChange={(value) =>
                        handleDayChange(index, "is24Hours", value)
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

      {/* Location Information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Information</Text>
        <Text style={styles.label}>GPS Coordinates</Text>
        <Text style={styles.displayValue}>
          {parkingLotDetails.gpsLocation?.coordinates[1]?.toFixed(6)},{" "}
          {parkingLotDetails.gpsLocation?.coordinates[0]?.toFixed(6)}
        </Text>
      </View>

      {/* Bottom Actions (Only show in edit mode) */}
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

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
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
    marginTop:
      Platform.OS === "ios" ? responsiveHeight(6) : responsiveHeight(0),
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
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
  },
  disabledText: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
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
    marginLeft: responsiveWidth(2),
    marginRight: responsiveWidth(2),
  },
  imageGalleryContainer: {
    position: "relative",
    marginBottom: responsiveHeight(2),
  },
  imageWrapper: {
    position: "relative",
  },
  galleryImage: {
    width: "100%",
    height: responsiveHeight(30),
    backgroundColor: "#E0E0E0",
  },
  deleteGalleryImageButton: {
    position: "absolute",
    top: responsiveHeight(1),
    right: responsiveWidth(4),
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: responsiveWidth(1.5),
  },
  mainImagePlaceholder: {
    width: "100%",
    height: responsiveHeight(30),
  },
  arrowButton: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -20 }],
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
    padding: responsiveWidth(2),
  },
  leftArrow: {
    left: responsiveWidth(3),
  },
  rightArrow: {
    right: responsiveWidth(3),
  },
  addImagesButton: {
    position: "absolute",
    bottom: responsiveHeight(2),
    right: responsiveWidth(4),
    backgroundColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(1),
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
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
  infoContent: {
    paddingVertical: responsiveHeight(0.5),
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
  aboutInput: {
    height: responsiveHeight(12),
    textAlignVertical: "top",
  },
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
  spaceInputGroup: {
    flex: 1,
  },
  spaceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    padding: responsiveWidth(3),
    borderRadius: 8,
  },
  spaceInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
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
  timeInputText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
  },
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
});

export default ParkingDetails;
