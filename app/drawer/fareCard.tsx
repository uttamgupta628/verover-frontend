import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
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

const FareCard = () => {
  const navigation = useNavigation();

  // ✅ Redux kept
  const token = useSelector((state: RootState) => state.auth.token);

  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");

  const handleSubmit = async () => {
    if (!accountHolderName || !accountNumber || !ifscCode || !branch) {
      Alert.alert("Missing Fields", "Please fill all bank details.");
      return;
    }

    try {
      await axiosInstance.put("/users/update-bank-details", {
        accountHolderName,
        accountNumber,
        ifscCode,
        branch,
      });

      Alert.alert("Success", "Bank details updated successfully");
      navigation.goBack();
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to update bank details"
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        backgroundColor="transparent"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon source="arrow-left" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Bank Details</Text>
        </View>

        {/* Bank Details Input */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>Bank Information</Text>

          <TextInput
            style={styles.input}
            placeholder="Account Holder Name"
            placeholderTextColor={colors.gray}
            value={accountHolderName}
            onChangeText={setAccountHolderName}
          />

          <TextInput
            style={styles.input}
            placeholder="Account Number"
            placeholderTextColor={colors.gray}
            keyboardType="numeric"
            value={accountNumber}
            onChangeText={setAccountNumber}
          />

          <TextInput
            style={styles.input}
            placeholder="IFSC Code"
            placeholderTextColor={colors.gray}
            value={ifscCode}
            onChangeText={setIfscCode}
          />

          <TextInput
            style={styles.input}
            placeholder="Branch Name"
            placeholderTextColor={colors.gray}
            value={branch}
            onChangeText={setBranch}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: responsiveWidth(60),
    justifyContent: "space-between",
    marginTop: "0%",
    alignSelf: "flex-start",
    marginLeft: "5%",
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
    textAlign: "center",
    flex: 1,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    width: responsiveWidth(90),
    padding: responsiveWidth(5),
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: responsiveHeight(3),
  },
  cardTitle: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(2),
  },
  input: {
    backgroundColor: "#FFF",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    marginBottom: responsiveHeight(2),
  },
  saveButton: {
    backgroundColor: colors.brandColor,
    width: responsiveWidth(85),
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    marginTop: responsiveHeight(5),
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
});

export default FareCard;
