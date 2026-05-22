import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { RootState } from "../../components/redux/store";
import colors from "../../assets/color";
import { Image } from "expo-image";
import { Picker } from "@react-native-picker/picker";

const { width, height } = Dimensions.get("window");
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFontSize = (size: number) => {
  const scale = Math.min(width / 375, height / 812);
  return size * scale;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
}

interface HoursOfOperation {
  day: string;
  open: string;
  close: string;
}

// ✅ Now matches MyDryCleaners: array of { name, price }
interface AdditionalService {
  name: "zipper" | "button" | "wash/fold";
  price: number;
}

interface ServiceForm {
  name: string;
  category:
    | "Shirts"
    | "Pants"
    | "Suits"
    | "Dresses"
    | "Coats"
    | "Blankets"
    | "Comforters"
    | "Curtains"
    | "Other";
  starchLevel: "low" | "medium" | "high";
  washOnly: boolean;
  additionalservice: AdditionalService[]; // ✅ Array — same as MyDryCleaners
  price: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_CATEGORIES = [
  "Shirts",
  "Pants",
  "Suits",
  "Dresses",
  "Coats",
  "Blankets",
  "Comforters",
  "Curtains",
  "Other",
] as const;

// ✅ Same options as MyDryCleaners
const ADDITIONAL_OPTIONS = ["zipper", "button", "wash/fold"] as const;

interface SelectedImage {
  uri: string;
  type: string;
  fileName?: string;
}

interface Images {
  contactPersonImg: SelectedImage | null;
  shopImages: SelectedImage[];
}

// ─── AdditionalServicePicker ──────────────────────────────────────────────────
// Replicates the exact chip + per-option price UI from MyDryCleaners > ServiceForm

const AdditionalServicePicker: React.FC<{
  value: AdditionalService[];
  onChange: (updated: AdditionalService[]) => void;
}> = ({ value, onChange }) => {
  const isSelected = (opt: string) => value.some((s) => s.name === opt);

  const toggle = (opt: (typeof ADDITIONAL_OPTIONS)[number]) => {
    if (isSelected(opt)) {
      onChange(value.filter((s) => s.name !== opt));
    } else {
      onChange([...value, { name: opt, price: 0 }]);
    }
  };

  const updatePrice = (opt: string, priceStr: string) => {
    onChange(
      value.map((s) =>
        s.name === opt ? { ...s, price: parseFloat(priceStr) || 0 } : s,
      ),
    );
  };

  return (
    <View>
      {/* Multi-select chips */}
      <View style={styles.chipRow}>
        {ADDITIONAL_OPTIONS.map((opt) => {
          const selected = isSelected(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => toggle(opt)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextActive]}
              >
                {selected ? `✓ ${opt}` : opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Price input for each selected option */}
      {value.map((additional) => (
        <View key={additional.name} style={styles.additionalPriceRow}>
          <View style={styles.additionalPriceLabel}>
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={14}
              color={colors.brandColor}
            />
            <Text style={styles.additionalPriceLabelText}>
              Charge for "{additional.name}" ($)
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={additional.price === 0 ? "" : String(additional.price)}
            onChangeText={(t) => updatePrice(additional.name, t)}
            keyboardType="decimal-pad"
            placeholder="e.g. 1.50"
            placeholderTextColor={colors.gray}
          />
        </View>
      ))}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const DryClean: React.FC = () => {
  const router = useRouter();
  const authToken = useSelector((state: RootState) => state.auth.token);

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [formData, setFormData] = useState({
    shopname: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      latitude: 0,
      longitude: 0,
      formattedAddress: "",
    } as Address,
    about: "",
    contactPerson: "",
    phoneNumber: "",
    hoursOfOperation: [
      { day: "Monday", open: "09:00", close: "19:00" },
      { day: "Tuesday", open: "09:00", close: "19:00" },
      { day: "Wednesday", open: "09:00", close: "19:00" },
      { day: "Thursday", open: "09:00", close: "19:00" },
      { day: "Friday", open: "09:00", close: "19:00" },
      { day: "Saturday", open: "09:00", close: "17:00" },
      { day: "Sunday", open: "10:00", close: "16:00" },
    ],
    // ✅ Default service now uses additionalservice: [] (array)
    services: [
      {
        name: "Shirt Cleaning",
        category: "Shirts" as const,
        starchLevel: "medium" as const,
        washOnly: false,
        additionalservice: [] as AdditionalService[],
        price: 50,
      },
    ] as ServiceForm[],
  });

  const [images, setImages] = useState<Images>({
    contactPersonImg: null,
    shopImages: [],
  });

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location permissions in settings to use this feature.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Location.getForegroundPermissionsAsync(),
            },
          ],
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      setCurrentLocation({ latitude, longitude });
      setSelectedLocation({ latitude, longitude });
      const address = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (address.length > 0)
        updateAddressFromGeocode(address[0], latitude, longitude);
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert(
        "Error",
        "Failed to get your current location. Please try again or enter address manually.",
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const updateAddressFromGeocode = (
    geocode: Location.LocationGeocodedAddress,
    lat: number,
    lng: number,
  ) => {
    const street =
      [geocode.name, geocode.street].filter(Boolean).join(", ") || "";
    const city = geocode.city || geocode.subregion || "";
    const state = geocode.region || "";
    const zipCode = geocode.postalCode || "";
    const country = geocode.country || "";
    const formattedAddress = [street, city, state, zipCode, country]
      .filter(Boolean)
      .join(", ");
    setFormData((prev) => ({
      ...prev,
      address: {
        street,
        city,
        state,
        zipCode,
        country,
        latitude: lat,
        longitude: lng,
        formattedAddress,
      },
    }));
  };

  const searchAddress = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const GOOGLE_API_KEY = "YOUR_GOOGLE_PLACES_API_KEY";
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
          searchQuery,
        )}&inputtype=textquery&fields=formatted_address,name,geometry&key=${GOOGLE_API_KEY}`,
      );
      const data = await response.json();
      if (data.status === "OK" && data.candidates.length > 0) {
        const place = data.candidates[0];
        const { lat, lng } = place.geometry.location;
        setSelectedLocation({ latitude: lat, longitude: lng });
        const geocodeResponse = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (geocodeResponse.length > 0)
          updateAddressFromGeocode(geocodeResponse[0], lat, lng);
      } else {
        Alert.alert(
          "Location Not Found",
          "Please try a different search term or select location on the map.",
        );
      }
    } catch (error) {
      console.error("Error searching address:", error);
      Alert.alert("Error", "Failed to search location. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    reverseGeocodeLocation(coordinate.latitude, coordinate.longitude);
  };

  const reverseGeocodeLocation = async (lat: number, lng: number) => {
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      if (address.length > 0) updateAddressFromGeocode(address[0], lat, lng);
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  };

  const confirmLocation = () => {
    if (selectedLocation) setMapModalVisible(false);
    else
      Alert.alert(
        "No Location Selected",
        "Please select a location on the map.",
      );
  };

  const handleInputChange = (field: string, value: string): void => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as any),
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleHoursChange = (
    index: number,
    field: keyof HoursOfOperation,
    value: string,
  ): void => {
    setFormData((prev) => ({
      ...prev,
      hoursOfOperation: prev.hoursOfOperation.map((hour, i) =>
        i === index ? { ...hour, [field]: value } : hour,
      ),
    }));
  };

  // ✅ Updated: handles both scalar fields AND the additionalservice array
  const handleServiceChange = (
    index: number,
    field: keyof ServiceForm,
    value: string | number | boolean | AdditionalService[],
  ): void => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((service, i) =>
        i === index ? { ...service, [field]: value } : service,
      ),
    }));
  };

  const addService = (): void => {
    setFormData((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          name: "",
          category: "Shirts" as const,
          starchLevel: "medium" as const,
          washOnly: false,
          additionalservice: [] as AdditionalService[], // ✅ Start empty
          price: 0,
        },
      ],
    }));
  };

  const removeService = (index: number): void => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  };

  const handleContactImagePick = async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const ext = asset.uri.split(".").pop() || "jpg";
        setImages((prev) => ({
          ...prev,
          contactPersonImg: {
            uri: asset.uri,
            type: `image/${ext}`,
            fileName: asset.fileName || `contact_${Date.now()}.${ext}`,
          },
        }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  const handleShopImagesPick = async (): Promise<void> => {
    try {
      const remaining = 4 - images.shopImages.length;
      if (remaining <= 0) {
        Alert.alert("Limit Reached", "You can only add up to 4 shop images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const picked = result.assets.map((asset) => {
          const ext = asset.uri.split(".").pop() || "jpg";
          return {
            uri: asset.uri,
            type: `image/${ext}`,
            fileName: asset.fileName || `shop_${Date.now()}.${ext}`,
          };
        });
        setImages((prev) => ({
          ...prev,
          shopImages: [...prev.shopImages, ...picked].slice(0, 4),
        }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select images. Please try again.");
    }
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      setLoading(true);

      if (
        !formData.shopname ||
        !formData.contactPerson ||
        !formData.phoneNumber
      ) {
        Alert.alert("Error", "Please fill in all required fields");
        setLoading(false);
        return;
      }
      if (!formData.address.latitude || !formData.address.longitude) {
        Alert.alert("Error", "Please select your shop location using the map");
        setLoading(false);
        return;
      }
      if (!formData.address.street || !formData.address.city) {
        Alert.alert(
          "Incomplete Address",
          "Please ensure all address fields are filled.",
        );
        setLoading(false);
        return;
      }

      const hasValidService = formData.services.some(
        (service) => service.name && service.category && service.price > 0,
      );
      if (!hasValidService) {
        Alert.alert(
          "Invalid Services",
          "Please add at least one service with name, category, and price.",
        );
        setLoading(false);
        return;
      }

      // ✅ Build services payload: include additionalservice array (omit if empty)
      const servicesPayload = formData.services.map((s) => ({
        name: s.name,
        category: s.category,
        starchLevel: s.starchLevel || "medium",
        washOnly: s.washOnly,
        // Matches MyDryCleaners: send array when non-empty, omit when empty
        ...(s.additionalservice.length > 0
          ? { additionalservice: s.additionalservice }
          : {}),
        price: s.price,
      }));

      const submitData = new FormData();
      submitData.append("shopname", formData.shopname);
      submitData.append("contactPerson", formData.contactPerson);
      submitData.append("phoneNumber", formData.phoneNumber);
      submitData.append("about", formData.about || "");
      submitData.append("address", JSON.stringify(formData.address));
      submitData.append(
        "hoursOfOperation",
        JSON.stringify(formData.hoursOfOperation),
      );
      submitData.append("services", JSON.stringify(servicesPayload));

      if (images.contactPersonImg) {
        const { uri, type, fileName } = images.contactPersonImg;
        submitData.append("contactPersonImg", {
          uri,
          type: type || "image/jpeg",
          name: fileName || `contact_${Date.now()}.jpg`,
        } as any);
      }
      if (images.shopImages.length > 0) {
        images.shopImages.forEach((image, index) => {
          const { uri, type, fileName } = image;
          submitData.append("shopimage", {
            uri,
            type: type || "image/jpeg",
            name: fileName || `shop_${Date.now()}_${index}.jpg`,
          } as any);
        });
      }

      const response = await fetch(
        "https://vervoer-backend2.onrender.com/api/users/dry-cleaner",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: submitData,
        },
      );

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned invalid response: ${responseText.substring(0, 100)}`,
        );
      }

      if (response.ok) {
        Alert.alert("Success", "Dry Cleaner registered successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        let errorMessage =
          result.message || result.error || "Registration failed";
        if (result.errors && Array.isArray(result.errors))
          errorMessage = result.errors.map((e: any) => e.message).join("\n");
        Alert.alert("Registration Failed", errorMessage);
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message ||
          "Something went wrong. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={30} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Dry Cleaner</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Shop Basic Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shop Information</Text>

          <Text style={styles.label}>Shop Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.shopname}
            onChangeText={(value) => handleInputChange("shopname", value)}
            placeholder="Enter shop name"
            placeholderTextColor={colors.gray}
          />

          <Text style={styles.label}>Contact Person *</Text>
          <TextInput
            style={styles.input}
            value={formData.contactPerson}
            onChangeText={(value) => handleInputChange("contactPerson", value)}
            placeholder="Enter contact person name"
            placeholderTextColor={colors.gray}
          />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.phoneNumber}
            onChangeText={(value) => handleInputChange("phoneNumber", value)}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            placeholderTextColor={colors.gray}
          />

          <Text style={styles.label}>About</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.about}
            onChangeText={(value) => handleInputChange("about", value)}
            placeholder="Describe your dry cleaning service"
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.gray}
          />
        </View>

        {/* Address with Map Integration */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shop Location *</Text>

          <View style={styles.locationButtons}>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="locate" size={20} color="#FFF" />
                  <Text style={styles.locationButtonText}>
                    Use Current Location
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => setMapModalVisible(true)}
            >
              <MaterialIcons name="map" size={20} color="#FFF" />
              <Text style={styles.mapButtonText}>Select on Map</Text>
            </TouchableOpacity>
          </View>

          {formData.address.formattedAddress ? (
            <View style={styles.selectedLocation}>
              <View style={styles.locationInfo}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.locationText}>
                  {formData.address.formattedAddress}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMapModalVisible(true)}>
                <Text style={styles.changeLocationText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.locationPrompt}>
              Please select your shop location using the options above
            </Text>
          )}

          <Text style={styles.label}>Street Address</Text>
          <TextInput
            style={styles.input}
            value={formData.address.street}
            onChangeText={(value) => handleInputChange("address.street", value)}
            placeholder="Street address will be filled from map selection"
            placeholderTextColor={colors.gray}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.address.city}
                onChangeText={(value) =>
                  handleInputChange("address.city", value)
                }
                placeholder="City"
                placeholderTextColor={colors.gray}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={formData.address.state}
                onChangeText={(value) =>
                  handleInputChange("address.state", value)
                }
                placeholder="State"
                placeholderTextColor={colors.gray}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Zip Code</Text>
              <TextInput
                style={styles.input}
                value={formData.address.zipCode}
                onChangeText={(value) =>
                  handleInputChange("address.zipCode", value)
                }
                placeholder="Zip Code"
                placeholderTextColor={colors.gray}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Country</Text>
              <TextInput
                style={styles.input}
                value={formData.address.country}
                onChangeText={(value) =>
                  handleInputChange("address.country", value)
                }
                placeholder="Country"
                placeholderTextColor={colors.gray}
              />
            </View>
          </View>

          {formData.address.latitude !== 0 &&
            formData.address.longitude !== 0 && (
              <View style={styles.coordinates}>
                <Text style={styles.coordinateText}>
                  Latitude: {formData.address.latitude!.toFixed(6)}
                </Text>
                <Text style={styles.coordinateText}>
                  Longitude: {formData.address.longitude!.toFixed(6)}
                </Text>
              </View>
            )}
        </View>

        {/* Images */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Images</Text>

          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleContactImagePick}
          >
            <MaterialCommunityIcons name="camera" size={24} color="#FFF" />
            <Text style={styles.buttonText}>
              {images.contactPersonImg
                ? "Contact Image Selected"
                : "Select Contact Person Image"}
            </Text>
          </TouchableOpacity>

          {images.contactPersonImg && (
            <Image
              source={{ uri: images.contactPersonImg.uri }}
              style={styles.previewImage}
              contentFit="cover"
            />
          )}

          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleShopImagesPick}
          >
            <MaterialCommunityIcons
              name="image-multiple"
              size={24}
              color="#FFF"
            />
            <Text style={styles.buttonText}>
              {images.shopImages.length > 0
                ? `${images.shopImages.length} Shop Image${images.shopImages.length > 1 ? "s" : ""} Selected`
                : "Select Shop Images (Max 4)"}
            </Text>
          </TouchableOpacity>

          <View style={styles.imagePreviewContainer}>
            {images.shopImages.map((image, index) => (
              <Image
                key={index}
                source={{ uri: image.uri }}
                style={styles.shopPreviewImage}
                contentFit="cover"
              />
            ))}
          </View>
        </View>

        {/* Hours of Operation */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hours of Operation</Text>
          {formData.hoursOfOperation.map((hour, index) => (
            <View key={index} style={styles.hourRow}>
              <Text style={styles.dayText}>{hour.day}</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={styles.timeInput}
                  value={hour.open}
                  onChangeText={(value) =>
                    handleHoursChange(index, "open", value)
                  }
                  placeholder="Open"
                  placeholderTextColor={colors.gray}
                />
                <Text style={styles.toText}>to</Text>
                <TextInput
                  style={styles.timeInput}
                  value={hour.close}
                  onChangeText={(value) =>
                    handleHoursChange(index, "close", value)
                  }
                  placeholder="Close"
                  placeholderTextColor={colors.gray}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Services */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services</Text>
            <TouchableOpacity onPress={addService} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonText}>Add Service</Text>
            </TouchableOpacity>
          </View>

          {formData.services.map((service, index) => (
            <View key={index} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceTitle}>Service {index + 1}</Text>
                {formData.services.length > 1 && (
                  <TouchableOpacity onPress={() => removeService(index)}>
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color="#FF6B6B"
                    />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Service Name</Text>
              <TextInput
                style={styles.input}
                value={service.name}
                onChangeText={(value) =>
                  handleServiceChange(index, "name", value)
                }
                placeholder="e.g., Shirt Cleaning"
                placeholderTextColor={colors.gray}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={service.category}
                  onValueChange={(value) =>
                    handleServiceChange(index, "category", value)
                  }
                  style={styles.picker}
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Picker.Item key={cat} label={cat} value={cat} />
                  ))}
                </Picker>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    value={service.price?.toString()}
                    onChangeText={(value) =>
                      handleServiceChange(index, "price", parseInt(value) || 0)
                    }
                    placeholder="Price"
                    keyboardType="numeric"
                    placeholderTextColor={colors.gray}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Starch Level</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={service.starchLevel}
                      onValueChange={(value) =>
                        handleServiceChange(index, "starchLevel", value)
                      }
                      style={styles.picker}
                    >
                      <Picker.Item label="Low" value="low" />
                      <Picker.Item label="Medium" value="medium" />
                      <Picker.Item label="High" value="high" />
                    </Picker>
                  </View>
                </View>
              </View>

              {/* ✅ Multi-select Additional Services — matches MyDryCleaners exactly */}
              <Text style={styles.label}>
                Additional Services (select all that apply)
              </Text>
              <AdditionalServicePicker
                value={service.additionalservice}
                onChange={(updated) =>
                  handleServiceChange(index, "additionalservice", updated)
                }
              />
            </View>
          ))}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading || !formData.address.latitude}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={24} color="#FFF" />
              <Text style={styles.submitButtonText}>
                {formData.address.latitude
                  ? "Register Dry Cleaner"
                  : "Select Location First"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Map Selection Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMapModalVisible(false)}>
              <Ionicons name="arrow-back" size={30} color={colors.brandColor} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Shop Location</Text>
            <TouchableOpacity
              onPress={confirmLocation}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.gray}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for address..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchAddress}
                placeholderTextColor={colors.gray}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color={colors.gray} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchAddress}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {currentLocation && (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {selectedLocation && (
                <Marker
                  coordinate={selectedLocation}
                  title="Selected Location"
                  description="Your shop location"
                  pinColor={colors.brandColor}
                />
              )}
            </MapView>
          )}

          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={getCurrentLocation}
              disabled={locationLoading}
            >
              <Ionicons
                name="locate"
                size={24}
                color={locationLoading ? colors.gray : colors.brandColor}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: 10, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(6),
    paddingBottom: responsiveHeight(2),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    zIndex: 10,
    marginTop: -40,
  },
  headerTitle: {
    fontSize: responsiveFontSize(18),
    color: colors.black,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#FFF",
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(1),
    padding: responsiveWidth(4),
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1.5),
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(1.5),
  },
  label: {
    fontSize: responsiveFontSize(14),
    color: colors.black,
    marginBottom: responsiveHeight(0.5),
    marginTop: responsiveHeight(1),
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: responsiveHeight(1.2),
    paddingHorizontal: responsiveWidth(3),
    fontSize: responsiveFontSize(14),
    color: colors.black,
  },
  textArea: { height: responsiveHeight(10), textAlignVertical: "top" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  halfInput: { width: "48%" },
  locationButtons: { flexDirection: "row", gap: 10, marginBottom: 15 },
  locationButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: responsiveHeight(1.2),
    borderRadius: 8,
    gap: 8,
  },
  locationButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
  },
  mapButton: {
    flex: 1,
    backgroundColor: colors.brandColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: responsiveHeight(1.2),
    borderRadius: 8,
    gap: 8,
  },
  mapButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
  },
  selectedLocation: {
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  locationText: {
    fontSize: responsiveFontSize(13),
    color: colors.black,
    flex: 1,
  },
  changeLocationText: {
    color: colors.brandColor,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
  },
  locationPrompt: {
    fontSize: responsiveFontSize(13),
    color: colors.gray,
    fontStyle: "italic",
    marginBottom: 15,
    textAlign: "center",
  },
  coordinates: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  coordinateText: { fontSize: responsiveFontSize(12), color: colors.gray },
  imageButton: {
    backgroundColor: colors.brandColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: responsiveHeight(1.5),
    borderRadius: 8,
    marginVertical: responsiveHeight(1),
    gap: 8,
  },
  buttonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
  },
  previewImage: {
    width: responsiveWidth(30),
    height: responsiveWidth(30),
    borderRadius: 10,
    marginTop: responsiveHeight(1),
    alignSelf: "center",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: responsiveHeight(1),
    justifyContent: "center",
    gap: 8,
  },
  shopPreviewImage: {
    width: responsiveWidth(20),
    height: responsiveWidth(20),
    borderRadius: 8,
  },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1),
    paddingVertical: responsiveHeight(0.5),
  },
  dayText: {
    fontSize: responsiveFontSize(14),
    color: colors.black,
    width: responsiveWidth(25),
    fontWeight: "500",
  },
  timeInputs: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  timeInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: responsiveHeight(0.8),
    paddingHorizontal: responsiveWidth(2),
    fontSize: responsiveFontSize(12),
    color: colors.black,
    width: responsiveWidth(24),
    textAlign: "center",
  },
  toText: {
    marginHorizontal: responsiveWidth(2),
    color: colors.gray,
    fontSize: responsiveFontSize(13),
  },
  addButton: {
    backgroundColor: colors.brandColor,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(0.8),
    borderRadius: 6,
    gap: 4,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
  },
  serviceCard: {
    backgroundColor: "#F8F9FA",
    padding: responsiveWidth(3),
    borderRadius: 8,
    marginBottom: responsiveHeight(2),
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(1),
  },
  serviceTitle: {
    fontSize: responsiveFontSize(15),
    fontWeight: "bold",
    color: colors.black,
  },
  pickerContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    overflow: "hidden",
  },
  picker: { height: 50, width: "100%" },

  // ✅ Chip styles — matches MyDryCleaners
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    backgroundColor: "#FFFFFF",
  },
  chipActive: {
    borderColor: colors.brandColor,
    backgroundColor: "#FFF3E6",
  },
  chipText: {
    fontSize: responsiveFontSize(13),
    color: colors.gray,
    fontWeight: "500",
  },
  chipTextActive: { color: colors.brandColor, fontWeight: "700" },

  // ✅ Per-option price row — matches MyDryCleaners
  additionalPriceRow: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#FFF3E6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFE5C8",
  },
  additionalPriceLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  additionalPriceLabelText: {
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: colors.black,
  },

  submitButton: {
    backgroundColor: colors.brandColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(1.8),
    borderRadius: 12,
    marginBottom: responsiveHeight(4),
    marginTop: responsiveHeight(1),
    gap: 8,
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(16),
    fontWeight: "bold",
  },
  disabledButton: { opacity: 0.6 },
  modalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: colors.black },
  confirmButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  searchContainer: {
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.black,
  },
  searchButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  searchButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  map: { flex: 1, width: "100%" },
  mapControls: { position: "absolute", bottom: 30, right: 20 },
  mapControlButton: {
    width: 50,
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default DryClean;
