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
import RNPickerSelect from "react-native-picker-select";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import colors from "../../assets/color";

const Contact = () => {
  const navigation = useNavigation();

  // State for subject selection and note input
  const [selectedSubject, setSelectedSubject] = useState("");
  const [note, setNote] = useState("");

  // Function to handle form submission
  const handleSend = () => {
    if (!selectedSubject) {
      Alert.alert("Error", "Please select a subject.");
      return;
    }
    if (!note.trim()) {
      Alert.alert("Error", "Please enter a note.");
      return;
    }
    Alert.alert("Success", "Your message has been sent.");
  };

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated={true}
        backgroundColor="transparent"
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
      </View>

      {/* Contact Form */}
      <View style={styles.formContainer}>
        <Text style={styles.label}>Subject</Text>
        <RNPickerSelect
          onValueChange={(value) => setSelectedSubject(value)}
          items={[
            { label: "General Inquiry", value: "general" },
            { label: "Technical Support", value: "support" },
            { label: "Billing Issue", value: "billing" },
            { label: "Other", value: "other" },
          ]}
          style={pickerSelectStyles}
          placeholder={{ label: "Select Subject", value: null }}
          value={selectedSubject}
        />

        <Text style={styles.label}>Add Note</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Write here...."
          placeholderTextColor={colors.gray}
          multiline
          numberOfLines={5}
          value={note}
          onChangeText={setNote}
        />

        {/* Send Button */}
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Picker Styles
const pickerSelectStyles = {
  inputIOS: {
    fontSize: responsiveFontSize(2),
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 8,
    color: colors.black,
    backgroundColor: "#FFF",
  },
  inputAndroid: {
    fontSize: responsiveFontSize(2),
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 8,
    color: colors.black,
    backgroundColor: "#FFF",
  },
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
    height: responsiveHeight(75),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: "bold",
    color: colors.gray,
    marginBottom: responsiveHeight(1),
  },
  textArea: {
    backgroundColor: "#FFF",
    padding: responsiveHeight(1.5),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    textAlignVertical: "top",
    height: responsiveHeight(40),
    marginBottom: responsiveHeight(2),
  },
  sendButton: {
    backgroundColor: colors.brandColor,
    width: responsiveWidth(85),
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    alignSelf: "center",
    marginTop: responsiveHeight(2),
  },
  sendButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
});

export default Contact;
