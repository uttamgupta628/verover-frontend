import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-paper/src/components/Icon";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

import colors from "../../assets/color";

const PrivacyPolicy = () => {
  const navigation = useNavigation();

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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Introduction</Text>
        <Text style={styles.text}>
          Welcome to our Privacy Policy page. Your privacy is of great
          importance to us. This document outlines how we collect, use, and
          protect your personal data.
        </Text>

        <Text style={styles.title}>Information We Collect</Text>
        <Text style={styles.text}>
          We collect personal information such as name, email, and phone number
          when you register on our app. Additionally, we may collect usage data,
          device information, and location details.
        </Text>

        <Text style={styles.title}>How We Use Your Information</Text>
        <Text style={styles.text}>
          - To provide and maintain our services.
          {"\n"}- To notify you about updates.
          {"\n"}- To improve user experience.
          {"\n"}- To comply with legal obligations.
        </Text>

        <Text style={styles.title}>Data Protection</Text>
        <Text style={styles.text}>
          We take appropriate security measures to protect your data from
          unauthorized access, alteration, or destruction.
        </Text>

        <Text style={styles.title}>Contact Us</Text>
        <Text style={styles.text}>
          If you have any questions regarding our Privacy Policy, feel free to
          contact us.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(5),
    marginTop: "0%",
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
    marginLeft: responsiveWidth(3),
  },
  content: {
    paddingHorizontal: responsiveWidth(5),
    paddingBottom: responsiveHeight(5),
  },
  title: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  text: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginBottom: responsiveHeight(2),
    lineHeight: 22,
  },
});

export default PrivacyPolicy;
