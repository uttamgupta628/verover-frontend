import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import colors from "../../assets/color";
import axiosInstance from "../../api/axios";

// ── Subject options relevant to Vervoer's services ───────────────────────────
const SUBJECTS = [
  { label: "Parking Slot Issue",      value: "parking_slot",     icon: "map-pin"      },
  { label: "Residence Parking Issue", value: "residence_parking", icon: "home"         },
  { label: "Garage Parking Issue",    value: "garage_parking",    icon: "archive"      },
  { label: "Dry Cleaning Pickup",     value: "dry_cleaning",      icon: "wind"         },
  { label: "Driver / Delivery Issue", value: "driver_issue",      icon: "truck"        },
  { label: "Payment / Billing",       value: "billing",           icon: "credit-card"  },
  { label: "Tracking Problem",        value: "tracking",          icon: "activity"     },
  { label: "General Inquiry",         value: "general",           icon: "message-circle"},
];

const Contact = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Animated values for send button press
  const buttonScale = useRef(new Animated.Value(1)).current;

  const selectedLabel = SUBJECTS.find((s) => s.value === selectedSubject)?.label || "";
  const selectedIcon  = SUBJECTS.find((s) => s.value === selectedSubject)?.icon  || "chevron-down";

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 80,  useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!selectedSubject) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Missing Subject", "Please select a subject for your query.");
      return;
    }
    if (!note.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Missing Message", "Please describe your issue or question.");
      return;
    }

    animateButton();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setSending(true);
      // Backend route: POST /submit-query  →  authenticate → submitQueryToAdmin
      await axiosInstance.post("users/submit-query", {
        subject: selectedSubject,
        message: note.trim(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Message Sent!",
        "Our team will get back to you as soon as possible.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Failed to Send",
        error?.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={22} color={colors.brandColor} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Contact Us</Text>
          </View>

          {/* ── Hero banner ── */}
          <LinearGradient
            colors={[colors.brandColor, colors.primary ?? "#FF6A00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroIconCircle}>
              <Feather name="headphones" size={32} color="#FFF" />
            </View>
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroSub}>
              We're here for parking, dry cleaning, driver, and payment issues — tell us what's going on.
            </Text>
          </LinearGradient>

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Subject picker */}
            <Text style={styles.label}>Subject</Text>
            <TouchableOpacity
              style={styles.pickerTrigger}
              onPress={() => {
                Haptics.selectionAsync();
                setShowPicker(!showPicker);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.pickerLeft}>
                <Feather
                  name={selectedIcon as any}
                  size={18}
                  color={selectedSubject ? colors.brandColor : colors.gray}
                />
                <Text
                  style={[
                    styles.pickerText,
                    !selectedSubject && styles.pickerPlaceholder,
                  ]}
                >
                  {selectedSubject ? selectedLabel : "Select a subject…"}
                </Text>
              </View>
              <Feather
                name={showPicker ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.gray}
              />
            </TouchableOpacity>

            {/* Dropdown options */}
            {showPicker && (
              <View style={styles.dropdown}>
                {SUBJECTS.map((item, index) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.dropdownItem,
                      index < SUBJECTS.length - 1 && styles.dropdownDivider,
                      selectedSubject === item.value && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedSubject(item.value);
                      setShowPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dropdownIconWrap,
                        selectedSubject === item.value && styles.dropdownIconWrapActive,
                      ]}
                    >
                      <Feather
                        name={item.icon as any}
                        size={16}
                        color={selectedSubject === item.value ? "#FFF" : colors.brandColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dropdownLabel,
                        selectedSubject === item.value && styles.dropdownLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selectedSubject === item.value && (
                      <Feather name="check" size={16} color={colors.brandColor} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Note input */}
            <Text style={[styles.label, { marginTop: responsiveHeight(2.5) }]}>
              Your Message
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe your issue or question in detail…"
              placeholderTextColor={colors.gray}
              multiline
              numberOfLines={6}
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
              editable={!sending}
            />

            {/* Character count hint */}
            <Text style={styles.charCount}>{note.length} / 500</Text>

            {/* Info strip */}
            <View style={styles.infoStrip}>
              <Feather name="clock" size={14} color={colors.brandColor} />
              <Text style={styles.infoText}>
                We typically respond within 24 hours on business days.
              </Text>
            </View>

            {/* Send button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={handleSend}
                activeOpacity={0.85}
                disabled={sending}
              >
                <LinearGradient
                  colors={sending
                    ? ["#CCC", "#BBB"]
                    : [colors.brandColor, colors.primary ?? "#FF6A00"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendGradient}
                >
                  <Feather
                    name={sending ? "loader" : "send"}
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.sendButtonText}>
                    {sending ? "Sending…" : "Send Message"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Quick contact chips ── */}
          <Text style={styles.orText}>Or reach us directly</Text>
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Feather name="mail" size={16} color={colors.brandColor} />
              <Text style={styles.chipText}>joward2001@vervoerapp.com</Text>
            </View>
            <View style={styles.chip}>
              <Feather name="phone" size={16} color={colors.brandColor} />
              <Text style={styles.chipText}>+91 98765 43210</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  scroll: {
    paddingBottom: responsiveHeight(5),
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(1.5),
    gap: responsiveWidth(3),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: "#111",
    fontWeight: "700",
  },

  // ── Hero ──
  heroBanner: {
    marginHorizontal: responsiveWidth(5),
    borderRadius: 20,
    padding: responsiveWidth(6),
    marginBottom: responsiveHeight(2.5),
    alignItems: "center",
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: responsiveHeight(1.5),
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  heroTitle: {
    fontSize: responsiveFontSize(2.6),
    fontWeight: "800",
    color: "#FFF",
    marginBottom: responsiveHeight(0.8),
  },
  heroSub: {
    fontSize: responsiveFontSize(1.7),
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: responsiveFontSize(2.8),
  },

  // ── Card ──
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginHorizontal: responsiveWidth(5),
    padding: responsiveWidth(5),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: responsiveHeight(2),
  },
  label: {
    fontSize: responsiveFontSize(1.7),
    fontWeight: "700",
    color: "#555",
    marginBottom: responsiveHeight(0.8),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Custom picker ──
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: responsiveHeight(1.6),
    paddingHorizontal: responsiveWidth(4),
    backgroundColor: "#FAFAFA",
  },
  pickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2.5),
  },
  pickerText: {
    fontSize: responsiveFontSize(1.9),
    color: "#111",
    fontWeight: "500",
  },
  pickerPlaceholder: {
    color: "#9CA3AF",
    fontWeight: "400",
  },

  // ── Dropdown ──
  dropdown: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginTop: responsiveHeight(0.8),
    backgroundColor: "#FFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: responsiveHeight(1.4),
    paddingHorizontal: responsiveWidth(4),
    gap: responsiveWidth(3),
  },
  dropdownDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dropdownItemActive: {
    backgroundColor: colors.brandColor + "0D",
  },
  dropdownIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.brandColor + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownIconWrapActive: {
    backgroundColor: colors.brandColor,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: responsiveFontSize(1.85),
    color: "#374151",
    fontWeight: "400",
  },
  dropdownLabelActive: {
    color: colors.brandColor,
    fontWeight: "600",
  },

  // ── Text area ──
  textArea: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: responsiveWidth(4),
    fontSize: responsiveFontSize(1.9),
    color: "#111",
    backgroundColor: "#FAFAFA",
    minHeight: responsiveHeight(18),
    lineHeight: responsiveFontSize(3),
  },
  charCount: {
    fontSize: responsiveFontSize(1.5),
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: responsiveHeight(0.5),
    marginBottom: responsiveHeight(2),
  },

  // ── Info strip ──
  infoStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
    backgroundColor: colors.brandColor + "0D",
    borderRadius: 10,
    padding: responsiveWidth(3.5),
    marginBottom: responsiveHeight(2.5),
  },
  infoText: {
    flex: 1,
    fontSize: responsiveFontSize(1.6),
    color: "#555",
    lineHeight: responsiveFontSize(2.6),
  },

  // ── Send button ──
  sendButton: {
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  sendButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  sendGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(8),
  },
  sendButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Direct contact ──
  orText: {
    fontSize: responsiveFontSize(1.6),
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: responsiveHeight(1.5),
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: responsiveWidth(3),
    flexWrap: "wrap",
    paddingHorizontal: responsiveWidth(5),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
    backgroundColor: "#FFF",
    paddingVertical: responsiveHeight(1.2),
    paddingHorizontal: responsiveWidth(4),
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  chipText: {
    fontSize: responsiveFontSize(1.6),
    color: "#374151",
    fontWeight: "500",
  },
});

export default Contact;