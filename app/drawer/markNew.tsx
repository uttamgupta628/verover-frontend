import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RadioButton } from "react-native-paper";
import Icon from "react-native-paper/src/components/Icon";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useDispatch } from "react-redux";

import colors from "../../assets/color";
import { images } from "../../assets/images/images";
import { addUnsafeStop } from "../../components/redux/unsafeStopsSlice";

const MarkNew = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const handleSubmit = () => {
    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason for marking this station.");
      return;
    }

    if (selectedReason === "Other" && otherReason.trim() === "") {
      Alert.alert("Error", "Please enter a reason.");
      return;
    }

    const newStop = {
      id: Date.now(),
      title: "New Unsafe Stop",
      description: selectedReason === "Other" ? otherReason : selectedReason,
      time: "Unknown Time",
    };

    dispatch(addUnsafeStop(newStop));

    Alert.alert("Success", "Unsafe station reported successfully.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
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
        <Text style={styles.headerTitle}>Mark On Map</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView>
        {/* Map */}
        <View style={styles.mapContainer}>
          <Image source={images.BGmap} style={styles.map} />
        </View>

        {/* Station Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Or Add Station Name Manually</Text>
          <TextInput
            style={styles.stationNameInput}
            value="New Unsafe Stop"
            editable={false}
          />
        </View>

        {/* Reasons */}
        <View style={styles.reasonContainer}>
          <Text style={styles.label}>Why it is Unsafe?</Text>

          <RadioButton.Group
            onValueChange={setSelectedReason}
            value={selectedReason}
          >
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setSelectedReason("Thieves & Goons")}
            >
              <RadioButton value="Thieves & Goons" color={colors.brandColor} />
              <Text style={styles.radioText}>Thieves & Goons</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setSelectedReason("Construction Work in Progress")}
            >
              <RadioButton
                value="Construction Work in Progress"
                color={colors.brandColor}
              />
              <Text style={styles.radioText}>
                Construction Work in Progress
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setSelectedReason("Insufficient Cleaning")}
            >
              <RadioButton
                value="Insufficient Cleaning"
                color={colors.brandColor}
              />
              <Text style={styles.radioText}>Insufficient Cleaning</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setSelectedReason("Other")}
            >
              <RadioButton value="Other" color={colors.brandColor} />
              <Text style={styles.radioText}>Other Reason</Text>
            </TouchableOpacity>
          </RadioButton.Group>

          {selectedReason === "Other" && (
            <TextInput
              style={styles.otherReasonInput}
              placeholder="Write Your Reason..."
              value={otherReason}
              onChangeText={setOtherReason}
            />
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: responsiveWidth(90),
    marginTop: "0%",
    alignSelf: "center",
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    fontWeight: "bold",
    color: colors.black,
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  placeholder: {
    width: 35,
  },

  mapContainer: {
    width: "100%",
    height: responsiveHeight(40),
  },
  map: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  inputContainer: {
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(2),
  },
  label: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: 5,
  },
  stationNameInput: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },

  reasonContainer: {
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(2),
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  radioText: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
    marginLeft: 10,
  },
  otherReasonInput: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
    fontSize: responsiveFontSize(2),
    color: colors.black,
    marginTop: 10,
  },

  submitButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(3),
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
});

export default MarkNew;
