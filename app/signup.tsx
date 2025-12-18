import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useAppDispatch } from "../components/redux/hooks";
import { registerWithEmailPassword } from "../components/redux/authSlice";

interface SignupFormInputs {
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  state: string;
  zipCode: string;
  userType: string;
}

const colors = {
  primary: "#FF8C00",
  white: "#FFFFFF",
  gray: "#888888",
  black: "#000000",
  error: "#FF0000",
  lightGray: "#E0E0E0",
};

export default function Signup() {
  const [countryCode, setCountryCode] = useState("+1");
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [selectedUserType, setSelectedUserType] = useState("user");

  const router = useRouter();
  const dispatch = useAppDispatch();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormInputs>({
    defaultValues: {
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      email: "",
      country: "",
      state: "",
      zipCode: "",
      userType: "user",
    },
  });

  const password = watch("password");

  const sendOTP = async (data: SignupFormInputs) => {
    setLoading(true);

    const payload = {
      phoneNumber: `${countryCode}${data.phoneNumber}`,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      country: data.country,
      state: data.state,
      zipCode: data.zipCode,
      userType: data.userType,
    };

    console.log("Calling Registration with payload:", payload);

    try {
      const response = await dispatch(registerWithEmailPassword(payload));

      console.log("Registration response:", response);

      if (response && response.data) {
        console.log("Token:", response.data.token);
        Alert.alert("Success", "OTP sent to your email!", [
          {
            text: "OK",
            onPress: () => router.push("/email-otp"),
          },
        ]);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Registration Error:", error);

      let errorMessage = "Failed to sign up. Please try again.";

      if (error.response?.data) {
        const errorData = error.response.data;

        // Handle HTML responses with error codes
        if (typeof errorData === "string") {
          if (errorData.includes("USER_ALREADY_EXISTS")) {
            errorMessage = "This email or phone number is already registered.";
          } else {
            const match = errorData.match(/Error:\s*([A-Z_]+)/);
            if (match) {
              const errorCode = match[1];
              const errorMap: Record<string, string> = {
                PASSWORD_REQUIRED: "Password is required.",
                INVALID_DATA: "Please check your input and try again.",
                USER_ALREADY_EXISTS:
                  "This email or phone number is already registered.",
              };
              errorMessage =
                errorMap[errorCode] ||
                errorCode.replace(/_/g, " ").toLowerCase();
            }
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }

      // Offer to navigate to login if user exists
      if (errorMessage.toLowerCase().includes("already")) {
        Alert.alert(
          "Account Exists",
          errorMessage + " Would you like to login instead?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Go to Login", onPress: () => router.replace("/login") },
          ]
        );
      } else {
        Alert.alert("Registration Error", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // const handleUserTypeSelect = (type: string) => {
  //   setSelectedUserType(type);
  //   setValue('userType', type);
  // };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />

        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registration</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>Register Your Details</Text>
          <Text style={styles.subtitleText}>
            We will send an OTP to verify your email.
          </Text>
        </View>

        {/* User Type */}
        <View style={styles.formContainer1}>
          <Text style={styles.inputLabel}>User Type *</Text>
          <View style={styles.userTypeContainer}>
            {["user", "driver", "merchant"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.userTypeButton,
                  selectedUserType === type && styles.selectedUserTypeButton,
                ]}
                onPress={() => handleUserTypeSelect(type)}
              >
                <Text
                  style={[
                    styles.userTypeButtonText,
                    selectedUserType === type &&
                      styles.selectedUserTypeButtonText,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {errors.userType && (
          <Text style={styles.errorText}>{errors.userType.message}</Text>
        )}

        {/* First Name */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <Controller
            control={control}
            name="firstName"
            rules={{
              required: "First name is required",
              minLength: {
                value: 2,
                message: "First name must be at least 2 characters",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Enter First Name"
                placeholderTextColor={colors.gray}
                style={styles.textInput}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>
        {errors.firstName && (
          <Text style={styles.errorText}>{errors.firstName.message}</Text>
        )}

        {/* Last Name */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <Controller
            control={control}
            name="lastName"
            rules={{
              required: "Last name is required",
              minLength: {
                value: 2,
                message: "Last name must be at least 2 characters",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Enter Last Name"
                placeholderTextColor={colors.gray}
                style={styles.textInput}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>
        {errors.lastName && (
          <Text style={styles.errorText}>{errors.lastName.message}</Text>
        )}

        {/* Email */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email Address *</Text>
          <Controller
            control={control}
            name="email"
            rules={{
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Enter a valid email address",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Enter Email"
                placeholderTextColor={colors.gray}
                style={styles.textInput}
                keyboardType="email-address"
                autoCapitalize="none"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>
        {errors.email && (
          <Text style={styles.errorText}>{errors.email.message}</Text>
        )}

        {/* Country */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Country *</Text>
          <Controller
            control={control}
            name="country"
            rules={{
              required: "Country is required",
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Enter Country"
                placeholderTextColor={colors.gray}
                style={styles.textInput}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>
        {errors.country && (
          <Text style={styles.errorText}>{errors.country.message}</Text>
        )}

        {/* State */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>State *</Text>
          <Controller
            control={control}
            name="state"
            rules={{
              required: "State is required",
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Enter State"
                placeholderTextColor={colors.gray}
                style={styles.textInput}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>
        {errors.state && (
          <Text style={styles.errorText}>{errors.state.message}</Text>
        )}

        {/* Zip Code */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Zip Code *</Text>
          <Controller
            control={control}
            name="zipCode"
            rules={{
              required: "Zip Code is required",
              pattern: {
                value: /^[0-9]{5,6}$/,
                message: "Enter a valid zip code",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Enter Zip Code"
                placeholderTextColor={colors.gray}
                style={styles.textInput}
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>
        {errors.zipCode && (
          <Text style={styles.errorText}>{errors.zipCode.message}</Text>
        )}

        {/* Phone Number Input */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Phone Number *</Text>
          <View style={styles.phoneInputContainer}>
            {/* Country Code Input */}
            <TextInput
              style={styles.countryCodeInput}
              value={countryCode}
              onChangeText={setCountryCode}
              placeholder="+1"
              placeholderTextColor={colors.gray}
              keyboardType="phone-pad"
            />

            {/* Phone Number Input */}
            <Controller
              control={control}
              name="phoneNumber"
              rules={{
                required: "Phone number is required",
                pattern: {
                  value: /^[0-9]{10}$/,
                  message: "Enter a valid 10-digit phone number",
                },
              }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  placeholder="Enter Phone Number"
                  placeholderTextColor={colors.gray}
                  style={styles.phoneInput}
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </View>
        </View>
        {errors.phoneNumber && (
          <Text style={styles.errorText}>{errors.phoneNumber.message}</Text>
        )}

        {/* Password Field */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Create Password *</Text>
          <View style={styles.passwordContainer}>
            <Controller
              control={control}
              name="password"
              rules={{
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters",
                },
                pattern: {
                  value:
                    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                  message:
                    "Password must include uppercase, lowercase, number, and special character",
                },
              }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  placeholder="Create Password"
                  placeholderTextColor={colors.gray}
                  style={styles.passwordInput}
                  secureTextEntry={!isPasswordVisible}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.visibilityToggle}
            >
              <Icon
                name={isPasswordVisible ? "eye-off" : "eye"}
                size={24}
                color={colors.gray}
              />
            </TouchableOpacity>
          </View>
        </View>
        {errors.password && (
          <Text style={styles.errorText}>{errors.password.message}</Text>
        )}

        {/* Confirm Password */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Re-enter Password *</Text>
          <View style={styles.passwordContainer}>
            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: "Please confirm your password",
                validate: (value) =>
                  value === password || "Passwords do not match",
              }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  placeholder="Re-enter Password"
                  placeholderTextColor={colors.gray}
                  style={styles.passwordInput}
                  secureTextEntry={!isConfirmPasswordVisible}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            <TouchableOpacity
              onPress={() =>
                setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
              }
              style={styles.visibilityToggle}
            >
              <Icon
                name={isConfirmPasswordVisible ? "eye-off" : "eye"}
                size={24}
                color={colors.gray}
              />
            </TouchableOpacity>
          </View>
        </View>
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
        )}

        {/* Send OTP Button */}
        <TouchableOpacity
          style={[styles.continueButton, loading && styles.disabledButton]}
          onPress={handleSubmit(sendOTP)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginPrompt}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: responsiveHeight(5) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.white,
    paddingHorizontal: responsiveWidth(5),
    paddingBottom: responsiveHeight(3),
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop:
      Platform.OS === "ios" ? responsiveHeight(6) : responsiveHeight(4),
    marginBottom: responsiveHeight(2),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.primary,
    fontWeight: "600",
  },
  titleContainer: {
    width: "100%",
    marginTop: responsiveHeight(2),
    marginBottom: responsiveHeight(3),
  },
  mainTitle: {
    fontSize: responsiveFontSize(2.8),
    color: colors.black,
    textAlign: "center",
    fontWeight: "600",
  },
  subtitleText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    textAlign: "center",
    marginTop: responsiveHeight(1),
  },
  formContainer: {
    marginTop: responsiveHeight(2),
    width: "100%",
    borderBottomWidth: 1,
    borderColor: colors.lightGray,
  },
  formContainer1: {
    marginTop: responsiveHeight(2),
    width: "100%",
  },
  inputLabel: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginBottom: responsiveHeight(0.5),
  },
  textInput: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
    paddingVertical: responsiveHeight(1),
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  countryCodeInput: {
    width: responsiveWidth(15),
    fontSize: responsiveFontSize(2),
    color: colors.black,
    paddingVertical: responsiveHeight(1),
    paddingRight: responsiveWidth(2),
    borderRightWidth: 1,
    borderColor: colors.lightGray,
  },
  phoneInput: {
    flex: 1,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(3),
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    paddingVertical: responsiveHeight(1),
  },
  visibilityToggle: {
    padding: responsiveWidth(2),
  },
  continueButton: {
    height: responsiveHeight(6),
    width: "100%",
    marginTop: responsiveHeight(4),
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 25,
  },
  disabledButton: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: responsiveFontSize(2),
    color: colors.white,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: responsiveHeight(3),
  },
  loginPrompt: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  loginLink: {
    fontSize: responsiveFontSize(1.8),
    color: colors.primary,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: responsiveFontSize(1.5),
    marginTop: responsiveHeight(0.5),
  },
  userTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(1),
  },
  userTypeButton: {
    flex: 1,
    marginHorizontal: responsiveWidth(1),
    paddingVertical: responsiveHeight(1.5),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  selectedUserTypeButton: {
    backgroundColor: colors.primary,
  },
  userTypeButtonText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.primary,
    fontWeight: "500",
  },
  selectedUserTypeButtonText: {
    color: colors.white,
  },
});
