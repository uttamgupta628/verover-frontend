import React, { useState } from "react";
import {
  Alert,
  ScrollView,
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
import { useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import axiosInstance from "../../api/axios";
import colors from "../../assets/color";
import { logout } from "../../components/redux/authSlice";

const Settings = () => {
  const router = useRouter();
  const dispatch = useDispatch();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [showEmailField, setShowEmailField] = useState(false);
  const [email, setEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    setShowEmailField(true);
  };

  const confirmDeleteAccount = async () => {
    if (!email.trim()) {
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
              setDeleting(true);

              // Correct path — no leading slash to avoid double-slash with baseURL
              await axiosInstance.delete("users/delete-account", {
                data: { email: email.trim() },
              });

              // Clear all local auth data
              await AsyncStorage.removeItem("loginKey");

              // Clear Redux state
              dispatch(logout());

              Alert.alert(
                "Account Deleted",
                "Your account has been deleted successfully.",
                [
                  {
                    text: "OK",
                    onPress: () => router.replace("/login"),
                  },
                ]
              );
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Failed",
                error?.response?.data?.message || "Unable to delete account. Please try again."
              );
            } finally {
              setDeleting(false);
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
        <TouchableOpacity onPress={() => router.back()}>
          <Icon source="arrow-left" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Notifications Section */}
        <Text style={styles.sectionLabel}>Notifications</Text>

        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon source="email-outline" size={20} color={colors.brandColor} />
              <Text style={styles.settingText}>Email Notifications</Text>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={() => setEmailNotifications(!emailNotifications)}
              trackColor={{ false: "#767577", true: colors.brandColor }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon source="message-outline" size={20} color={colors.brandColor} />
              <Text style={styles.settingText}>SMS Notifications</Text>
            </View>
            <Switch
              value={smsNotifications}
              onValueChange={() => setSmsNotifications(!smsNotifications)}
              trackColor={{ false: "#767577", true: colors.brandColor }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        {/* Legal Section */}
        <Text style={styles.sectionLabel}>Legal</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.policyItem}
            onPress={() => router.push("/drawer/privacyPolicy")}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Icon source="shield-lock-outline" size={20} color={colors.brandColor} />
              <Text style={styles.policyText}>Privacy Policy</Text>
            </View>
            <Icon source="chevron-right" size={25} color={colors.gray} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.policyItem}
            onPress={() => router.push("/drawer/cookiePolicy")}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Icon source="cookie-outline" size={20} color={colors.brandColor} />
              <Text style={styles.policyText}>Cookie Policy</Text>
            </View>
            <Icon source="chevron-right" size={25} color={colors.gray} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionLabel}>Account</Text>

        <TouchableOpacity
          style={styles.deleteCard}
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
        >
          <Icon source="account-remove-outline" size={20} color={colors.error} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        {/* Email confirmation field */}
        {showEmailField && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Verify Your Identity</Text>
            <Text style={styles.confirmSubtitle}>
              Enter your registered email address to permanently delete your account.
            </Text>

            <TextInput
              style={styles.emailInput}
              placeholder="Enter your email"
              placeholderTextColor={colors.gray}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!deleting}
            />

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEmailField(false);
                  setEmail("");
                }}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteButton, deleting && styles.buttonDisabled]}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                <Text style={styles.confirmDeleteText}>
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    paddingTop: responsiveHeight(2),
  },
  scrollContent: {
    paddingBottom: responsiveHeight(5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveHeight(3),
    marginLeft: responsiveWidth(5),
    gap: responsiveWidth(3),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
  },
  sectionLabel: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(1),
    marginTop: responsiveHeight(1),
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(1),
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: responsiveWidth(4),
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(4),
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(3),
  },
  settingText: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  policyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(4),
  },
  policyText: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  deleteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
    backgroundColor: "#FFF0F0",
    paddingVertical: responsiveHeight(2),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(1),
    borderWidth: 1,
    borderColor: "#FFD6D6",
  },
  deleteText: {
    fontSize: responsiveFontSize(2),
    color: colors.error,
    fontWeight: "bold",
  },
  confirmCard: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(5),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(1),
    borderWidth: 1,
    borderColor: "#FFD6D6",
  },
  confirmTitle: {
    fontSize: responsiveFontSize(2),
    fontWeight: "700",
    color: colors.black,
    marginBottom: responsiveHeight(0.5),
  },
  confirmSubtitle: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginBottom: responsiveHeight(2),
    lineHeight: responsiveFontSize(2.8),
  },
  emailInput: {
    backgroundColor: "#FAFAFA",
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  confirmActions: {
    flexDirection: "row",
    gap: responsiveWidth(3),
    marginTop: responsiveHeight(2),
  },
  cancelButton: {
    flex: 1,
    paddingVertical: responsiveHeight(1.8),
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: "#FFF",
  },
  cancelButtonText: {
    fontSize: responsiveFontSize(1.9),
    color: colors.gray,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: responsiveHeight(1.8),
    borderRadius: 30,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmDeleteText: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.9),
    fontWeight: "bold",
  },
});

export default Settings;