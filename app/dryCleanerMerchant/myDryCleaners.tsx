import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  Dimensions,
  Platform,
} from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { RootState } from "../../components/redux/store";
import { Picker } from "@react-native-picker/picker";
import { Image } from "expo-image";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmallScreen = SCREEN_WIDTH < 380;
const isTablet = SCREEN_WIDTH >= 768;

const COLORS = {
  primary: "#FF9933",
  secondary: "#FFB366",
  background: "#FFFFFF",
  card: "#FFFFFF",
  text: "#333333",
  textLight: "#666666",
  textMuted: "#999999",
  border: "#FFE5C8",
  borderLight: "#F5F5F5",
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FFC107",
  white: "#FFFFFF",
  black: "#000000",
  primaryLight: "#FFF3E6",
  primaryFade: "#FF993315",
};

const API_BASE_URL = "https://vervoer-backend2.onrender.com/api/users";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdditionalService {
  name: "zipper" | "button" | "wash/fold";
  price: number;
}

interface ServiceItem {
  name: string;
  category: string;
  starchLevel: "low" | "medium" | "high";
  washOnly: boolean;
  // NOW AN ARRAY
  additionalservice?: AdditionalService[];
  price: number;
  _id: string;
}

interface DryCleaner {
  _id: string;
  shopname: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  rating: number;
  about: string;
  contactPerson: string;
  phoneNumber: string;
  contactPersonImg: string;
  shopimage: string[];
  hoursOfOperation: Array<{
    day: string;
    open: string;
    close: string;
    _id: string;
  }>;
  services: ServiceItem[];
  owner: string;
  ownerId?: string;
}

const isOwner = (c: DryCleaner, uid: string) =>
  (c.ownerId || c.owner) === uid;

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_CATEGORIES = [
  "Shirts",
  "Pants",
  "Suits",
  "Dresses",
  "Coats",
  "Blankets",
  "Comforters",
  "Curtains",
  "Other",
];

const ADDITIONAL_OPTIONS = ["zipper", "button", "wash/fold"] as const;

// ─── Reusable UI ──────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({
  title,
  right,
}) => (
  <View style={u.sectionTitleRow}>
    <Text style={u.sectionTitle}>{title}</Text>
    {right}
  </View>
);

const FieldGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <View style={u.fieldGroup}>
    <Text style={u.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const PrimaryBtn: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: any;
}> = ({ label, onPress, loading, disabled, style }) => (
  <TouchableOpacity
    style={[u.primaryBtn, (loading || disabled) && u.btnDisabled, style]}
    onPress={onPress}
    disabled={loading || disabled}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator size="small" color={COLORS.white} />
    ) : (
      <Text style={u.primaryBtnText}>{label}</Text>
    )}
  </TouchableOpacity>
);

const DangerBtn: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: string;
}> = ({ label, onPress, loading, icon }) => (
  <TouchableOpacity
    style={u.dangerBtn}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator size="small" color={COLORS.white} />
    ) : (
      <>
        <MaterialCommunityIcons
          name={(icon || "delete-outline") as any}
          size={18}
          color={COLORS.white}
        />
        <Text style={u.dangerBtnText}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

const ModalShell: React.FC<{
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  loading?: boolean;
  children: React.ReactNode;
}> = ({ visible, title, onClose, onSave, saveLabel = "Save", loading, children }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <SafeAreaView style={u.modalShell}>
      <View style={u.modalHeader}>
        <TouchableOpacity onPress={onClose} style={u.modalHeaderBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={u.modalHeaderTitle}>{title}</Text>
        <TouchableOpacity
          onPress={onSave}
          disabled={loading}
          style={u.modalHeaderBtn}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={u.modalSaveText}>{saveLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

// ─── ServiceForm ──────────────────────────────────────────────────────────────
// additionalservice is now AdditionalService[] — multi-select chips

const ServiceForm: React.FC<{
  formData: any;
  setFormData: (d: any) => void;
}> = ({ formData, setFormData }) => {
  // Always treat as array
  const selectedAdditionals: AdditionalService[] =
    Array.isArray(formData.additionalservice) ? formData.additionalservice : [];

  const isSelected = (opt: string) =>
    selectedAdditionals.some((s) => s.name === opt);

  const toggleOption = (opt: typeof ADDITIONAL_OPTIONS[number]) => {
    if (isSelected(opt)) {
      // Remove
      setFormData({
        ...formData,
        additionalservice: selectedAdditionals.filter((s) => s.name !== opt),
      });
    } else {
      // Add with price 0
      setFormData({
        ...formData,
        additionalservice: [...selectedAdditionals, { name: opt, price: 0 }],
      });
    }
  };

  const updatePrice = (opt: string, priceStr: string) => {
    setFormData({
      ...formData,
      additionalservice: selectedAdditionals.map((s) =>
        s.name === opt ? { ...s, price: parseFloat(priceStr) || 0 } : s
      ),
    });
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Service Name */}
      <FieldGroup label="Service Name *">
        <TextInput
          style={u.input}
          value={formData.name}
          onChangeText={(t) => setFormData({ ...formData, name: t })}
          placeholder="e.g. Shirt Wash, Suit Dry Clean"
          placeholderTextColor={COLORS.textMuted}
        />
      </FieldGroup>

      {/* Category */}
      <FieldGroup label="Category *">
        <View style={u.chipRow}>
          {SERVICE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[u.chip, formData.category === cat && u.chipActive]}
              onPress={() => setFormData({ ...formData, category: cat })}
            >
              <Text
                style={[u.chipText, formData.category === cat && u.chipTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </FieldGroup>

      {/* Price + Starch */}
      <View style={u.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <FieldGroup label="Price ($) *">
            <TextInput
              style={u.input}
              value={String(formData.price === 0 ? "" : formData.price)}
              onChangeText={(t) => setFormData({ ...formData, price: t })}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
            />
          </FieldGroup>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <FieldGroup label="Starch Level">
            <View style={[u.input, { padding: 0, overflow: "hidden" }]}>
              <Picker
                selectedValue={formData.starchLevel}
                onValueChange={(value) =>
                  setFormData({ ...formData, starchLevel: value })
                }
                style={{ height: 48, color: COLORS.text }}
              >
                <Picker.Item label="Low" value="low" />
                <Picker.Item label="Medium" value="medium" />
                <Picker.Item label="High" value="high" />
              </Picker>
            </View>
          </FieldGroup>
        </View>
      </View>

      {/* Additional Services — multi-select */}
      <FieldGroup label="Additional Services (select all that apply)">
        <View style={u.chipRow}>
          {ADDITIONAL_OPTIONS.map((opt) => {
            const selected = isSelected(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[u.chip, selected && u.chipActive]}
                onPress={() => toggleOption(opt)}
              >
                <Text style={[u.chipText, selected && u.chipTextActive]}>
                  {selected ? `✓ ${opt}` : opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Price input per selected option */}
        {selectedAdditionals.map((additional) => (
          <View key={additional.name} style={u.additionalPriceRow}>
            <View style={u.additionalPriceLabel}>
              <MaterialCommunityIcons
                name="plus-circle-outline"
                size={14}
                color={COLORS.primary}
              />
              <Text style={u.additionalPriceLabelText}>
                Charge for "{additional.name}" ($)
              </Text>
            </View>
            <TextInput
              style={u.input}
              value={additional.price === 0 ? "" : String(additional.price)}
              onChangeText={(t) => updatePrice(additional.name, t)}
              keyboardType="decimal-pad"
              placeholder="e.g. 1.50"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        ))}
      </FieldGroup>

      {/* Wash Only */}
      <View style={u.toggleRow}>
        <View>
          <Text style={u.fieldLabel}>Wash Only</Text>
          <Text style={u.toggleSub}>No dry cleaning, just washing</Text>
        </View>
        <Switch
          value={formData.washOnly}
          onValueChange={(v) => setFormData({ ...formData, washOnly: v })}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor={COLORS.white}
          ios_backgroundColor={COLORS.border}
        />
      </View>
    </View>
  );
};

// ─── AddServiceModal ──────────────────────────────────────────────────────────

const AddServiceModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (d: any) => void;
  loading: boolean;
}> = ({ visible, onClose, onSave, loading }) => {
  const empty = {
    name: "",
    category: "Other",
    starchLevel: "medium",
    washOnly: false,
    additionalservice: [] as AdditionalService[],
    price: "",
  };
  const [formData, setFormData] = useState(empty);

  useEffect(() => {
    if (visible) setFormData(empty);
  }, [visible]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      Alert.alert("Required", "Service name is required");
      return;
    }
    if (!formData.category) {
      Alert.alert("Required", "Please select a category");
      return;
    }
    const price = parseFloat(String(formData.price));
    if (!price || price <= 0) {
      Alert.alert("Required", "Enter a valid price");
      return;
    }

    // Validate each selected additional service has a non-negative price
    const additionals = formData.additionalservice as AdditionalService[];
    for (const add of additionals) {
      if (add.price < 0) {
        Alert.alert("Required", `Enter a valid price for "${add.name}"`);
        return;
      }
    }

    onSave({
      name: formData.name.trim(),
      category: formData.category,
      starchLevel: formData.starchLevel || "medium",
      washOnly: Boolean(formData.washOnly),
      // Send array (or omit if empty)
      additionalservice: additionals.length > 0 ? additionals : undefined,
      price,
    });
  };

  return (
    <ModalShell
      visible={visible}
      title="Add New Service"
      onClose={onClose}
      onSave={handleSave}
      saveLabel="Add"
      loading={loading}
    >
      <View style={{ marginTop: 6 }}>
        <View style={u.infoBanner}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={COLORS.primary}
          />
          <Text style={u.infoBannerText}>
            Fill in the details for the new service
          </Text>
        </View>
        <ServiceForm formData={formData} setFormData={setFormData} />
      </View>
    </ModalShell>
  );
};

// ─── ServiceEditModal ─────────────────────────────────────────────────────────

const ServiceEditModal: React.FC<{
  visible: boolean;
  service: ServiceItem | null;
  onClose: () => void;
  onSave: (d: any) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}> = ({ visible, service, onClose, onSave, onDelete, loading }) => {
  const [formData, setFormData] = useState<any>({
    name: "",
    category: "Other",
    starchLevel: "medium",
    washOnly: false,
    additionalservice: [] as AdditionalService[],
    price: "",
  });

  useEffect(() => {
    if (service) {
      // Normalize additionalservice to always be an array
      let additionals: AdditionalService[] = [];
      if (Array.isArray(service.additionalservice)) {
        additionals = service.additionalservice;
      } else if (
        service.additionalservice &&
        typeof service.additionalservice === "object"
      ) {
        // Legacy single-object from old data — wrap it
        additionals = [service.additionalservice as unknown as AdditionalService];
      } else if (
        service.additionalservice &&
        typeof service.additionalservice === "string"
      ) {
        // Very old string format
        additionals = [
          { name: service.additionalservice as any, price: 0 },
        ];
      }

      setFormData({
        name: service.name || "",
        category: service.category || "Other",
        starchLevel: service.starchLevel || "medium",
        washOnly: service.washOnly || false,
        additionalservice: additionals,
        price: String(service.price || ""),
      });
    }
  }, [service]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      Alert.alert("Required", "Service name is required");
      return;
    }
    if (!formData.category) {
      Alert.alert("Required", "Please select a category");
      return;
    }
    const price = parseFloat(String(formData.price));
    if (!price || price <= 0) {
      Alert.alert("Required", "Enter a valid price");
      return;
    }

    const additionals = formData.additionalservice as AdditionalService[];
    for (const add of additionals) {
      if (add.price < 0) {
        Alert.alert("Required", `Enter a valid price for "${add.name}"`);
        return;
      }
    }

    onSave({
      serviceId: service!._id,
      name: formData.name.trim(),
      category: formData.category,
      starchLevel: formData.starchLevel || "medium",
      washOnly: Boolean(formData.washOnly),
      // Always send the array (empty array = clear all)
      additionalservice: additionals,
      price,
    });
  };

  const handleDelete = () => {
    Alert.alert("Delete Service", `Delete "${service?.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(service!._id),
      },
    ]);
  };

  if (!service) return null;

  return (
    <ModalShell
      visible={visible}
      title="Edit Service"
      onClose={onClose}
      onSave={handleSave}
      loading={loading}
    >
      <ServiceForm formData={formData} setFormData={setFormData} />
      <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
        <DangerBtn
          label="Delete This Service"
          onPress={handleDelete}
          loading={loading}
        />
      </View>
    </ModalShell>
  );
};

// ─── HoursEditModal ───────────────────────────────────────────────────────────

const HoursEditModal: React.FC<{
  visible: boolean;
  hours: any[];
  onClose: () => void;
  onSave: (d: any[]) => void;
  loading: boolean;
}> = ({ visible, hours, onClose, onSave, loading }) => {
  const days = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
  ];
  const [hoursData, setHoursData] = useState<any[]>([]);

  useEffect(() => {
    setHoursData(
      hours?.length > 0
        ? hours
        : days.map((day) => ({ day, open: "09:00 AM", close: "07:00 PM" }))
    );
  }, [hours, visible]);

  const update = (i: number, field: string, val: string) => {
    const next = [...hoursData];
    next[i] = { ...next[i], [field]: val };
    setHoursData(next);
  };

  return (
    <ModalShell
      visible={visible}
      title="Operating Hours"
      onClose={onClose}
      onSave={() => onSave(hoursData)}
      loading={loading}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        {hoursData.map((hour, i) => (
          <View key={i} style={u.hourRow}>
            <Text style={u.hourDay}>{hour.day.slice(0, 3)}</Text>
            <TextInput
              style={u.hourInput}
              value={hour.open}
              onChangeText={(t) => update(i, "open", t)}
              placeholder="09:00 AM"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={u.hourSep}>–</Text>
            <TextInput
              style={u.hourInput}
              value={hour.close}
              onChangeText={(t) => update(i, "close", t)}
              placeholder="07:00 PM"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        ))}
      </View>
    </ModalShell>
  );
};

// ─── ProfileEditModal ─────────────────────────────────────────────────────────

const ProfileEditModal: React.FC<{
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (d: any) => void;
  loading: boolean;
}> = ({ visible, cleaner, onClose, onSave, loading }) => {
  const [form, setForm] = useState({
    contactPerson: "",
    phoneNumber: "",
    contactPersonImg: "",
  });
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [imgData, setImgData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const authToken = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (cleaner) {
      setForm({
        contactPerson: cleaner.contactPerson || "",
        phoneNumber: cleaner.phoneNumber || "",
        contactPersonImg: cleaner.contactPersonImg || "",
      });
      setImgUri(null);
      setImgData(null);
    }
  }, [cleaner]);

  const pickImage = () =>
    Alert.alert("Photo", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!r.canceled) {
            setImgUri(r.assets[0].uri);
            setImgData(r.assets[0]);
          }
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!r.canceled) {
            setImgUri(r.assets[0].uri);
            setImgData(r.assets[0]);
          }
        },
      },
      {
        text: "Remove",
        onPress: () => {
          setImgUri(null);
          setImgData(null);
          setForm((f) => ({ ...f, contactPersonImg: "" }));
        },
        style: "destructive",
      },
      { text: "Cancel", style: "cancel" },
    ]);

  const handleSave = async () => {
    if (!form.contactPerson.trim()) {
      Alert.alert("Required", "Contact person name is required");
      return;
    }
    if (!form.phoneNumber.trim()) {
      Alert.alert("Required", "Phone number is required");
      return;
    }
    if (!cleaner || !authToken) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("contactPerson", form.contactPerson);
      fd.append("phoneNumber", form.phoneNumber);
      if (imgData) {
        const ext = imgData.uri.split(".").pop() || "jpg";
        fd.append("contactPersonImg", {
          uri: imgData.uri,
          type: `image/${ext}`,
          name: `cp-${Date.now()}.${ext}`,
        } as any);
      }
      const res = await axios.put(
        `${API_BASE_URL}/edit-profile-drycleaner/${cleaner._id}`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        }
      );
      if (res.data.success) {
        onSave({
          contactPerson: form.contactPerson,
          phoneNumber: form.phoneNumber,
          contactPersonImg:
            res.data.data?.dryCleaner?.contactPersonImg || form.contactPersonImg,
        });
        onClose();
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to update");
    } finally {
      setUploading(false);
    }
  };

  if (!cleaner) return null;
  const displayImg = imgUri || form.contactPersonImg;

  return (
    <ModalShell
      visible={visible}
      title="Edit Contact Info"
      onClose={onClose}
      onSave={handleSave}
      loading={loading || uploading}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <View style={u.avatarWrap}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
            <View style={u.avatarCircle}>
              {displayImg ? (
                <Image
                  source={{ uri: displayImg }}
                  style={u.avatarImg}
                  contentFit="cover"
                />
              ) : (
                <MaterialCommunityIcons
                  name="account-plus"
                  size={44}
                  color={COLORS.primary}
                />
              )}
              {uploading && (
                <View style={u.avatarOverlay}>
                  <ActivityIndicator color={COLORS.white} />
                </View>
              )}
              <View style={u.avatarCameraBtn}>
                <MaterialCommunityIcons name="camera" size={14} color={COLORS.white} />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={u.avatarHint}>Tap to change photo</Text>
          {imgUri && <Text style={u.avatarSelected}>✓ New photo selected</Text>}
        </View>
        <FieldGroup label="Contact Person *">
          <TextInput
            style={u.input}
            value={form.contactPerson}
            onChangeText={(t) => setForm({ ...form, contactPerson: t })}
            placeholder="Full name"
            placeholderTextColor={COLORS.textMuted}
          />
        </FieldGroup>
        <FieldGroup label="Phone Number *">
          <TextInput
            style={u.input}
            value={form.phoneNumber}
            onChangeText={(t) => setForm({ ...form, phoneNumber: t })}
            placeholder="+1 234 567 8900"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
          />
        </FieldGroup>
      </View>
    </ModalShell>
  );
};

// ─── AddressEditModal ─────────────────────────────────────────────────────────

const AddressEditModal: React.FC<{
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (d: any) => void;
  loading: boolean;
}> = ({ visible, cleaner, onClose, onSave, loading }) => {
  const [form, setForm] = useState({
    shopname: "",
    about: "",
    address: { street: "", city: "", state: "", zipCode: "", country: "" },
  });

  useEffect(() => {
    if (cleaner)
      setForm({
        shopname: cleaner.shopname || "",
        about: cleaner.about || "",
        address: {
          street: cleaner.address?.street || "",
          city: cleaner.address?.city || "",
          state: cleaner.address?.state || "",
          zipCode: cleaner.address?.zipCode || "",
          country: cleaner.address?.country || "",
        },
      });
  }, [cleaner]);

  if (!cleaner) return null;

  return (
    <ModalShell
      visible={visible}
      title="Edit Shop Details"
      onClose={onClose}
      onSave={() => {
        if (!form.shopname.trim()) {
          Alert.alert("Required", "Shop name is required");
          return;
        }
        onSave(form);
      }}
      loading={loading}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <FieldGroup label="Shop Name *">
          <TextInput
            style={u.input}
            value={form.shopname}
            onChangeText={(t) => setForm({ ...form, shopname: t })}
            placeholder="Enter shop name"
            placeholderTextColor={COLORS.textMuted}
          />
        </FieldGroup>
        <FieldGroup label="About">
          <TextInput
            style={[u.input, { height: 90, textAlignVertical: "top", paddingTop: 12 }]}
            value={form.about}
            onChangeText={(t) => setForm({ ...form, about: t })}
            placeholder="Describe your shop"
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
        </FieldGroup>
        <Text style={u.groupHeader}>Address</Text>
        {(["street", "city", "state", "zipCode", "country"] as const).map((f) => (
          <FieldGroup key={f} label={f.charAt(0).toUpperCase() + f.slice(1)}>
            <TextInput
              style={u.input}
              value={form.address[f]}
              onChangeText={(t) =>
                setForm({ ...form, address: { ...form.address, [f]: t } })
              }
              placeholder={`Enter ${f}`}
              placeholderTextColor={COLORS.textMuted}
              keyboardType={f === "zipCode" ? "numeric" : "default"}
            />
          </FieldGroup>
        ))}
      </View>
    </ModalShell>
  );
};

// ─── ShopImageEditModal ───────────────────────────────────────────────────────

const ShopImageEditModal: React.FC<{
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (d: any) => void;
  loading: boolean;
}> = ({ visible, cleaner, onClose, onSave, loading }) => {
  const [shopImages, setShopImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<any[]>([]);
  const [deletedImages, setDeletedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const authToken = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (cleaner) {
      setShopImages(cleaner.shopimage || []);
      setNewImages([]);
      setDeletedImages([]);
    }
  }, [cleaner, visible]);

  const current = shopImages.filter((i) => !deletedImages.includes(i));
  const total = current.length + newImages.length;

  const pickImages = () => {
    if (total >= 5) {
      Alert.alert("Limit", "Maximum 5 shop images allowed.");
      return;
    }
    Alert.alert("Add Image", "Source?", [
      {
        text: "Camera",
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!r.canceled) setNewImages((p) => [...p, r.assets[0]]);
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: true,
            selectionLimit: 5 - total,
            quality: 0.8,
          });
          if (!r.canceled) setNewImages((p) => [...p, ...r.assets]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!cleaner || !authToken) return;
    try {
      setUploading(true);
      for (const url of deletedImages) {
        try {
          await axios.delete(
            `${API_BASE_URL}/delete-drycleaner-shop-image/${cleaner._id}`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
              data: { imageUrl: url },
              timeout: 30000,
            }
          );
        } catch {}
      }
      if (newImages.length > 0) {
        const fd = new FormData();
        newImages.forEach((img, i) => {
          const ext = img.uri.split(".").pop() || "jpg";
          fd.append("shopimage", {
            uri: img.uri,
            type: `image/${ext}`,
            name: `shop-${Date.now()}-${i}.${ext}`,
          } as any);
        });
        const res = await axios.put(
          `${API_BASE_URL}/update-drycleaner-shop-images/${cleaner._id}`,
          fd,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "multipart/form-data",
            },
            timeout: 60000,
          }
        );
        if (res.data.success)
          onSave({ shopimage: res.data.data?.dryCleaner?.shopimage || [] });
      } else if (deletedImages.length > 0) {
        onSave({ shopimage: current });
      } else {
        Alert.alert("No changes", "No images were changed.");
      }
      onClose();
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to update images");
    } finally {
      setUploading(false);
    }
  };

  if (!cleaner) return null;

  return (
    <ModalShell
      visible={visible}
      title="Shop Images"
      onClose={onClose}
      onSave={handleSave}
      loading={loading || uploading}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={u.imageCountPill}>
          <MaterialCommunityIcons name="image-multiple" size={16} color={COLORS.primary} />
          <Text style={u.imageCountText}>{total}/5 images</Text>
          {(deletedImages.length > 0 || newImages.length > 0) && (
            <Text style={u.imageChangesText}>
              {deletedImages.length > 0 ? `  −${deletedImages.length}` : ""}
              {newImages.length > 0 ? `  +${newImages.length}` : ""}
            </Text>
          )}
        </View>

        {shopImages.length > 0 && (
          <>
            <Text style={u.imgSectionLabel}>Current Images</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {shopImages.map((url, i) => {
                const del = deletedImages.includes(url);
                return (
                  <View key={i} style={u.imgThumb}>
                    <Image
                      source={{ uri: url }}
                      style={[u.imgThumbImg, del && { opacity: 0.35 }]}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      style={[
                        u.imgThumbBtn,
                        { backgroundColor: del ? COLORS.success : COLORS.error },
                      ]}
                      onPress={() =>
                        del
                          ? setDeletedImages((p) => p.filter((x) => x !== url))
                          : Alert.alert("Remove?", "Mark this image for deletion?", [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => setDeletedImages((p) => [...p, url]),
                              },
                            ])
                      }
                    >
                      <MaterialCommunityIcons
                        name={del ? "restore" : "close"}
                        size={14}
                        color={COLORS.white}
                      />
                    </TouchableOpacity>
                    <View
                      style={[
                        u.imgThumbLabel,
                        del && { backgroundColor: "rgba(244,67,54,0.85)" },
                      ]}
                    >
                      <Text style={u.imgThumbLabelText}>
                        {del ? "Will remove" : "Current"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        {newImages.length > 0 && (
          <>
            <Text style={u.imgSectionLabel}>New Images</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {newImages.map((img, i) => (
                <View key={i} style={u.imgThumb}>
                  <Image
                    source={{ uri: img.uri }}
                    style={u.imgThumbImg}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={[u.imgThumbBtn, { backgroundColor: COLORS.error }]}
                    onPress={() =>
                      setNewImages((p) => p.filter((_, j) => j !== i))
                    }
                  >
                    <MaterialCommunityIcons name="close" size={14} color={COLORS.white} />
                  </TouchableOpacity>
                  <View
                    style={[
                      u.imgThumbLabel,
                      { backgroundColor: "rgba(76,175,80,0.85)" },
                    ]}
                  >
                    <Text style={u.imgThumbLabelText}>New</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {total < 5 ? (
          <TouchableOpacity style={u.addImgDashed} onPress={pickImages} activeOpacity={0.8}>
            <MaterialCommunityIcons name="camera-plus" size={36} color={COLORS.primary} />
            <Text style={u.addImgText}>Add Photos</Text>
            <Text style={u.addImgSub}>
              {5 - total} slot{5 - total !== 1 ? "s" : ""} remaining
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={u.addImgFull}>
            <MaterialCommunityIcons name="check-circle" size={36} color={COLORS.success} />
            <Text style={u.addImgFullText}>All 5 slots filled</Text>
          </View>
        )}
      </View>
    </ModalShell>
  );
};

// ─── CleanerDetailsModal ──────────────────────────────────────────────────────

const CleanerDetailsModal: React.FC<{
  cleaner: DryCleaner | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (c: DryCleaner) => void;
  onRefresh: () => void;
  currentUserId: string;
}> = ({ cleaner, visible, onClose, onEdit, onRefresh, currentUserId }) => {
  const [data, setData] = useState<DryCleaner | null>(null);
  const [loading, setLoading] = useState(false);
  const [modals, setModals] = useState({
    service: false,
    addService: false,
    hours: false,
    profile: false,
    address: false,
    images: false,
  });
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const authToken = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (cleaner) setData(cleaner);
  }, [cleaner]);

  const can = data ? isOwner(data, currentUserId) : false;
  const deny = () =>
    Alert.alert("Access Denied", "You can only edit your own dry cleaners.");
  const open = (key: keyof typeof modals) =>
    can ? setModals((m) => ({ ...m, [key]: true })) : deny();
  const close = (key: keyof typeof modals) =>
    setModals((m) => ({ ...m, [key]: false }));

  const saveService = async (serviceData: any) => {
    if (!data || !authToken) return;
    try {
      setLoading(true);
      const res = await axios.put(
        `${API_BASE_URL}/edit-service-drycleaner/${data._id}`,
        serviceData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data.success) {
        close("service");
        setData((d) =>
          d
            ? {
                ...d,
                services:
                  res.data.data?.dryCleaner?.services ||
                  d.services.map((s) =>
                    s._id === serviceData.serviceId ? { ...s, ...serviceData } : s
                  ),
              }
            : d
        );
        onRefresh();
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to update service");
    } finally {
      setLoading(false);
    }
  };

  const addService = async (serviceData: any) => {
    if (!data || !authToken) return;
    try {
      setLoading(true);
      console.log("📤 Sending service data:", JSON.stringify(serviceData, null, 2));
      const res = await axios.post(
        `${API_BASE_URL}/edit-service-drycleaner/${data._id}/add`,
        serviceData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.data.success) {
        close("addService");
        setData((d) =>
          d
            ? { ...d, services: res.data.data?.dryCleaner?.services || d.services }
            : d
        );
        Alert.alert("✓", "Service added");
        onRefresh();
      }
    } catch (e: any) {
      console.log("❌ Full error:", JSON.stringify(e.response?.data, null, 2));
      Alert.alert("Error", e.response?.data?.message || "Failed to add service");
    } finally {
      setLoading(false);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!data || !authToken) return;
    try {
      setLoading(true);
      const res = await axios.delete(
        `${API_BASE_URL}/edit-service-drycleaner/${data._id}/delete`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          data: { serviceId },
        }
      );
      if (res.data.success) {
        close("service");
        setData((d) =>
          d
            ? {
                ...d,
                services:
                  res.data.data?.dryCleaner?.services ||
                  d.services.filter((s) => s._id !== serviceId),
              }
            : d
        );
        Alert.alert("✓", "Service deleted");
        onRefresh();
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to delete service");
    } finally {
      setLoading(false);
    }
  };

  const saveHours = async (hoursData: any[]) => {
    if (!data || !authToken) return;
    try {
      setLoading(true);
      const res = await axios.put(
        `${API_BASE_URL}/edit-hours-drycleaner/${data._id}`,
        hoursData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data.success) {
        close("hours");
        setData((d) => (d ? { ...d, hoursOfOperation: hoursData } : d));
        onRefresh();
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAddress = async (addressData: any) => {
    if (!data || !authToken) return;
    try {
      setLoading(true);
      const res = await axios.put(
        `${API_BASE_URL}/edit-address-drycleaner/${data._id}`,
        addressData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data.success) {
        close("address");
        setData((d) => (d ? { ...d, ...addressData } : d));
        onRefresh();
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const saveImages = (imageData: any) => {
    setData((d) => (d ? { ...d, shopimage: imageData.shopimage } : d));
    close("images");
    onRefresh();
  };

  const deleteImage = (url: string) => {
    if (!can) { deny(); return; }
    Alert.alert("Delete Image", "Remove this image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(
              `${API_BASE_URL}/delete-drycleaner-shop-image/${data!._id}`,
              {
                headers: { Authorization: `Bearer ${authToken}` },
                data: { imageUrl: url },
              }
            );
            setData((d) =>
              d ? { ...d, shopimage: d.shopimage.filter((i) => i !== url) } : d
            );
            onRefresh();
          } catch {
            Alert.alert("Error", "Failed to delete image");
          }
        },
      },
    ]);
  };

  if (!data) return null;

  const serviceCardWidth = isSmallScreen
    ? "100%"
    : (SCREEN_WIDTH - 32 - 32 - 10) / 2;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <SafeAreaView style={[u.modalShell, { backgroundColor: COLORS.background }]}>
          <View style={u.detailModalHeader}>
            <TouchableOpacity onPress={onClose} style={u.modalHeaderBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={u.detailModalTitle} numberOfLines={1}>
              {data.shopname}
            </Text>
          </View>

          {!can && (
            <View style={u.ownerBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={u.ownerBannerText}>
                View only — this shop belongs to another merchant.
              </Text>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Shop Images */}
            <View style={u.card}>
              <SectionHeader
                title="Shop Images"
                right={
                  can ? (
                    <TouchableOpacity style={u.outlineBtn} onPress={() => open("images")}>
                      <MaterialCommunityIcons name="camera-plus" size={14} color={COLORS.primary} />
                      <Text style={u.outlineBtnText}>Manage</Text>
                    </TouchableOpacity>
                  ) : undefined
                }
              />
              {data.shopimage?.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {data.shopimage.map((url, i) => (
                    <TouchableOpacity
                      key={i}
                      style={u.shopImgWrap}
                      onPress={() => can && deleteImage(url)}
                      activeOpacity={can ? 0.75 : 1}
                    >
                      <Image
                        source={{ uri: url }}
                        style={[
                          u.shopImg,
                          { width: isSmallScreen ? 120 : 160, height: isSmallScreen ? 90 : 110 },
                        ]}
                        contentFit="cover"
                      />
                      {can && (
                        <View style={u.shopImgOverlay}>
                          <MaterialCommunityIcons name="delete" size={20} color={COLORS.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  {can && data.shopimage.length < 5 && (
                    <TouchableOpacity style={u.shopImgAdd} onPress={() => open("images")}>
                      <MaterialCommunityIcons name="camera-plus" size={24} color={COLORS.primary} />
                      <Text style={u.shopImgAddText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              ) : (
                <View style={u.emptyImages}>
                  <MaterialCommunityIcons name="image-off-outline" size={36} color={COLORS.textMuted} />
                  <Text style={u.emptyImagesText}>No images yet</Text>
                  {can && (
                    <TouchableOpacity style={u.outlineBtn} onPress={() => open("images")}>
                      <MaterialCommunityIcons name="camera-plus" size={14} color={COLORS.primary} />
                      <Text style={u.outlineBtnText}>Add Photos</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Contact */}
            <View style={u.card}>
              <SectionHeader
                title="Contact"
                right={
                  <TouchableOpacity style={u.iconBtn} onPress={() => open("profile")}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={can ? COLORS.primary : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                }
              />
              <View style={u.contactRow}>
                {data.contactPersonImg ? (
                  <Image
                    source={{ uri: data.contactPersonImg }}
                    style={u.contactAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={u.contactAvatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={28} color={COLORS.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={u.contactName}>{data.contactPerson}</Text>
                  <Text style={u.contactSub}>{data.phoneNumber}</Text>
                </View>
              </View>
              {data.address && (
                <View style={u.infoRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color={COLORS.primary} />
                  <Text style={u.infoRowText}>
                    {`${data.address.street}, ${data.address.city}, ${data.address.state} ${data.address.zipCode}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Hours */}
            <View style={u.card}>
              <SectionHeader
                title="Operating Hours"
                right={
                  <TouchableOpacity style={u.iconBtn} onPress={() => open("hours")}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={can ? COLORS.primary : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                }
              />
              <View style={{ marginTop: 8 }}>
                {data.hoursOfOperation.map((h, i) => (
                  <View key={i} style={u.hourDisplayRow}>
                    <Text style={u.hourDisplayDay}>{h.day.slice(0, 3)}</Text>
                    <Text style={u.hourDisplayTime}>
                      {h.open === "Closed" ? "Closed" : `${h.open} – ${h.close}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Services */}
            <View style={u.card}>
              <SectionHeader
                title="Services & Pricing"
                right={
                  can ? (
                    <TouchableOpacity style={u.primaryPill} onPress={() => open("addService")}>
                      <MaterialCommunityIcons name="plus" size={14} color={COLORS.white} />
                      <Text style={u.primaryPillText}>Add Service</Text>
                    </TouchableOpacity>
                  ) : undefined
                }
              />

              {data.services.length === 0 ? (
                <View style={u.emptyServices}>
                  <MaterialCommunityIcons name="washing-machine" size={40} color={COLORS.textMuted} />
                  <Text style={u.emptyServicesText}>No services yet</Text>
                  {can && (
                    <TouchableOpacity style={u.primaryPill} onPress={() => open("addService")}>
                      <MaterialCommunityIcons name="plus" size={14} color={COLORS.white} />
                      <Text style={u.primaryPillText}>Add First Service</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View
                  style={[u.servicesGrid, isSmallScreen && { flexDirection: "column" }]}
                >
                  {data.services.map((svc, i) => (
                    <View
                      key={i}
                      style={[u.serviceCard, { width: serviceCardWidth as any }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={u.serviceName} numberOfLines={1}>
                          {svc.name}
                        </Text>
                        <Text style={u.serviceCategory}>{svc.category}</Text>
                        <Text style={u.servicePrice}>${svc.price}</Text>

                        {/* ── Multiple additional service badges ── */}
                        {Array.isArray(svc.additionalservice) &&
                          svc.additionalservice.length > 0 && (
                            <View style={u.additionalBadgeRow}>
                              {svc.additionalservice.map((add, j) => (
                                <View key={j} style={u.additionalBadge}>
                                  <MaterialCommunityIcons
                                    name="plus-circle-outline"
                                    size={11}
                                    color={COLORS.primary}
                                  />
                                  <Text style={u.additionalBadgeText}>
                                    {add.name} ${add.price}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                      </View>

                      {can && (
                        <View style={u.serviceCardBtns}>
                          <TouchableOpacity
                            style={u.serviceEditBtn}
                            onPress={() => {
                              setSelectedService(svc);
                              setModals((m) => ({ ...m, service: true }));
                            }}
                          >
                            <MaterialCommunityIcons
                              name="pencil"
                              size={13}
                              color={COLORS.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={u.serviceDeleteBtn}
                            onPress={() =>
                              Alert.alert("Delete", `Delete "${svc.name}"?`, [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: () => deleteService(svc._id),
                                },
                              ])
                            }
                          >
                            <MaterialCommunityIcons
                              name="close"
                              size={13}
                              color={COLORS.white}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* About */}
            <View style={u.card}>
              <SectionHeader
                title="About"
                right={
                  <TouchableOpacity style={u.iconBtn} onPress={() => open("address")}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={can ? COLORS.primary : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                }
              />
              <Text style={u.aboutText}>
                {data.about || `${data.shopname} is a professional dry cleaning service.`}
              </Text>
            </View>

            {/* Metrics */}
            <View style={u.card}>
              <Text style={u.sectionTitle}>Business Metrics</Text>
              <View
                style={[u.metricsRow, isSmallScreen && { flexDirection: "column", gap: 12 }]}
              >
                {[
                  ["★", String(data.rating || "0.0"), "Rating"],
                  ["🧺", `${data.services.length}`, "Services"],
                  ["📷", `${data.shopimage?.length || 0}/5`, "Photos"],
                ].map(([icon, val, label]) => (
                  <View key={label} style={[u.metricBox, isSmallScreen && { width: "100%" }]}>
                    <Text style={u.metricIcon}>{icon}</Text>
                    <Text style={u.metricVal}>{val}</Text>
                    <Text style={u.metricLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {can && data && (
        <>
          <ServiceEditModal
            visible={modals.service}
            service={selectedService}
            onClose={() => close("service")}
            onSave={saveService}
            onDelete={deleteService}
            loading={loading}
          />
          <AddServiceModal
            visible={modals.addService}
            onClose={() => close("addService")}
            onSave={addService}
            loading={loading}
          />
          <HoursEditModal
            visible={modals.hours}
            hours={data.hoursOfOperation}
            onClose={() => close("hours")}
            onSave={saveHours}
            loading={loading}
          />
          <ProfileEditModal
            visible={modals.profile}
            cleaner={data}
            onClose={() => close("profile")}
            onSave={(d) => {
              setData((prev) => (prev ? { ...prev, ...d } : prev));
              onRefresh();
            }}
            loading={loading}
          />
          <AddressEditModal
            visible={modals.address}
            cleaner={data}
            onClose={() => close("address")}
            onSave={saveAddress}
            loading={loading}
          />
          <ShopImageEditModal
            visible={modals.images}
            cleaner={data}
            onClose={() => close("images")}
            onSave={saveImages}
            loading={loading}
          />
        </>
      )}
    </>
  );
};

// ─── CleanerCard ──────────────────────────────────────────────────────────────

const CleanerCard: React.FC<{
  cleaner: DryCleaner;
  currentUserId: string;
  onView: (c: DryCleaner) => void;
  onDelete: (c: DryCleaner) => void;
}> = ({ cleaner, currentUserId, onView, onDelete }) => {
  const can = isOwner(cleaner, currentUserId);
  const avatarSize = isSmallScreen ? 60 : 80;
  return (
    <TouchableOpacity style={u.cleanerCard} onPress={() => onView(cleaner)} activeOpacity={0.88}>
      <View style={[u.cleanerCardAvatar, { width: avatarSize, height: avatarSize }]}>
        {cleaner.contactPersonImg ? (
          <Image
            source={{ uri: cleaner.contactPersonImg }}
            style={{ width: "100%", height: "100%", borderRadius: 16 }}
            contentFit="cover"
          />
        ) : (
          <Image
            source={require("../../assets/images/washing.png")}
            style={{ width: avatarSize * 0.65, height: avatarSize * 0.65 }}
            contentFit="contain"
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={u.cleanerCardNameRow}>
          <Text
            style={[u.cleanerCardName, isSmallScreen && { fontSize: 14 }]}
            numberOfLines={1}
          >
            {cleaner.shopname}
          </Text>
          <View style={u.ratingPill}>
            <Text style={u.ratingPillText}>★ {cleaner.rating || "0.0"}</Text>
          </View>
        </View>
        {cleaner.address && (
          <Text style={u.cleanerCardAddr} numberOfLines={1}>
            {`${cleaner.address.city}, ${cleaner.address.state}`}
          </Text>
        )}
        <View style={u.cleanerCardMeta}>
          <MaterialCommunityIcons name="phone-outline" size={13} color={COLORS.textLight} />
          <Text style={u.cleanerCardMetaText}>{cleaner.phoneNumber}</Text>
          {cleaner.services.length > 0 && (
            <>
              <Text style={u.cleanerCardMetaDot}>·</Text>
              <Text style={u.cleanerCardMetaText}>{cleaner.services.length} services</Text>
            </>
          )}
        </View>
      </View>
      <View style={u.cleanerCardActions}>
        <TouchableOpacity style={u.cleanerCardViewBtn} onPress={() => onView(cleaner)}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        {can && (
          <TouchableOpacity style={u.cleanerCardDeleteBtn} onPress={() => onDelete(cleaner)}>
            <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const MyDryCleaners: React.FC = () => {
  const router = useRouter();
  const [cleaners, setCleaners] = useState<DryCleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCleaner, setModalCleaner] = useState<DryCleaner | null>(null);
  const authToken = useSelector((s: RootState) => s.auth.token);
  const currentUser = useSelector((s: RootState) => s.auth.user);

  const fetchCleaners = async (silent = false) => {
    if (!authToken) {
      Alert.alert("Error", "Please log in again.");
      router.replace("/login");
      return;
    }
    try {
      silent ? setRefreshing(true) : setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/get-own-drycleaner`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.data.success) {
        const list = (res.data.data?.dryCleaners || []).map((c: any) => ({
          ...c,
          ownerId: c.owner || c.ownerId,
        }));
        setCleaners(list);
        if (modalCleaner) {
          const updated = list.find((c: DryCleaner) => c._id === modalCleaner._id);
          if (updated) setModalCleaner(updated);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to load dry cleaners.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCleaners();
  }, [authToken]);

  const handleDelete = (cleaner: DryCleaner) => {
    if (!isOwner(cleaner, currentUser?._id || "")) {
      Alert.alert("Access Denied", "You can only delete your own dry cleaners.");
      return;
    }
    Alert.alert("Delete", `Delete "${cleaner.shopname}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(
              `${API_BASE_URL}/delete-own-drycleaner/${cleaner._id}`,
              { headers: { Authorization: `Bearer ${authToken}` } }
            );
            Alert.alert("Deleted", "Dry cleaner removed successfully.");
            fetchCleaners();
          } catch {
            Alert.alert("Error", "Failed to delete. Please try again.");
          }
        },
      },
    ]);
  };

  if (loading)
    return (
      <SafeAreaView style={[u.screen, u.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[u.loadingText, { marginTop: 12 }]}>Loading your shops…</Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={u.screen}>
      <View style={u.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={u.topBarBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={u.topBarTitle}>My Dry Cleaners</Text>
        <TouchableOpacity
          onPress={() => router.push("/dryCleanerMerchant/merchantAddDryCleaner")}
          style={u.topBarBtn}
        >
          <Ionicons name="add" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={u.summaryRow}>
          <Text style={u.summaryText}>
            {cleaners.length} shop{cleaners.length !== 1 ? "s" : ""}
          </Text>
          <TouchableOpacity
            onPress={() => fetchCleaners(true)}
            style={u.refreshBtn}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={15} color={COLORS.primary} />
                <Text style={u.refreshText}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {cleaners.length === 0 ? (
          <View style={u.emptyState}>
            <MaterialCommunityIcons name="store-off-outline" size={72} color={COLORS.secondary} />
            <Text style={u.emptyTitle}>No dry cleaners yet</Text>
            <Text style={u.emptySubtitle}>
              Add your first shop to start accepting orders
            </Text>
            <PrimaryBtn
              label="+ Add Dry Cleaner"
              onPress={() =>
                router.push("/dryCleanerMerchant/merchantAddDryCleaner")
              }
              style={{ marginTop: 20, paddingHorizontal: 32 }}
            />
          </View>
        ) : (
          cleaners.map((c) => (
            <CleanerCard
              key={c._id}
              cleaner={c}
              currentUserId={currentUser?._id || ""}
              onView={(c) => setModalCleaner(c)}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>

      <CleanerDetailsModal
        cleaner={modalCleaner}
        visible={!!modalCleaner}
        onClose={() => setModalCleaner(null)}
        onEdit={(c) => {
          setModalCleaner(null);
          router.push({
            pathname: "/dryCleanerMerchant/editDryCleaner",
            params: { cleaner: JSON.stringify(c) },
          });
        }}
        onRefresh={() => fetchCleaners(true)}
        currentUserId={currentUser?._id || ""}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const u = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.textLight, fontSize: 14 },
  row: { flexDirection: "row" },

  topBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  topBarBtn: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center",
    alignItems: "center", backgroundColor: COLORS.primaryLight,
  },
  topBarTitle: {
    flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: COLORS.text,
  },

  summaryRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  summaryText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: COLORS.primaryLight, borderRadius: 20,
  },
  refreshText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },

  cleanerCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    borderRadius: 18, padding: 14, marginBottom: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, gap: 12,
  },
  cleanerCardAvatar: {
    borderRadius: 16, backgroundColor: COLORS.primaryLight,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  cleanerCardNameRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4,
  },
  cleanerCardName: { fontSize: 16, fontWeight: "700", color: COLORS.text, flex: 1 },
  ratingPill: {
    backgroundColor: "#FFF3D6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12,
  },
  ratingPillText: { fontSize: 12, fontWeight: "700", color: "#E6A000" },
  cleanerCardAddr: { fontSize: 13, color: COLORS.textLight, marginBottom: 6 },
  cleanerCardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cleanerCardMetaText: { fontSize: 12, color: COLORS.textMuted },
  cleanerCardMetaDot: { fontSize: 12, color: COLORS.textMuted },
  cleanerCardActions: { justifyContent: "center", alignItems: "center", gap: 8 },
  cleanerCardViewBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight,
    justifyContent: "center", alignItems: "center",
  },
  cleanerCardDeleteBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFEBEE",
    justifyContent: "center", alignItems: "center",
  },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: COLORS.text, marginTop: 16 },
  emptySubtitle: {
    fontSize: 14, color: COLORS.textLight, textAlign: "center", marginTop: 8, lineHeight: 21,
  },

  modalShell: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, marginTop: 16, paddingVertical: 10,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalHeaderBtn: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center",
  },
  modalHeaderTitle: {
    flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: COLORS.text,
  },
  modalSaveText: { fontSize: 15, fontWeight: "700", color: COLORS.primary },

  detailModalHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 12, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8,
  },
  detailModalTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: COLORS.text },

  ownerBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.primaryLight, marginHorizontal: 16, marginTop: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  ownerBannerText: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: "500" },

  card: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 14,
    borderRadius: 18, padding: 18, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  sectionTitleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },

  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 20, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  dangerBtn: {
    backgroundColor: COLORS.error, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 20, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8, marginTop: 8,
  },
  dangerBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  outlineBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
    borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight,
  },
  outlineBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryLight,
    justifyContent: "center", alignItems: "center",
  },
  primaryPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.primary, paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: 20,
  },
  primaryPillText: { fontSize: 13, color: COLORS.white, fontWeight: "700" },

  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 7 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 13 : 11,
    fontSize: 15, color: COLORS.text, backgroundColor: COLORS.white,
  },
  groupHeader: {
    fontSize: 15, fontWeight: "700", color: COLORS.text, marginTop: 8,
    marginBottom: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14, backgroundColor: COLORS.primaryLight,
    borderRadius: 12, marginBottom: 18, borderWidth: 1, borderColor: COLORS.border,
  },
  toggleSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: 13, color: COLORS.textLight, fontWeight: "500" },
  chipTextActive: { color: COLORS.primary, fontWeight: "700" },

  // ── Additional service price row in ServiceForm ──
  additionalPriceRow: {
    marginTop: 12, padding: 12, backgroundColor: COLORS.primaryLight,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  additionalPriceLabel: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8,
  },
  additionalPriceLabelText: { fontSize: 13, fontWeight: "600", color: COLORS.text },

  infoBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.primaryLight, marginHorizontal: 20, marginTop: 16,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: "500" },

  hourRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  hourDay: { width: 36, fontSize: 13, fontWeight: "700", color: COLORS.text },
  hourInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: Platform.OS === "ios" ? 8 : 6,
    fontSize: 13, color: COLORS.text, textAlign: "center", backgroundColor: COLORS.background,
  },
  hourSep: { marginHorizontal: 8, color: COLORS.textMuted, fontWeight: "700" },

  hourDisplayRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  hourDisplayDay: { fontSize: 13, fontWeight: "700", color: COLORS.text, width: 36 },
  hourDisplayTime: { fontSize: 13, color: COLORS.textLight },

  avatarWrap: { alignItems: "center", marginBottom: 24 },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.primaryLight,
    justifyContent: "center", alignItems: "center", borderWidth: 3,
    borderColor: COLORS.border, overflow: "hidden", position: "relative",
  },
  avatarImg: { width: 110, height: 110 },
  avatarOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center",
  },
  avatarCameraBtn: {
    position: "absolute", bottom: 4, right: 4, backgroundColor: COLORS.primary,
    width: 28, height: 28, borderRadius: 14, justifyContent: "center",
    alignItems: "center", borderWidth: 2, borderColor: COLORS.white,
  },
  avatarHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 10 },
  avatarSelected: { fontSize: 12, color: COLORS.success, marginTop: 4, fontWeight: "600" },

  contactRow: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, marginTop: 8,
  },
  contactAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: COLORS.border },
  contactAvatarPlaceholder: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primaryLight,
    justifyContent: "center", alignItems: "center",
  },
  contactName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  contactSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  infoRowText: { flex: 1, fontSize: 13, color: COLORS.textLight, lineHeight: 19 },

  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  serviceCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight,
    borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: COLORS.border,
  },
  serviceName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  serviceCategory: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  servicePrice: { fontSize: 14, fontWeight: "800", color: COLORS.primary, marginTop: 6 },
  serviceCardBtns: { gap: 6, marginLeft: 6 },
  serviceEditBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.white,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: COLORS.border,
  },
  serviceDeleteBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.error,
    justifyContent: "center", alignItems: "center",
  },
  emptyServices: { alignItems: "center", paddingVertical: 24, gap: 10 },
  emptyServicesText: { fontSize: 14, color: COLORS.textMuted },

  // ── Additional service badges row on service card (multiple) ──
  additionalBadgeRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6,
  },
  additionalBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 6,
    paddingVertical: 3, alignSelf: "flex-start", borderWidth: 1, borderColor: COLORS.border,
  },
  additionalBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: "600" },

  aboutText: { fontSize: 14, color: COLORS.textLight, lineHeight: 22, marginTop: 8 },

  metricsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 14 },
  metricBox: {
    alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 10, flex: 1, marginHorizontal: 5,
  },
  metricIcon: { fontSize: 20, marginBottom: 4 },
  metricVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  metricLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

  shopImgWrap: { position: "relative", marginRight: 10 },
  shopImg: { borderRadius: 14 },
  shopImgOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  shopImgAdd: {
    width: 110, height: 110, backgroundColor: COLORS.primaryLight, borderRadius: 14,
    justifyContent: "center", alignItems: "center", borderWidth: 2,
    borderColor: COLORS.primary, borderStyle: "dashed",
  },
  shopImgAddText: { fontSize: 12, color: COLORS.primary, fontWeight: "700", marginTop: 4 },
  emptyImages: {
    alignItems: "center", paddingVertical: 24, gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12,
  },
  emptyImagesText: { fontSize: 14, color: COLORS.textMuted },

  imageCountPill: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primaryLight,
    padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  imageCountText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  imageChangesText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  imgSectionLabel: {
    fontSize: 13, fontWeight: "700", color: COLORS.textLight, marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  imgThumb: { position: "relative", marginRight: 10 },
  imgThumbImg: { width: 150, height: 105, borderRadius: 12 },
  imgThumbBtn: {
    position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: COLORS.white,
  },
  imgThumbLabel: {
    position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  imgThumbLabelText: { fontSize: 10, color: COLORS.white, fontWeight: "700" },
  addImgDashed: {
    alignItems: "center", padding: 28, backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: "dashed", gap: 6, marginTop: 8,
  },
  addImgText: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  addImgSub: { fontSize: 13, color: COLORS.textMuted },
  addImgFull: {
    alignItems: "center", padding: 20, backgroundColor: "#E8F5E9", borderRadius: 16, gap: 8,
  },
  addImgFullText: { fontSize: 14, fontWeight: "700", color: COLORS.success },
});

export default MyDryCleaners;