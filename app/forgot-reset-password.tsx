import React, { useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import axios from "axios";

const colors = {
  primary: "#FF8C00",
  white: "#FFFFFF",
  gray: "#888888",
  black: "#000000",
  error: "#FF0000",
  border: "#E0E0E0",
};

export default function ForgetResetPasswordScreen() {
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const userType = params.userType as string;

  const handleResetPassword = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter OTP.");
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please enter both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        "https://vervoer-backend2.onrender.com/api/users/reset-password",
        {
          email,
          userType,
          otp,
          password,
          confirmPassword,
        }
      );

      if (response.data.success) {
        Alert.alert("Success", "Password reset successfully", [
          {
            text: "OK",
            onPress: () => router.replace("/forgot-success"),
          },
        ]);
      } else {
        Alert.alert("Failed", response.data.message || "Something went wrong.");
      }
    } catch (error: any) {
      console.error("Error:", error);

      let errorMessage = "Password reset failed.";

      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === "string" && errorData.includes("Error:")) {
          const match = errorData.match(/Error:\s*([A-Z_]+)/);
          if (match) {
            const errorCode = match[1];
            errorMessage = errorCode.replace(/_/g, " ").toLowerCase();
            errorMessage =
              errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1);
          }
        } else {
          errorMessage = errorData.message || errorData.error || errorMessage;
        }
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
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
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={{ width: 28 }} />
        </View>

        <Text style={styles.title}>Enter OTP & New Password</Text>
        <Text style={styles.subtitle}>OTP sent to: {email}</Text>

        {/* OTP Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit OTP"
            placeholderTextColor={colors.gray}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setOtp}
            value={otp}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter new password"
              placeholderTextColor={colors.gray}
              secureTextEntry={!showPassword}
              onChangeText={setPassword}
              value={password}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color={colors.gray}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Re-enter password"
              placeholderTextColor={colors.gray}
              secureTextEntry={!showConfirmPassword}
              onChangeText={setConfirmPassword}
              value={confirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Icon
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={24}
                color={colors.gray}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
        </TouchableOpacity>
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
    alignItems: "center",
    paddingHorizontal: responsiveWidth(5),
    paddingBottom: responsiveHeight(5),
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop:
      Platform.OS === "ios" ? responsiveHeight(6) : responsiveHeight(4),
    marginBottom: responsiveHeight(3),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.primary,
    fontWeight: "600",
  },
  title: {
    color: colors.black,
    fontSize: responsiveFontSize(2.8),
    fontWeight: "bold",
    marginTop: responsiveHeight(3),
    marginBottom: responsiveHeight(1),
    textAlign: "center",
  },
  subtitle: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    textAlign: "center",
    marginBottom: responsiveHeight(4),
  },
  inputContainer: {
    width: "100%",
    marginBottom: responsiveHeight(2),
  },
  label: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginBottom: 8,
  },
  input: {
    height: responsiveHeight(6),
    width: "100%",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    height: responsiveHeight(6),
  },
  passwordInput: {
    flex: 1,
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  eyeIcon: {
    padding: 5,
  },
  button: {
    height: responsiveHeight(6),
    width: "100%",
    marginTop: responsiveHeight(3),
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    fontSize: responsiveFontSize(2),
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
