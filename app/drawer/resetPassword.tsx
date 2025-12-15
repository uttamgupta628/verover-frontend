import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-paper/src/components/Icon";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useSelector } from "react-redux";

import axiosInstance from "../../api/axios";
import colors from "../../assets/color";
import { RootState } from "../../components/redux/store";

const ResetPassword = () => {
  const navigation = useNavigation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);

  const { token } = useSelector((state: RootState) => state.auth);

  const handleReset = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "All fields are required.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    try {
      if (!token) {
        Alert.alert("Error", "User not authenticated.");
        return;
      }

      const response = await axiosInstance.put("/users/reset-user-password", {
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
      });

      if (response.data?.success) {
        Alert.alert("Success", "Password has been reset successfully.");
        navigation.goBack();
      } else {
        Alert.alert(
          "Failed",
          response.data?.message || "Something went wrong."
        );
      }
    } catch (error: any) {
      console.error("Reset password error:", error);
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          "Something went wrong while resetting password."
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated
        backgroundColor="transparent"
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
      </View>

      {/* Form */}
      <View style={styles.formContainer}>
        <Text style={styles.label}>Current Password</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter Current Password"
            placeholderTextColor={colors.gray}
            secureTextEntry={secureEntry}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
        </View>

        <Text style={styles.label}>Create New Password</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter New Password"
            placeholderTextColor={colors.gray}
            secureTextEntry={secureEntry}
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <Text style={styles.label}>Re-enter Password</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Re-enter New Password"
            placeholderTextColor={colors.gray}
            secureTextEntry={secureEntry}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>Reset Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    paddingTop: responsiveHeight(2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveHeight(3),
    marginLeft: responsiveWidth(5),
    marginTop: "0%",
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
    marginLeft: responsiveWidth(3),
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(5),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: responsiveHeight(75),
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
    color: colors.gray,
    marginBottom: responsiveHeight(1),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    marginBottom: responsiveHeight(2),
  },
  input: {
    flex: 1,
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  resetButton: {
    backgroundColor: colors.brandColor,
    width: responsiveWidth(85),
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    alignSelf: "center",
    marginTop: responsiveHeight(20),
  },
  resetButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
});

export default ResetPassword;
