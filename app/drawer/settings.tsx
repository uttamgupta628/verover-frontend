import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Switch,
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
import { useDispatch, useSelector } from "react-redux";

import axiosInstance from "../../api/axios";
import colors from "../../assets/color";
import { logout } from "../../components/redux/authSlice";
import { RootState } from "../../components/redux/store";

const Settings = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const { token } = useSelector((state: RootState) => state.auth);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [showEmailField, setShowEmailField] = useState(false);
  const [email, setEmail] = useState("");

  const handleDeleteAccount = () => {
    setShowEmailField(true);
  };

  const confirmDeleteAccount = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email to proceed.");
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await axiosInstance.delete("/users/delete-account", {
                data: { email }, // axios DELETE body
              });

              Alert.alert(
                "Deleted",
                "Your account has been deleted successfully."
              );

              dispatch(logout());

              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              });
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Failed",
                error?.response?.data?.message || "Unable to delete account."
              );
            }
          },
        },
      ]
    );
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Notification Settings */}
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Email Notifications</Text>
        <Switch
          value={emailNotifications}
          onValueChange={() => setEmailNotifications(!emailNotifications)}
          trackColor={{ false: "#767577", true: colors.brandColor }}
          thumbColor={emailNotifications ? "#FFF" : "#f4f3f4"}
        />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>SMS Notifications</Text>
        <Switch
          value={smsNotifications}
          onValueChange={() => setSmsNotifications(!smsNotifications)}
          trackColor={{ false: "#767577", true: colors.brandColor }}
          thumbColor={smsNotifications ? "#FFF" : "#f4f3f4"}
        />
      </View>

      {/* Policies */}
      <TouchableOpacity
        style={styles.policyItem}
        onPress={() => navigation.navigate("drawer/privacyPolicy")}
      >
        <Text style={styles.policyText}>Privacy Policy</Text>
        <Icon source="chevron-right" size={25} color={colors.gray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.policyItem}
        onPress={() => navigation.navigate("drawer/cookiePolicy")}
      >
        <Text style={styles.policyText}>Cookie Policy</Text>
        <Icon source="chevron-right" size={25} color={colors.gray} />
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity style={styles.deleteItem} onPress={handleDeleteAccount}>
        <Text style={styles.deleteText}>Delete Account</Text>
      </TouchableOpacity>

      {showEmailField && (
        <View style={styles.passwordContainer}>
          <Text style={styles.passwordLabel}>Verify Your Email</Text>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your email"
            placeholderTextColor={colors.gray}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity
            style={styles.confirmDeleteButton}
            onPress={confirmDeleteAccount}
          >
            <Text style={styles.confirmDeleteText}>Confirm Delete</Text>
          </TouchableOpacity>
        </View>
      )}
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
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(5),
    borderRadius: 10,
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(2),
  },
  settingText: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  policyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(5),
    borderRadius: 10,
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(2),
  },
  policyText: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  deleteItem: {
    backgroundColor: "white",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(5),
    borderRadius: 10,
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(2),
  },
  deleteText: {
    fontSize: responsiveFontSize(2),
    color: colors.error,
    textAlign: "center",
    fontWeight: "bold",
  },
  passwordContainer: {
    backgroundColor: "white",
    padding: responsiveWidth(5),
    borderRadius: 10,
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(2),
  },
  passwordLabel: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  passwordInput: {
    backgroundColor: "#FFF",
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  confirmDeleteButton: {
    backgroundColor: colors.brandColor,
    marginTop: responsiveHeight(2),
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
  },
  confirmDeleteText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
});

export default Settings;
