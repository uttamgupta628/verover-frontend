import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardTypeOptions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from "react-native-responsive-dimensions";
import colors from "../assets/color";
import { images } from "../assets/images/images";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../components/redux/store";
import {
  setProfileImage as setGlobalProfileImage,
  setProfileName,
} from "../components/redux/profileSlice";
// import AppButton from '../AppButton';

type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  isGray?: boolean;
};

const Input = ({
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType = "default",
  isGray = false,
}: InputProps) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, isGray && styles.inputGray]}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      keyboardType={keyboardType}
      placeholder={`Enter ${label}`}
      placeholderTextColor="#999"
    />
  </View>
);

const MyProfile = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const baseUrl = "https://vervoer-backend2.onrender.com/api";

  const { token, user: currentUser } = useSelector(
    (state: RootState) => state.auth
  );

  const [localProfileImage, setLocalProfileImage] = useState<string | null>(
    null
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        console.warn("No token available");
        return;
      }

      try {
        setIsLoading(true);
        console.log("Fetching profile from:", `${baseUrl}/users/get-profile`);

        const response = await fetch(`${baseUrl}/users/get-profile`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        console.log("Profile response:", data);

        if (response.ok) {
          const user = data?.data || data;
          setFirstName(user?.firstName || "");
          setLastName(user?.lastName || "");
          setEmail(user?.email || "");
          setMobile(user?.phoneNumber || user?.phone || "");
          setCountry(user?.country || "");
          setState(user?.state || "");
          setZipCode(user?.zipCode || "");
          setLocalProfileImage(user?.profileImage || null);

          // Sync to Redux
          dispatch(setGlobalProfileImage(user?.profileImage || null));
          dispatch(
            setProfileName({
              firstName: user?.firstName || "",
              lastName: user?.lastName || "",
            })
          );

          console.log("✅ Profile loaded successfully");
        } else {
          console.error("Failed to load profile:", data?.message);
          Alert.alert("Failed", data?.message || "Unable to load profile");
        }
      } catch (error) {
        console.error("❌ Fetch error:", error);
        Alert.alert("Error", "Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token, dispatch, baseUrl]);

  const handleImagePick = async () => {
    try {
      await Haptics.selectionAsync();

      // Request permission
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photos to change your profile picture."
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLocalProfileImage(result.assets[0].uri);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSave = async () => {
    if (!token) {
      Alert.alert("Error", "Authentication required");
      return;
    }

    try {
      setIsSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const formData = new FormData();
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("phoneNumber", mobile);
      formData.append("country", country);
      formData.append("state", state);
      formData.append("zipCode", zipCode);

      // Add image if it's a new local file
      if (
        localProfileImage &&
        (localProfileImage.startsWith("file://") ||
          localProfileImage.startsWith("content://"))
      ) {
        const filename = localProfileImage.split("/").pop() || "profile.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";

        formData.append("profileImage", {
          uri: localProfileImage,
          type: type,
          name: filename,
        } as any);
      }

      console.log("Saving profile to:", `${baseUrl}/users/edit-profile`);

      const response = await fetch(`${baseUrl}/users/edit-profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for FormData - browser/fetch sets it automatically with boundary
        },
        body: formData,
      });

      const data = await response.json();
      console.log("Save response:", data);

      if (response.ok) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        Alert.alert("Success", "Profile updated successfully!");

        const updatedFields = data?.data || data;

        // Update Redux state
        if (updatedFields?.profileImage) {
          dispatch(setGlobalProfileImage(updatedFields.profileImage));
          setLocalProfileImage(updatedFields.profileImage);
        }
        if (updatedFields?.firstName || updatedFields?.lastName) {
          dispatch(
            setProfileName({
              firstName: updatedFields.firstName || firstName,
              lastName: updatedFields.lastName || lastName,
            })
          );
        }
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Failed", data?.message || "Something went wrong.");
      }
    } catch (error) {
      console.error("❌ Save error:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "An error occurred while updating profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = async () => {
    await Haptics.selectionAsync();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Profile Image */}
        <View style={styles.profileImageContainer}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={
                localProfileImage
                  ? { uri: localProfileImage }
                  : images.defaultProfile
              }
              style={styles.profileImage}
              contentFit="cover"
              transition={300}
            />
            <TouchableOpacity
              style={styles.cameraIcon}
              onPress={handleImagePick}
              activeOpacity={0.7}
            >
              <Feather name="camera" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <Input
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
          />
          <Input
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
          />
          <Input
            label="Email ID"
            value={email}
            editable={false}
            isGray
            onChangeText={() => {}}
          />
          <Input
            label="Mobile Number"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
          />
          <Input label="Country" value={country} onChangeText={setCountry} />
          <Input label="State" value={state} onChangeText={setState} />
          <Input
            label="ZIP Code"
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="numeric"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save Info"}
          </Text>
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
  content: {
    alignItems: "center",
    paddingBottom: responsiveHeight(5),
    paddingTop: Platform.OS === "ios" ? 0 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "80%",
    marginTop: responsiveHeight(2),
    marginBottom: responsiveHeight(3),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F8F8",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  profileImageContainer: {
    alignItems: "center",
    marginVertical: responsiveHeight(3),
  },
  profileImageWrapper: {
    position: "relative",
  },
  profileImage: {
    width: responsiveWidth(30),
    height: responsiveWidth(30),
    borderRadius: responsiveWidth(15),
    borderWidth: 3,
    borderColor: colors.primary + "30",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formContainer: {
    width: responsiveWidth(90),
    paddingHorizontal: responsiveWidth(2.5),
  },
  inputContainer: {
    marginBottom: responsiveHeight(2.5),
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
    color: colors.gray,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    paddingVertical: responsiveHeight(1.8),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputGray: {
    backgroundColor: "#F5F5F5",
    color: colors.gray,
  },
  saveButton: {
    backgroundColor: colors.primary,
    width: responsiveWidth(90),
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: responsiveHeight(3),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default MyProfile;
