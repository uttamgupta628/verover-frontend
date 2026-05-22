import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAppSelector } from "../../components/redux/hooks";
import colors from "../../assets/color";

// ── Types ──────────────────────────────────────────────────────────────────

interface SubAccount {
  _id: string;
  email: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

// ── Replace with your actual API base URL / helper ─────────────────────────
const API_BASE = "https://vervoer-backend2.onrender.com/api";

// ── Main Screen ───────────────────────────────────────────────────────────

const SubAccountsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAppSelector((state) => state.auth); // adjust to your auth slice

  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add-form state
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Animation for the add form
  const formHeight = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSubAccounts = useCallback(async () => {
  try {
    setLoading(true);
    console.log("Token being sent:", token);                          // ADD THIS
    console.log("Fetching URL:", `${API_BASE}/merchants/sub-accounts`); // ADD THIS
    const res = await fetch(`${API_BASE}/merchants/sub-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("Response status:", res.status);                      // ADD THIS
    const text = await res.text();                                    // CHANGE THIS
    console.log("Raw response:", text);                               // ADD THIS
    const data = JSON.parse(text);                                    // CHANGE THIS
    if (data.success) setSubAccounts(data.data ?? []);
    else throw new Error(data.message);
  } catch (err: any) {
    Alert.alert("Error", err.message || "Failed to fetch sub-accounts");
  } finally {
    setLoading(false);
  }
}, [token]);

  useEffect(() => {
    fetchSubAccounts();
  }, [fetchSubAccounts]);

  // ── Form animation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (showForm) {
      Animated.parallel([
        Animated.spring(formHeight, { toValue: 1, useNativeDriver: false, tension: 60, friction: 10 }),
        Animated.timing(formOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(formHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(formOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
      ]).start();
    }
  }, [showForm]);

  // ── Add sub-account ───────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      Alert.alert("Validation", "Email and password are required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      Alert.alert("Validation", "Please enter a valid email address.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }

    try {
      setAddLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await fetch(`${API_BASE}/merchants/sub-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          label: newLabel.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubAccounts(data.data);
        setNewEmail("");
        setNewPassword("");
        setNewLabel("");
        setShowForm(false);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add sub-account");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      setActionLoading(id);
      await Haptics.selectionAsync();
      const res = await fetch(`${API_BASE}/merchants/sub-accounts/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subAccountId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setSubAccounts((prev) =>
          prev.map((sa) =>
            sa._id === id ? { ...sa, isActive: !currentStatus } : sa
          )
        );
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update sub-account");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove ────────────────────────────────────────────
  const handleRemove = (id: string, email: string) => {
    Alert.alert(
      "Remove Sub-Account",
      `Remove login access for ${email}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(id);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const res = await fetch(`${API_BASE}/merchants/sub-accounts`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ subAccountId: id }),
              });
              const data = await res.json();
              if (data.success) {
                setSubAccounts((prev) => prev.filter((sa) => sa._id !== id));
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                throw new Error(data.message);
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove sub-account");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const getInitials = (email: string, label: string) => {
    if (label) return label.charAt(0).toUpperCase();
    return email.charAt(0).toUpperCase();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Sub-Accounts</Text>
          <Text style={styles.headerSubtitle}>
            {subAccounts.length} of 10 used
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setShowForm((v) => !v);
          }}
          style={styles.addButton}
          activeOpacity={0.8}
        >
          <Feather name={showForm ? "x" : "plus"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Add Form ── */}
        <Animated.View
          style={[
            styles.formCard,
            {
              opacity: formOpacity,
              maxHeight: formHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 380],
              }),
              marginBottom: showForm ? 16 : 0,
            },
          ]}
          pointerEvents={showForm ? "auto" : "none"}
        >
          <Text style={styles.formTitle}>Add new login</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Label (optional)</Text>
            <View style={styles.inputWrapper}>
              <Feather name="tag" size={16} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Manager, Cashier"
                placeholderTextColor="#C4C4C4"
                value={newLabel}
                onChangeText={setNewLabel}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email address</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={16} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="login@example.com"
                placeholderTextColor="#C4C4C4"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={16} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min. 6 characters"
                placeholderTextColor="#C4C4C4"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, addLoading && styles.submitButtonDisabled]}
            onPress={handleAdd}
            disabled={addLoading}
            activeOpacity={0.8}
          >
            {addLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="user-plus" size={16} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Add Sub-Account</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={styles.infoText}>
            Sub-accounts can log in independently using their own email and
            password. You control their access.
          </Text>
        </View>

        {/* ── List ── */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderText}>Loading sub-accounts…</Text>
          </View>
        ) : subAccounts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Feather name="users" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No sub-accounts yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button above to add a new login for your team.
            </Text>
          </View>
        ) : (
          subAccounts.map((sa, index) => (
            <View key={sa._id} style={styles.accountCard}>
              {/* Avatar + info */}
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.avatar,
                    !sa.isActive && styles.avatarInactive,
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {getInitials(sa.email, sa.label)}
                  </Text>
                </View>
                <View style={styles.accountInfo}>
                  {!!sa.label && (
                    <Text style={styles.accountLabel}>{sa.label}</Text>
                  )}
                  <Text
                    style={[
                      styles.accountEmail,
                      !sa.isActive && styles.textMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {sa.email}
                  </Text>
                  <View style={styles.accountMeta}>
                    <View
                      style={[
                        styles.statusBadge,
                        sa.isActive ? styles.statusActive : styles.statusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          sa.isActive
                            ? styles.statusTextActive
                            : styles.statusTextInactive,
                        ]}
                      >
                        {sa.isActive ? "Active" : "Inactive"}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      Added {formatDate(sa.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.cardActions}>
                {actionLoading === sa._id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Switch
                      value={sa.isActive}
                      onValueChange={() => handleToggle(sa._id, sa.isActive)}
                      trackColor={{ false: "#E5E7EB", true: `${colors.primary}55` }}
                      thumbColor={sa.isActive ? colors.primary : "#9CA3AF"}
                      ios_backgroundColor="#E5E7EB"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemove(sa._id, sa.email)}
                      style={styles.deleteButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  // ── Header ──
  header: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // ── Form ──
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Info banner ──
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: `${colors.primary}12`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },

  // ── Loader ──
  loaderContainer: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: "#9CA3AF",
  },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}15`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Account card ──
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInactive: { backgroundColor: "#D1D5DB" },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  accountInfo: { flex: 1 },
  accountLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 1,
  },
  accountEmail: {
    fontSize: 13,
    color: "#374151",
  },
  textMuted: { color: "#9CA3AF" },
  accountMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusActive: { backgroundColor: "#DCFCE7" },
  statusInactive: { backgroundColor: "#F3F4F6" },
  statusText: { fontSize: 11, fontWeight: "600" },
  statusTextActive: { color: "#16A34A" },
  statusTextInactive: { color: "#6B7280" },
  dateText: { fontSize: 11, color: "#9CA3AF" },

  // ── Actions ──
  cardActions: {
    alignItems: "center",
    gap: 10,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SubAccountsScreen;