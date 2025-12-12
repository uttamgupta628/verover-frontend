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
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import { useRouter } from "expo-router";
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

type FormData = {
  email: string;
  userType: "user" | "merchant" | "driver";
};

export default function ForgotPassword() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<
    "user" | "merchant" | "driver"
  >("user");

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: "",
      userType: "user",
    },
  });

  const handleUserTypeSelect = (type: "user" | "merchant" | "driver") => {
    setSelectedUserType(type);
    setValue("userType", type);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      const response = await axios.post(
        "https://vervoer-backend2.onrender.com/api/users/forgot-password",
        {
          email: data.email,
          userType: selectedUserType,
        }
      );

      if (response.data.success) {
        Alert.alert("Success", "OTP has been sent to your email.", [
          {
            text: "OK",
            onPress: () =>
              router.push({
                pathname: "/forgot-reset-password",
                params: { email: data.email, userType: selectedUserType },
              }),
          },
        ]);
      } else {
        Alert.alert("Failed", response.data.message || "Something went wrong.");
      }
    } catch (error: any) {
      console.log(error);

      let errorMessage = "Failed to send OTP.";

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
          <Text style={styles.headerTitle}>Forgot Password</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Icon name="lock-reset" size={80} color={colors.primary} />
        </View>

        <Text style={styles.title}>Reset Your Password</Text>

        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you an OTP to reset your
            password.
          </Text>
        </View>

        {/* User Type Selection */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>User Type</Text>
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
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>Email Address</Text>

          <Controller
            control={control}
            rules={{
              required: "Email is required",
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: "Enter a valid email",
              },
            }}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.gray}
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>

        {errors.email && (
          <Text style={styles.errorText}>{errors.email.message}</Text>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginPrompt}>Remember your password? </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
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
    marginBottom: responsiveHeight(2),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.primary,
    fontWeight: "600",
  },
  iconContainer: {
    marginTop: responsiveHeight(3),
    marginBottom: responsiveHeight(2),
  },
  title: {
    color: colors.black,
    fontSize: responsiveFontSize(2.8),
    fontWeight: "bold",
    marginBottom: responsiveHeight(1),
    textAlign: "center",
  },
  subtitleContainer: {
    width: responsiveWidth(80),
    marginBottom: responsiveHeight(3),
  },
  subtitle: {
    textAlign: "center",
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    lineHeight: responsiveFontSize(2.5),
  },
  inputWrapper: {
    width: "100%",
    marginBottom: responsiveHeight(2),
  },
  label: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginBottom: 8,
  },
  userTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  formContainer: {
    width: "100%",
    marginBottom: responsiveHeight(1),
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
  button: {
    height: responsiveHeight(6),
    width: "100%",
    marginTop: responsiveHeight(3),
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: responsiveFontSize(2),
    color: colors.white,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: responsiveFontSize(1.6),
    marginTop: 4,
    alignSelf: "flex-start",
  },
  loginContainer: {
    flexDirection: "row",
    marginTop: responsiveHeight(3),
    alignItems: "center",
  },
  loginPrompt: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
  },
  loginLink: {
    fontSize: responsiveFontSize(1.7),
    color: colors.primary,
    fontWeight: "600",
  },
});
