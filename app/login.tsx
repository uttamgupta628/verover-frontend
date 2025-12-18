import React, { useState } from "react";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Image,
  View,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";

import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

import { useAppDispatch } from "../components/redux/hooks";
import { loginWithEmailPassword } from "../components/redux/authSlice";

interface LoginFormData {
  email: string;
  password: string;
  userType: "user" | "merchant" | "driver";
}

const colors = {
  primary: "#FF8C00",
  white: "#FFFFFF",
  gray: "#888888",
  black: "#000000",
  error: "#FF0000",
};

// Enhanced error message mapper
const getErrorMessage = (error: any): string => {
  // Check for response data
  if (error.response?.data) {
    const errorData = error.response.data;

    // Handle HTML error responses with error codes
    if (typeof errorData === "string") {
      // Extract error code from HTML response
      const match = errorData.match(/Error:\s*([A-Z_]+)/);
      if (match) {
        const errorCode = match[1];

        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          USER_NOT_FOUND:
            "No account found with this email. Please check your email or sign up.",
          INVALID_EMAIL_OR_PASSWORD:
            "Invalid email or password. Please try again.",
          PASSWORD_LOGIN_NOT_AVAILABLE:
            "This account was created using social login. Please use Google or Facebook to sign in.",
          UNAUTHORIZED_ACCESS: "Unauthorized access. Please try again.",
          TOKEN_EXPIRED: "Your session has expired. Please login again.",
          USER_ALREADY_EXISTS: "An account with this email already exists.",
          INVALID_DATA: "Please check your input and try again.",
        };

        return (
          errorMessages[errorCode] || errorCode.replace(/_/g, " ").toLowerCase()
        );
      }

      // Check for specific error strings in HTML
      if (errorData.includes("User not found")) {
        return "No account found with this email. Please check your email or sign up.";
      }
      if (errorData.includes("Invalid email or password")) {
        return "Invalid email or password. Please try again.";
      }
      if (errorData.includes("Password login not available")) {
        return "This account was created using social login. Please use Google or Facebook to sign in.";
      }
    }

    // Handle JSON error responses
    if (errorData.message) {
      return errorData.message;
    }

    if (errorData.error) {
      return errorData.error;
    }
  }

  // Handle HTTP status codes
  if (error.response?.status) {
    const statusMessages: Record<number, string> = {
      400: "Invalid request. Please check your input.",
      401: "Invalid email or password.",
      404: "No account found with this email.",
      500: "Server error. Please try again later.",
      503: "Service temporarily unavailable. Please try again later.",
    };

    return (
      statusMessages[error.response.status] || `Error: ${error.response.status}`
    );
  }

  // Handle network errors
  if (error.message) {
    if (error.message.includes("Network")) {
      return "Network error. Please check your internet connection.";
    }
    return error.message;
  }

  return "Login failed. Please try again.";
};

export default function Login() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [secureEntry, setSecureEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<
    "user" | "merchant" | "driver"
  >("user");

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm<LoginFormData>({
    defaultValues: { email: "", password: "", userType: "user" },
    mode: "onChange",
  });

  const handleUserTypeSelect = (type: "user" | "merchant" | "driver") => {
    setSelectedUserType(type);
    setValue("userType", type, { shouldValidate: true });
  };

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);

    try {
      console.log("Attempting login with:", {
        email: data.email,
        userType: data.userType,
      });

      // Call the login thunk
      const response = await dispatch(
        loginWithEmailPassword(data.email, data.password, data.userType) as any
      );

      console.log("Login response:", response);

      // Check if login was successful
      if (response && response.data && response.data.success) {
        console.log("Login successful");

        // Show success message
        Alert.alert(
          "Welcome Back!",
          `Successfully logged in as ${data.userType}.`,
          [
            {
              text: "OK",
              onPress: () => {
                // Redirect based on user type
                if (data.userType === "merchant") {
                  router.replace("/merchantHome");
                } else if (data.userType === "driver") {
                  router.replace("/driverHome");
                } else {
                  router.replace("/userHome");
                }
              },
            },
          ]
        );
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Login error:", error);

      const errorMessage = getErrorMessage(error);

      // Special handling for "user not found" - offer to sign up
      if (errorMessage.toLowerCase().includes("no account found")) {
        Alert.alert("Account Not Found", errorMessage, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Up",
            onPress: () => router.push("/signup"),
          },
        ]);
      }
      // Special handling for social login accounts
      else if (errorMessage.toLowerCase().includes("social login")) {
        Alert.alert("Social Login Required", errorMessage, [
          { text: "OK", style: "default" },
        ]);
      }
      // General error handling
      else {
        Alert.alert("Login Failed", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />

        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/images/Logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* User Type */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>User Type *</Text>

            <View style={styles.userTypeContainer}>
              {["user", "merchant", "driver"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.userTypeButton,
                    selectedUserType === type && styles.selectedUserTypeButton,
                  ]}
                  onPress={() => handleUserTypeSelect(type as any)}
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

            <Controller
              control={control}
              name="userType"
              rules={{ required: "User type is required" }}
              render={() => null}
            />
            {errors.userType && (
              <Text style={styles.error}>{errors.userType.message}</Text>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Email *</Text>

            <Controller
              control={control}
              name="email"
              rules={{
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Please enter a valid email address",
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="Enter your email"
                  style={[styles.input, errors.email && styles.inputError]}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.gray}
                />
              )}
            />
            {errors.email && (
              <Text style={styles.error}>{errors.email.message}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Password *</Text>

            <Controller
              control={control}
              name="password"
              rules={{
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.passwordContainer}>
                  <TextInput
                    placeholder="Enter password"
                    secureTextEntry={secureEntry}
                    style={[styles.input, styles.passwordInput]}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholderTextColor={colors.gray}
                  />
                  <TouchableOpacity
                    onPress={() => setSecureEntry(!secureEntry)}
                    style={styles.eyeIcon}
                  >
                    <Icon
                      name={secureEntry ? "eye-off" : "eye"}
                      size={24}
                      color={colors.gray}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && (
              <Text style={styles.error}>{errors.password.message}</Text>
            )}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={() => router.push("/forgot-password")}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              (!isValid || loading) && styles.loginButtonDisabled,
            ]}
            onPress={handleSubmit(handleLogin)}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpPrompt}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
  },
  backButton: {
    padding: 16,
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20,
    left: 10,
    zIndex: 1,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: responsiveHeight(8),
    marginBottom: responsiveHeight(6),
  },
  logo: {
    width: responsiveWidth(50),
    height: responsiveHeight(6),
  },
  formContainer: {
    paddingHorizontal: responsiveWidth(6),
  },
  inputWrapper: {
    marginBottom: responsiveHeight(3),
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginBottom: 8,
  },
  input: {
    fontSize: responsiveFontSize(2),
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
    color: colors.black,
  },
  inputError: {
    borderBottomColor: colors.error,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
  },
  passwordInput: {
    flex: 1,
    borderBottomWidth: 0,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: responsiveFontSize(1.8),
    marginBottom: responsiveHeight(2),
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    height: responsiveHeight(6),
    justifyContent: "center",
    alignItems: "center",
    marginTop: responsiveHeight(2),
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: responsiveFontSize(2),
    fontWeight: "600",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: responsiveHeight(3),
  },
  signUpPrompt: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  signUpLink: {
    fontSize: responsiveFontSize(1.8),
    color: colors.primary,
    fontWeight: "600",
  },
  error: {
    color: colors.error,
    fontSize: responsiveFontSize(1.6),
    marginTop: 4,
  },
  userTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1),
  },
  userTypeButton: {
    flex: 1,
    marginHorizontal: responsiveWidth(1),
    paddingVertical: responsiveHeight(1),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.gray,
    alignItems: "center",
  },
  selectedUserTypeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userTypeButtonText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  selectedUserTypeButtonText: {
    color: colors.white,
  },
});
