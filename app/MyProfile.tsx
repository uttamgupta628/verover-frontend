import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
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
import { useDispatch, useSelector } from "react-redux";
import axiosInstance from "../api/axios";
import colors from "../assets/color";
import { images } from "../assets/images/images";
import {
  setProfileImage as setGlobalProfileImage,
  setProfileName,
} from "../components/redux/profileSlice";
import { RootState } from "../components/redux/store";

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
      autoCorrect={false}
      autoComplete="off"
    />
  </View>
);

const MyProfile = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const scrollRef = useRef<ScrollView>(null);
  const { token } = useSelector((state: RootState) => state.auth);

  const [localProfileImage, setLocalProfileImage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        setIsLoading(true);
        const res = await axiosInstance.get("/users/get-profile", {
          headers: { Authorization: token },
        });
        const user = res.data?.data || res.data;
        setFirstName(user?.firstName || "");
        setLastName(user?.lastName || "");
        setEmail(user?.email || "");
        setMobile(user?.phoneNumber || user?.phone || "");
        setCountry(user?.country || "");
        setState(user?.state || "");
        setZipCode(user?.zipCode || "");
        setVehicleNumber(user?.vehicleNumber || "");
        setLocalProfileImage(user?.profileImage || null);
        dispatch(setGlobalProfileImage(user?.profileImage || null));
        dispatch(
          setProfileName({
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
          })
        );
      } catch (err: any) {
        Alert.alert(
          "Error",
          err?.response?.data?.message || "Failed to load profile data"
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [token, dispatch]);

  const handleImagePick = async () => {
    try {
      await Haptics.selectionAsync();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setLocalProfileImage(result.assets[0].uri);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSave = async () => {
    if (!token) {
      Alert.alert("Error", "Authentication required");
      return;
    }
    if (vehicleNumber.trim() && vehicleNumber.trim().length < 5) {
      Alert.alert(
        "Invalid Vehicle Number",
        "Vehicle number must be at least 5 characters. Example: WB 01 AB 1234"
      );
      return;
    }

    setIsSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const formData = new FormData();
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("phoneNumber", mobile);
      formData.append("country", country);
      formData.append("state", state);
      formData.append("zipCode", zipCode);
      if (vehicleNumber.trim()) {
        formData.append("vehicleNumber", vehicleNumber.trim().toUpperCase());
      }
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
          type,
          name: filename,
        } as any);
      }

      const res = await axiosInstance.put("/users/edit-profile", formData, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
        timeout: 15000,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile updated successfully!");

      const updatedFields = res.data?.data || res.data;
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
      if (updatedFields?.vehicleNumber) {
        setVehicleNumber(updatedFields.vehicleNumber);
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err?.response?.data?.message ||
        (err?.code === "ECONNABORTED"
          ? "Request timed out. Please try again."
          : null) ||
        "An error occurred while updating profile.";
      Alert.alert("Error", message);
    } finally {
      setIsSaving(false); // ✅ ALWAYS runs
    }
  };

  const handleBack = async () => {
    await Haptics.selectionAsync();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Feather
                name="arrow-left"
                size={responsiveFontSize(2.5)}
                color={colors.primary}
              />
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
                <Feather
                  name="camera"
                  size={responsiveFontSize(2)}
                  color="#FFFFFF"
                />
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
            <Input
              label="Country"
              value={country}
              onChangeText={setCountry}
            />
            <Input
              label="State"
              value={state}
              onChangeText={setState}
            />
            <Input
              label="ZIP Code"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
            />

            {/* Vehicle Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Vehicle Number (optional)</Text>
              <View style={styles.vehicleInputWrapper}>
                <Feather
                  name="truck"
                  size={responsiveFontSize(1.8)}
                  color={colors.gray}
                  style={styles.vehicleIcon}
                />
                <TextInput
                  style={styles.vehicleInput}
                  value={vehicleNumber}
                  onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
                  placeholder="e.g., WB 01 AB 1234"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  editable={true}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                />
                {vehicleNumber.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setVehicleNumber("")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather
                      name="x"
                      size={responsiveFontSize(1.8)}
                      color={colors.gray}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.vehicleHint}>
                💡 Save once — skip entering it at every booking
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Saving..." : "Save Info"}
            </Text>
          </TouchableOpacity>

          <View style={styles.keyboardSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  flex: { flex: 1 },
  content: {
    alignItems: "center",
    paddingHorizontal: responsiveWidth(2),
    paddingBottom: responsiveHeight(35),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "90%",
    marginTop: responsiveHeight(2),
    marginBottom: responsiveHeight(3),
  },
  backButton: {
    width: responsiveWidth(10),
    height: responsiveWidth(10),
    borderRadius: responsiveWidth(5),
    backgroundColor: "#F8F8F8",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: responsiveWidth(10) },
  profileImageContainer: {
    alignItems: "center",
    marginVertical: responsiveHeight(3),
  },
  profileImageWrapper: { position: "relative" },
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
    borderRadius: responsiveWidth(10),
    width: responsiveWidth(10),
    height: responsiveWidth(10),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: { elevation: 5 },
    }),
  },
  formContainer: {
    width: responsiveWidth(90),
    paddingHorizontal: responsiveWidth(2),
  },
  inputContainer: { marginBottom: responsiveHeight(2.5) },
  label: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "600",
    color: colors.gray,
    marginBottom: responsiveHeight(0.8),
  },
  input: {
    backgroundColor: "#FFFFFF",
    paddingVertical: responsiveHeight(1.8),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: responsiveWidth(3),
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  inputGray: { backgroundColor: "#F5F5F5", color: colors.gray },
  vehicleInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: responsiveWidth(3),
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingHorizontal: responsiveWidth(4),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  vehicleIcon: { marginRight: responsiveWidth(2) },
  vehicleInput: {
    flex: 1,
    paddingVertical: responsiveHeight(1.8),
    fontSize: responsiveFontSize(2),
    color: colors.black,
    letterSpacing: Platform.OS === "ios" ? 1 : 0,
  },
  vehicleHint: {
    fontSize: responsiveFontSize(1.5),
    color: colors.primary,
    marginTop: responsiveHeight(0.8),
  },
  saveButton: {
    backgroundColor: colors.primary,
    width: responsiveWidth(90),
    paddingVertical: responsiveHeight(2),
    borderRadius: responsiveWidth(8),
    alignItems: "center",
    justifyContent: "center",
    marginTop: responsiveHeight(3),
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  keyboardSpacer: { height: responsiveHeight(5) },
});

export default MyProfile;