import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Trash2, X } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { SafeAreaView } from "react-native-safe-area-context";
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
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  is24Hours: boolean;
}

interface Garage {
  _id: string;
  garageName: string;
  about: string;
  address: string;
  contactNumber: string;
  email?: string;
  price: number;
  images: string[];
  spacesList: Record<string, SpaceInfo>;
  generalAvailable: WorkingHours[];
  is24x7: boolean;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  emergencyContact?: {
    person: string;
    number: string;
  };
  vehicleType: "bike" | "car" | "both";
}

const MerchantGarageDetails = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { garageId, garageData: garageDataParam } = params;

  const initialGarageData = garageDataParam
    ? JSON.parse(garageDataParam as string)
    : null;

  const { token } = useSelector((state: RootState) => state.auth);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialGarageData);
  const [refreshing, setRefreshing] = useState(false);
  const [garageDetails, setGarageDetails] = useState<Garage | null>(
    initialGarageData
  );
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Garage>>(
    initialGarageData || {}
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{
    day: string;
    field: "open" | "close";
  } | null>(null);
  const [localImages, setLocalImages] = useState<
    { uri: string; name: string; type: string }[]
  >(
    initialGarageData?.images?.map((uri: string) => ({
      uri,
      name: uri.split("/").pop() || "image.jpg",
      type: "image/jpeg",
    })) || []
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const fetchGarageDetails = useCallback(
    async (showLoader = true) => {
      if (!garageId) {
        setError("No garage ID provided");
        return;
      }

      try {
        if (showLoader) setIsLoading(true);
        setError(null);

        const response = await axiosInstance.get(
          `/merchants/garage/${garageId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data && response.data.data && response.data.data.garage) {
          const garageData = response.data.data.garage;
          setGarageDetails(garageData);
          setFormData(garageData);
          setLocalImages(
            garageData.images.map((uri: string) => ({
              uri,
              name: uri.split("/").pop() || "image.jpg",
              type: "image/jpeg",
            }))
          );
        } else {
          throw new Error("Invalid response structure or garage not found.");
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to load garage details";
        console.error("Error fetching garage:", err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [garageId, token]
  );

  // useFocusEffect(
  //   useCallback(() => {
  //     if (garageId && !initialGarageData) {
  //       fetchGarageDetails();
  //     }
  //     setIsEditing(false);
  //   }, [garageId, initialGarageData, fetchGarageDetails])
  // );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGarageDetails(false);
  }, [fetchGarageDetails]);

  const handleDeleteGarage = async () => {
    if (!garageId) {
      Alert.alert("Error", "Garage ID not found. Cannot delete.");
      return;
    }

    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this garage? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: async () => {
            setIsLoading(true);
            try {
              await axiosInstance.delete(
                `/merchants/garage/delete/${garageId}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              Alert.alert("Success", "Garage has been deleted successfully.");
              router.back();
            } catch (err: any) {
              const errorMessage =
                err.response?.data?.message ||
                err.message ||
                "An unexpected error occurred.";
              console.error("Deletion Error:", err.response?.data || err);
              Alert.alert("Deletion Failed", errorMessage);
            } finally {
              setIsLoading(false);
            }
          },
          style: "destructive",
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

  const handleInputChange = (field: keyof Garage, value: any) => {
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
    const numValue = parseInt(value) || 0;
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - localImages.length,
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
        setLocalImages((prev) => [...prev, ...newImages]);
      }
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
    }
  };

  const handleUpdateGarage = async () => {
    if (!garageId || !formData) return;

    try {
      setIsUpdating(true);
      setError(null);

      const data = new FormData();

      data.append("garageName", formData.garageName || "");
      data.append("about", formData.about || "");
      data.append("address", formData.address || "");
      data.append("contactNumber", formData.contactNumber || "");
      data.append("email", formData.email || "");
      data.append("is24x7", (formData.is24x7 || false).toString());
      data.append("price", (formData.price || 0).toString());
      data.append("vehicleType", formData.vehicleType || "both");

      data.append(
        "generalAvailable",
        JSON.stringify(formData.generalAvailable || [])
      );
      data.append("spacesList", JSON.stringify(formData.spacesList || {}));
      data.append(
        "location",
        JSON.stringify(
          formData.location || { type: "Point", coordinates: [0, 0] }
        )
      );

      if (
        formData.emergencyContact?.person &&
        formData.emergencyContact?.number
      ) {
        data.append(
          "emergencyContact",
          JSON.stringify(formData.emergencyContact)
        );
      }

      const existingCloudinaryUrls = localImages
        .filter((img) => img.uri.startsWith("http"))
        .map((img) => img.uri);
      const newLocalFiles = localImages.filter(
        (img) => !img.uri.startsWith("http")
      );

      newLocalFiles.forEach((image) => {
        data.append("images", {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as any);
      });

      data.append("existingImages", JSON.stringify(existingCloudinaryUrls));

      const response = await axiosInstance.put(
        `/merchants/garage/update/${garageId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data?.success) {
        Alert.alert("Success", "Garage updated successfully");
        setIsEditing(false);
        await fetchGarageDetails(false);
      } else {
        throw new Error(response.data?.message || "Update failed");
      }
    } catch (err: any) {
      console.error(
        "Error updating garage:",
        err.response?.data || err.message
      );
      let errorMessage = "Failed to update garage";
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
    setIsEditing(false);
    setFormData(garageDetails || {});
    setLocalImages(
      garageDetails?.images.map((uri) => ({
        uri,
        name: uri.split("/").pop() || "image.jpg",
        type: "image/jpeg",
      })) || []
    );
    setError(null);
  };

  if (isLoading && !garageDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
        <Text style={styles.loadingText}>Loading garage details...</Text>
      </View>
    );
  }

  if (error && !garageDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage Details</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={60} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchGarageDetails()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!garageDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage Details</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.noGarageContainer}>
          <Text style={styles.noGarageText}>
            No garage information available
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {garageDetails.garageName}
          </Text>
          <View style={styles.headerActions}>
            {isEditing ? (
              <>
                <TouchableOpacity onPress={handleCancelEdit}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpdateGarage}
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
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteGarage}>
                  <Trash2 size={24} color={colors.error} />
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
              source={images.defaultGarage}
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
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, styles.rightArrow]}
                onPress={handleNextImage}
              >
                <Text style={styles.arrowText}>›</Text>
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

        {/* Basic Info Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Garage Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.garageName || ""}
              onChangeText={(text) => handleInputChange("garageName", text)}
              placeholder="Enter garage name"
            />
          ) : (
            <Text style={styles.garageName}>{garageDetails.garageName}</Text>
          )}

          <Text style={styles.label}>Address</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address || ""}
              onChangeText={(text) => handleInputChange("address", text)}
              placeholder="Enter address"
              multiline
            />
          ) : (
            <Text style={styles.address}>{garageDetails.address}</Text>
          )}

          <Text style={styles.label}>Base Price per Hour</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.price?.toString() || ""}
              onChangeText={(text) =>
                handleInputChange("price", parseFloat(text) || 0)
              }
              keyboardType="numeric"
              placeholder="Enter base price"
            />
          ) : (
            <Text style={styles.price}>
              ${garageDetails.price?.toFixed(2) || "0.00"}/hr
            </Text>
          )}

          <Text style={styles.label}>Vehicle Type</Text>
          {isEditing ? (
            <View style={styles.vehicleTypeContainer}>
              {(["bike", "car", "both"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicleType === type &&
                      styles.vehicleTypeButtonActive,
                  ]}
                  onPress={() => handleInputChange("vehicleType", type)}
                >
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      formData.vehicleType === type &&
                        styles.vehicleTypeTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.vehicleTypeDisplay}>
              {garageDetails.vehicleType?.charAt(0).toUpperCase() +
                garageDetails.vehicleType?.slice(1) || "Both"}
            </Text>
          )}

          <View style={styles.switchContainer}>
            <Text style={styles.label}>24/7 Open</Text>
            {isEditing ? (
              <Switch
                value={formData.is24x7 || false}
                onValueChange={(value) => handleInputChange("is24x7", value)}
                trackColor={{ false: "#767577", true: colors.brandColor }}
                thumbColor={formData.is24x7 ? "#f5dd4b" : "#f4f3f4"}
              />
            ) : (
              <Text style={styles.switchText}>
                {garageDetails.is24x7 ? "Yes" : "No"}
              </Text>
            )}
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
              placeholder="Describe your garage"
            />
          ) : (
            <Text style={styles.aboutText}>
              {garageDetails.about || "No description provided"}
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
            />
          ) : (
            <Text style={styles.contactText}>
              {garageDetails.contactNumber}
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
            />
          ) : (
            <Text style={styles.contactText}>
              {garageDetails.email || "Not provided"}
            </Text>
          )}
        </View>

        {/* Parking Zones */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parking Zones</Text>

          {Object.entries(
            formData.spacesList || garageDetails.spacesList || {}
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
                    />
                  </View>

                  <View style={styles.spaceInputGroup}>
                    <Text style={styles.label}>Price per Hour</Text>
                    <TextInput
                      style={styles.input}
                      value={spaceInfo?.price?.toString() || "0"}
                      onChangeText={(text) =>
                        handleSpaceChange(zone, "price", text)
                      }
                      keyboardType="numeric"
                      placeholder="Price"
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
                      ${spaceInfo?.price?.toFixed(2) || "0.00"}/hr
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Working Hours */}
        {!formData.is24x7 && !garageDetails.is24x7 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Working Hours</Text>
            {(formData.generalAvailable || garageDetails.generalAvailable)?.map(
              (day, index) => (
                <View key={day.day} style={styles.dayContainer}>
                  <Text style={styles.dayLabel}>{day.day}</Text>

                  <View style={styles.switchContainer}>
                    <Text style={styles.label}>Open</Text>
                    {isEditing ? (
                      <Switch
                        value={day.isOpen}
                        onValueChange={(value) =>
                          handleDayChange(index, "isOpen", value)
                        }
                        trackColor={{
                          false: "#767577",
                          true: colors.brandColor,
                        }}
                        thumbColor={day.isOpen ? "#f5dd4b" : "#f4f3f4"}
                      />
                    ) : (
                      <Text style={styles.switchText}>
                        {day.isOpen ? "Yes" : "No"}
                      </Text>
                    )}
                  </View>

                  {day.isOpen && !day.is24Hours && (
                    <>
                      <Text style={styles.label}>Open Time</Text>
                      {isEditing ? (
                        <TouchableOpacity
                          style={styles.input}
                          onPress={() =>
                            setShowTimePicker({ day: day.day, field: "open" })
                          }
                        >
                          <Text>{day.openTime || "Select time"}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.timeText}>
                          {day.openTime || "Not set"}
                        </Text>
                      )}

                      <Text style={styles.label}>Close Time</Text>
                      {isEditing ? (
                        <TouchableOpacity
                          style={styles.input}
                          onPress={() =>
                            setShowTimePicker({ day: day.day, field: "close" })
                          }
                        >
                          <Text>{day.closeTime || "Select time"}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.timeText}>
                          {day.closeTime || "Not set"}
                        </Text>
                      )}
                    </>
                  )}

                  <View style={styles.switchContainer}>
                    <Text style={styles.label}>24 Hours</Text>
                    {isEditing ? (
                      <Switch
                        value={day.is24Hours}
                        onValueChange={(value) =>
                          handleDayChange(index, "is24Hours", value)
                        }
                        trackColor={{
                          false: "#767577",
                          true: colors.brandColor,
                        }}
                        thumbColor={day.is24Hours ? "#f5dd4b" : "#f4f3f4"}
                      />
                    ) : (
                      <Text style={styles.switchText}>
                        {day.is24Hours ? "Yes" : "No"}
                      </Text>
                    )}
                  </View>
                </View>
              )
            )}
          </View>
        )}

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location</Text>
          {garageDetails.location?.coordinates ? (
            <>
              <Text style={styles.label}>
                Latitude: {garageDetails.location.coordinates[1].toFixed(6)}
              </Text>
              <Text style={styles.label}>
                Longitude: {garageDetails.location.coordinates[0].toFixed(6)}
              </Text>
            </>
          ) : (
            <Text style={styles.label}>Location not available</Text>
          )}
        </View>

        {/* Submit Button */}
        {isEditing && (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleUpdateGarage}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Update Garage</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: responsiveWidth(5),
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "bold",
    color: colors.black,
    flex: 1,
    textAlign: "center",
    marginHorizontal: responsiveWidth(2),
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  editText: {
    color: colors.brandColor,
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
  },
  cancelText: {
    color: colors.error,
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
    marginRight: 10,
  },
  saveButton: {
    padding: 5,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: colors.success || "#4CAF50",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee",
    padding: 10,
    marginHorizontal: responsiveWidth(5),
    borderRadius: 5,
    marginTop: 5,
  },
  errorBannerText: {
    flex: 1,
    color: colors.error,
    fontSize: responsiveFontSize(1.6),
    marginLeft: 5,
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
    marginTop: responsiveHeight(2),
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: 50,
  },
  galleryImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  deleteGalleryImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 5,
  },
  mainImagePlaceholder: {
    width: "100%",
    height: "100%",
  },
  addImagesButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  addImagesText: {
    color: "white",
    fontSize: responsiveFontSize(1.6),
  },
  arrowButton: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
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
  arrowText: {
    color: "#FFF",
    fontSize: 30,
    fontWeight: "bold",
  },
  imageCounter: {
    position: "absolute",
    bottom: 10,
    left: "50%",
    transform: [{ translateX: -30 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  imageCounterText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.4),
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: responsiveWidth(4),
    margin: responsiveWidth(3),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  garageName: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginBottom: responsiveHeight(0.5),
    marginTop: responsiveHeight(0.5),
  },
  address: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
    lineHeight: responsiveHeight(2),
  },
  price: {
    fontSize: responsiveFontSize(2),
    color: colors.brandColor,
    fontWeight: "bold",
    marginBottom: responsiveHeight(1),
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: responsiveWidth(3),
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  textArea: {
    minHeight: responsiveHeight(8),
    textAlignVertical: "top",
  },
  sectionTitle: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1.5),
  },
  zoneContainer: {
    marginBottom: responsiveHeight(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    paddingBottom: responsiveHeight(1),
  },
  zoneLabel: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  spaceInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spaceInputGroup: {
    width: "48%",
  },
  spaceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1),
  },
  spaceInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  spaceInfoLabel: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginRight: responsiveWidth(2),
  },
  spaceInfoValue: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    fontWeight: "bold",
  },
  aboutInput: {
    minHeight: responsiveHeight(10),
    textAlignVertical: "top",
  },
  aboutText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    lineHeight: responsiveHeight(2.5),
  },
  contactText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  dayContainer: {
    marginBottom: responsiveHeight(2),
  },
  dayLabel: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1),
  },
  switchText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
  },
  timeText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  vehicleTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1),
  },
  vehicleTypeButton: {
    paddingVertical: responsiveHeight(0.5),
    paddingHorizontal: responsiveWidth(3),
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.brandColor,
  },
  vehicleTypeButtonActive: {
    backgroundColor: colors.brandColor,
  },
  vehicleTypeText: {
    fontSize: responsiveFontSize(1.6),
    color: colors.black,
  },
  vehicleTypeTextActive: {
    color: "#FFF",
  },
  vehicleTypeDisplay: {
    fontSize: responsiveFontSize(1.6),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  submitButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    padding: responsiveWidth(4),
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(5),
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: responsiveWidth(5),
  },
  errorText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.error,
    textAlign: "center",
    marginBottom: responsiveHeight(2),
  },
  retryButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 8,
    padding: responsiveWidth(4),
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
  },
  noGarageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: responsiveWidth(5),
  },
  noGarageText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    textAlign: "center",
    marginBottom: responsiveHeight(2),
  },
});

export default MerchantGarageDetails;
