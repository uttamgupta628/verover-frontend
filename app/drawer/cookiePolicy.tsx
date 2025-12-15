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

const CookiePolicy = () => {
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
        <Text style={styles.headerTitle}>Cookie Policy</Text>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>What Are Cookies?</Text>
        <Text style={styles.text}>
          Cookies are small text files stored on your device when you visit a
          website or use an app. They help us improve user experience, remember
          preferences, and analyze site traffic.
        </Text>

        <Text style={styles.title}>How We Use Cookies</Text>
        <Text style={styles.text}>
          - To remember your preferences and settings.
          {"\n"}- To improve website performance and security.
          {"\n"}- To analyze user behavior and optimize our services.
        </Text>

        <Text style={styles.title}>Types of Cookies We Use</Text>
        <Text style={styles.text}>
          - Essential Cookies: Required for the app to function properly.
          {"\n"}- Analytics Cookies: Help us understand how users interact with
          our platform.
          {"\n"}- Marketing Cookies: Used to personalize ads and promotions.
        </Text>

        <Text style={styles.title}>Managing Cookies</Text>
        <Text style={styles.text}>
          You can control and disable cookies through your device settings.
          However, disabling some cookies may affect your app experience.
        </Text>

        <Text style={styles.title}>Contact Us</Text>
        <Text style={styles.text}>
          If you have any questions about our Cookie Policy, feel free to
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

export default CookiePolicy;
