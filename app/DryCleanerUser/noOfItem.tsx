import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  saveOrderData,
  setSelectedCleaner as setSelectedCleanerRedux,
} from "../../components/redux/userSlice";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cleaner {
  _id: string;
  shopname: string;
  address: any;
  rating: number;
  phoneNumber: string;
  hoursOfOperation?: any[];
  services?: any[];
}

// ✅ Additional service from backend — array of { name, price }
interface AdditionalServiceOption {
  name: "zipper" | "button" | "wash/fold";
  price: number;
  _id?: string;
}

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  merchantStarchLevel: "low" | "medium" | "high";
  userStarchLevel: "low" | "medium" | "high";
  washOnly: boolean;
  // ✅ Now an array of { name, price } — matches new backend format
  additionalservice?: AdditionalServiceOption[];
  dryCleanerId: string;
  dryCleanerName: string;
  options: {
    washAndFold: boolean;
    button?: boolean;
    zipper?: boolean;
    // ✅ Track which additional services the user has toggled ON
    selectedAdditionals: string[]; // e.g. ["zipper", "wash/fold"]
  };
}

const STARCH_LEVELS: ("low" | "medium" | "high")[] = ["low", "medium", "high"];

// ─── Helper: normalize additionalservice from backend ─────────────────────────
// Handles legacy string format, single object, or new array format
const normalizeAdditionalServices = (raw: any): AdditionalServiceOption[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((s: any) => s && s.name);
  }
  if (typeof raw === "object" && raw.name) {
    return [{ name: raw.name, price: raw.price || 0 }];
  }
  if (typeof raw === "string" && raw.length > 0) {
    return [{ name: raw as any, price: 0 }];
  }
  return [];
};

// ─── AdditionalServicesPanel ──────────────────────────────────────────────────
// Renders the list of available additional services for an item as toggleable chips

const AdditionalServicesPanel: React.FC<{
  additionalServices: AdditionalServiceOption[];
  selectedAdditionals: string[];
  onToggle: (name: string) => void;
}> = ({ additionalServices, selectedAdditionals, onToggle }) => {
  if (!additionalServices || additionalServices.length === 0) return null;

  return (
    <View style={addStyles.container}>
      <Text style={addStyles.label}>Additional Services</Text>
      <View style={addStyles.row}>
        {additionalServices.map((svc) => {
          const selected = selectedAdditionals.includes(svc.name);
          return (
            <TouchableOpacity
              key={svc.name}
              style={[addStyles.chip, selected && addStyles.chipSelected]}
              onPress={() => onToggle(svc.name)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  addStyles.chipText,
                  selected && addStyles.chipTextSelected,
                ]}
              >
                {selected ? "✓ " : ""}
                {svc.name}
              </Text>
              {svc.price > 0 && (
                <Text
                  style={[
                    addStyles.chipPrice,
                    selected && addStyles.chipPriceSelected,
                  ]}
                >
                  +${svc.price.toFixed(2)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedAdditionals.length > 0 && (
        <View style={addStyles.summary}>
          <Icon name="plus-circle-outline" size={13} color="#FF8C00" />
          <Text style={addStyles.summaryText}>
            Add-ons: +$
            {additionalServices
              .filter((s) => selectedAdditionals.includes(s.name))
              .reduce((sum, s) => sum + (s.price || 0), 0)
              .toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
};

const addStyles = StyleSheet.create({
  container: {
    marginTop: 4,
    padding: 10,
    backgroundColor: "#FFF8F0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFD699",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF8C00",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FFD699",
    backgroundColor: "#FFFFFF",
  },
  chipSelected: {
    borderColor: "#FF8C00",
    backgroundColor: "#FF8C001A",
  },
  chipText: { fontSize: 13, color: "#666", fontWeight: "500" },
  chipTextSelected: { color: "#FF8C00", fontWeight: "700" },
  chipPrice: { fontSize: 12, color: "#999", fontWeight: "600" },
  chipPriceSelected: { color: "#FF8C00" },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#FFD699",
  },
  summaryText: { fontSize: 12, color: "#FF8C00", fontWeight: "700" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AvailableServicesScreen: React.FC = () => {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [selectedCleaner, setSelectedCleaner] = useState<Cleaner | null>(null);
  const [showWashOnlyModal, setShowWashOnlyModal] = useState(false);
  const [showStarchModal, setShowStarchModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedServices, setHasFetchedServices] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();

  const orderData = useSelector((state: any) => state.user?.order || null);

  const categories = [
    "All",
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
  const washOnlyOptions = ["Yes", "No"];

  const capitalizeFirst = (str: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : "Low";

  const getAllowedStarchLevels = useCallback(
    (
      merchantLevel: "low" | "medium" | "high",
    ): ("low" | "medium" | "high")[] => {
      const maxIndex = STARCH_LEVELS.indexOf(merchantLevel);
      return STARCH_LEVELS.filter((_, idx) => idx <= maxIndex);
    },
    [],
  );

  const validateItemData = useCallback((item: any): ServiceItem => {
    try {
      const categoryMap: { [key: string]: string } = {
        Wast: "Pants",
        Wash: "Shirts",
        wash: "Shirts",
        pant: "Pants",
        shirt: "Shirts",
        coat: "Coats",
        suit: "Suits",
        dress: "Dresses",
        blanket: "Blankets",
        comforter: "Comforters",
        curtain: "Curtains",
      };
      const rawCategory = item.category || "Other";
      const mappedCategory = categoryMap[rawCategory] || rawCategory;
      const validStarch = (val: any): val is "low" | "medium" | "high" =>
        val === "low" || val === "medium" || val === "high";
      const merchantStarchLevel: "low" | "medium" | "high" = validStarch(
        item.starchLevel,
      )
        ? item.starchLevel
        : "medium";

      // ✅ Normalize additionalservice to array
      const additionalServices = normalizeAdditionalServices(
        item.additionalservice,
      );

      const validatedItem: ServiceItem = {
        _id: item._id?.toString() || `temp_${Date.now()}_${Math.random()}`,
        name: item.name || "Unknown Item",
        price: typeof item.price === "number" ? item.price : 0,
        quantity:
          typeof item.quantity === "number" ? Math.max(0, item.quantity) : 0,
        category: mappedCategory,
        merchantStarchLevel,
        userStarchLevel: "low",
        washOnly: typeof item.washOnly === "boolean" ? item.washOnly : false,
        additionalservice: additionalServices,
        dryCleanerId: item.dryCleanerId || null,
        dryCleanerName: item.dryCleanerName || "",
        options: {
          washAndFold: false,
          button: false,
          zipper: false,
          selectedAdditionals: [], // ✅ none selected initially
        },
      };

      return validatedItem;
    } catch (error) {
      console.error("Error validating item data:", error);
      return {
        _id: `temp_${Date.now()}_${Math.random()}`,
        name: "Unknown Item",
        price: 0,
        quantity: 0,
        category: "Other",
        merchantStarchLevel: "medium",
        userStarchLevel: "low",
        washOnly: false,
        additionalservice: [],
        dryCleanerId: null,
        dryCleanerName: "",
        options: {
          washAndFold: false,
          button: false,
          zipper: false,
          selectedAdditionals: [],
        },
      };
    }
  }, []);

  const isDryCleanerOpen = useCallback((hoursOfOperation: any[]): boolean => {
    try {
      if (!hoursOfOperation || !Array.isArray(hoursOfOperation)) return true;
      const now = new Date();
      const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const todayHours = hoursOfOperation.find(
        (h: any) =>
          h && h.day && h.day.toLowerCase() === currentDay.toLowerCase(),
      );
      if (!todayHours) return false;
      const parseTime = (timeStr: string): number => {
        if (!timeStr) return 0;
        const cleanTime = timeStr.toLowerCase().replace(/\s/g, "");
        if (cleanTime.includes("am") || cleanTime.includes("pm")) {
          const isPM = cleanTime.includes("pm");
          const timeOnly = cleanTime.replace(/[ap]m/g, "");
          let hours = 0,
            minutes = 0;
          if (timeOnly.includes(":")) {
            const [h, m] = timeOnly.split(":");
            hours = parseInt(h) || 0;
            minutes = parseInt(m) || 0;
          } else {
            hours = parseInt(timeOnly) || 0;
          }
          if (isPM && hours !== 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          return hours * 60 + minutes;
        }
        if (timeStr.includes(":")) {
          const [h, m] = timeStr.split(":");
          return (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
        }
        return (parseInt(timeStr) || 0) * 60;
      };
      const openTime = parseTime(todayHours.open);
      const closeTime = parseTime(todayHours.close);
      return currentTime >= openTime && currentTime <= closeTime;
    } catch (error) {
      console.error("Error checking cleaner hours:", error);
      return true;
    }
  }, []);

  const fetchSelectedCleanerServices = useCallback(
    async (cleaner: Cleaner) => {
      if (!cleaner || !cleaner._id) {
        Alert.alert("Error", "No dry cleaner selected.");
        return;
      }
      try {
        setIsLoading(true);
        if (
          cleaner.hoursOfOperation &&
          !isDryCleanerOpen(cleaner.hoursOfOperation)
        ) {
          Alert.alert(
            "Dry Cleaner Closed",
            `${cleaner.shopname} is currently closed. Please try again during business hours.`,
            [{ text: "OK" }],
          );
          setItems([]);
          setIsInitialized(true);
          return;
        }
        const apiUrl = `https://vervoer-backend2.onrender.com/api/users/dry-cleaners/${cleaner._id}/services`;
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok)
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();
        let services: any[] = [];
        if (data.data && Array.isArray(data.data)) services = data.data;
        else if (data.services && Array.isArray(data.services))
          services = data.services;
        else if (Array.isArray(data)) services = data;

        if (services.length === 0) {
          Alert.alert(
            "No Services",
            `No services available from ${cleaner.shopname} at this time.`,
          );
          setItems([]);
          setIsInitialized(true);
          return;
        }
        const cleanerServices = services.map((service) => ({
          ...service,
          quantity: 0,
          dryCleanerId: cleaner._id,
          dryCleanerName: cleaner.shopname,
        }));
        const validatedServices = cleanerServices.map(validateItemData);
        setItems(validatedServices);
      } catch (error: any) {
        console.error("Error fetching services:", error);
        let errorMessage = "Failed to load services. Please try again.";
        if (
          error.message.includes("Network Error") ||
          error.name === "TypeError"
        )
          errorMessage =
            "Cannot connect to server. Please check your internet connection.";
        else if (error.message.includes("timeout"))
          errorMessage = "Request timed out. Please try again.";
        else if (error.message.includes("404"))
          errorMessage = "Services not found for this dry cleaner.";
        else if (error.message.includes("500"))
          errorMessage = "Server error. Please try again later.";
        Alert.alert("Error", errorMessage, [{ text: "OK" }]);
        setItems([]);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    },
    [isDryCleanerOpen, validateItemData],
  );

  useEffect(() => {
    const initializeCleaner = async () => {
      let cleaner: Cleaner | null = null;
      if (params?.selectedCleaner) {
        const selectedCleanerParam = params.selectedCleaner;
        if (typeof selectedCleanerParam === "string") {
          try {
            cleaner = JSON.parse(selectedCleanerParam);
          } catch (error) {
            Alert.alert(
              "Error",
              "Invalid dry cleaner data. Please select a dry cleaner again.",
              [{ text: "Go Back", onPress: () => router.back() }],
            );
            return;
          }
        } else if (typeof selectedCleanerParam === "object") {
          cleaner = selectedCleanerParam as Cleaner;
        }
      }
      if (!cleaner) {
        Alert.alert(
          "Error",
          "No dry cleaner selected. Please select a dry cleaner first.",
          [{ text: "Go Back", onPress: () => router.back() }],
        );
        return;
      }
      if (!cleaner._id || !cleaner.shopname) {
        Alert.alert(
          "Error",
          "Invalid dry cleaner data. Please select a dry cleaner again.",
          [{ text: "Go Back", onPress: () => router.back() }],
        );
        return;
      }
      if (!selectedCleaner || selectedCleaner._id !== cleaner._id) {
        setSelectedCleaner(cleaner);
        setHasFetchedServices(false);
      }
    };
    initializeCleaner();
  }, [params, router]);

  useEffect(() => {
    const fetchServices = async () => {
      if (!selectedCleaner || hasFetchedServices) return;
      await fetchSelectedCleanerServices(selectedCleaner);
      setHasFetchedServices(true);
    };
    fetchServices();
  }, [selectedCleaner, hasFetchedServices, fetchSelectedCleanerServices]);

  const handleCategorySelection = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item._id === id ? { ...item, quantity: 0 } : item,
      ),
    );
  }, []);

  const updateQuantity = useCallback((id: string, increment: boolean) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item._id === id) {
          const newQuantity = increment
            ? item.quantity + 1
            : Math.max(0, item.quantity - 1);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }),
    );
  }, []);

  const updateWashOnly = useCallback(
    (value: string) => {
      if (selectedItemId) {
        const washOnly = value === "Yes";
        setItems((prevItems) =>
          prevItems.map((item) =>
            item._id === selectedItemId ? { ...item, washOnly } : item,
          ),
        );
        setShowWashOnlyModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId],
  );

  const updateUserStarchLevel = useCallback(
    (value: "low" | "medium" | "high") => {
      if (selectedItemId) {
        setItems((prevItems) =>
          prevItems.map((item) => {
            if (item._id === selectedItemId) {
              const merchantMaxIndex = STARCH_LEVELS.indexOf(
                item.merchantStarchLevel,
              );
              const selectedIndex = STARCH_LEVELS.indexOf(value);
              const capped =
                STARCH_LEVELS[Math.min(selectedIndex, merchantMaxIndex)];
              return { ...item, userStarchLevel: capped };
            }
            return item;
          }),
        );
        setShowStarchModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId],
  );

  // ✅ Toggle an additional service on/off for an item
  const toggleAdditionalService = useCallback(
    (itemId: string, serviceName: string) => {
      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item._id !== itemId) return item;
          const current = item.options.selectedAdditionals || [];
          const updated = current.includes(serviceName)
            ? current.filter((n) => n !== serviceName)
            : [...current, serviceName];
          return {
            ...item,
            options: { ...item.options, selectedAdditionals: updated },
          };
        }),
      );
    },
    [],
  );

  const toggleOption = useCallback((itemId: string, optionName: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item._id === itemId) {
          const currentOptions = item.options || {};
          const newOptions = {
            ...currentOptions,
            [optionName]:
              !currentOptions[optionName as keyof typeof currentOptions],
          };
          return { ...item, options: newOptions };
        }
        return item;
      }),
    );
  }, []);

  // ✅ Compute per-item effective price (base + selected additional services)
  const getEffectivePrice = useCallback((item: ServiceItem): number => {
    const addOnTotal = (item.additionalservice || [])
      .filter((s) => (item.options.selectedAdditionals || []).includes(s.name))
      .reduce((sum, s) => sum + (s.price || 0), 0);
    return item.price + addOnTotal;
  }, []);

  const { totalItems, totalAmount } = useMemo(() => {
    const totalItems = items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );
    const totalAmount = items.reduce(
      (sum, item) => sum + getEffectivePrice(item) * (item.quantity || 0),
      0,
    );
    return { totalItems, totalAmount };
  }, [items, getEffectivePrice]);

  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (selectedCategory === "All") return items;
    return items.filter(
      (item) => item.category === selectedCategory || (item.quantity || 0) > 0,
    );
  }, [items, selectedCategory]);

  const selectedItemForStarch = useMemo(
    () => items.find((i) => i._id === selectedItemId) || null,
    [items, selectedItemId],
  );

  const handleContinue = useCallback(() => {
    if (totalItems === 0) {
      Alert.alert(
        "No Items Selected",
        "Please add at least one item to continue.",
      );
      return;
    }
    const selectedItemsForOrder = items.filter((item) => item.quantity > 0);
    try {
      if (selectedCleaner) {
        dispatch(
          setSelectedCleanerRedux({
            _id: selectedCleaner._id,
            shopname: selectedCleaner.shopname,
            address: selectedCleaner.address || {},
            rating: selectedCleaner.rating || 0,
            phoneNumber: selectedCleaner.phoneNumber || "",
            hoursOfOperation: selectedCleaner.hoursOfOperation || [],
          }),
        );
      }
      dispatch(
        saveOrderData({
          items: selectedItemsForOrder.map((item) => ({
            _id: item._id,
            name: item.name,
            category: item.category,
            price: item.price, // base price
            effectivePrice: getEffectivePrice(item), // base + add-ons
            quantity: item.quantity,
            merchantStarchLevel: item.merchantStarchLevel,
            starchLevel: item.userStarchLevel,
            washOnly: item.washOnly,
            // ✅ Pass full additionalservice array so OrderSummary can display it
            additionalservice: item.additionalservice || [],
            // ✅ Which additional services the user selected
            selectedAdditionals: item.options.selectedAdditionals || [],
            dryCleanerId: item.dryCleanerId || "",
            dryCleanerName: item.dryCleanerName || "",
            options: {
              washAndFold: item.options?.washAndFold || false,
              button: item.options?.button || false,
              zipper: item.options?.zipper || false,
              selectedAdditionals: item.options.selectedAdditionals || [],
            },
          })),
          selectedCleaner: selectedCleaner
            ? {
                _id: selectedCleaner._id,
                shopname: selectedCleaner.shopname,
                address: selectedCleaner.address || {},
                rating: selectedCleaner.rating || 0,
                phoneNumber: selectedCleaner.phoneNumber || "",
                hoursOfOperation: selectedCleaner.hoursOfOperation || [],
              }
            : undefined,
          totalAmount,
          totalItems,
          lastUpdated: new Date().toISOString(),
        }),
      );
      setTimeout(() => {
        router.push({
          pathname: "/dryCleanerUser/pickUpLocation",
          params: {
            selectedItems: JSON.stringify(selectedItemsForOrder),
            selectedCleaner: JSON.stringify(selectedCleaner),
            totalAmount: totalAmount.toString(),
            totalItems: totalItems.toString(),
          },
        } as any);
      }, 100);
    } catch (error) {
      console.error("Error saving to Redux:", error);
      Alert.alert("Error", "Failed to save order. Please try again.");
    }
  }, [
    items,
    totalItems,
    totalAmount,
    selectedCleaner,
    dispatch,
    router,
    getEffectivePrice,
  ]);

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={styles.title}>Loading services...</Text>
        {selectedCleaner && (
          <Text style={styles.loadingSubtext}>
            From {selectedCleaner.shopname}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={35} color="#FF8C00" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Available Services</Text>
          {selectedCleaner && (
            <Text style={styles.subtitle}>From {selectedCleaner.shopname}</Text>
          )}
        </View>
      </View>

      {/* Order Summary */}
      {totalItems > 0 && (
        <View style={styles.orderSummary}>
          <Text style={styles.orderSummaryText}>
            {totalItems} item{totalItems !== 1 ? "s" : ""} • $
            {totalAmount.toFixed(2)}
          </Text>
        </View>
      )}

      {/* Categories */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContentContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              activeOpacity={0.7}
              style={[
                styles.categoryButton,
                category === selectedCategory && styles.categoryButtonActive,
              ]}
              onPress={() => handleCategorySelection(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === selectedCategory && styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Items List */}
      <ScrollView style={styles.itemsContainer}>
        {filteredItems.length === 0 ? (
          <View style={styles.noItemsContainer}>
            <Text style={styles.noItemsText}>
              {items.length === 0
                ? `No services available from ${selectedCleaner?.shopname || "this dry cleaner"}`
                : "No services available in this category"}
            </Text>
            {items.length === 0 && selectedCleaner && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => fetchSelectedCleanerServices(selectedCleaner)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredItems.map((item, index) => {
            const effectivePrice = getEffectivePrice(item);
            const hasAddOns = (item.additionalservice || []).length > 0;
            const addOnTotal = effectivePrice - item.price;

            return (
              <View key={`${item._id}-${index}`} style={styles.itemCard}>
                {/* Item header */}
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.itemPrice}>
                      ${item.price.toFixed(2)}
                    </Text>
                    {addOnTotal > 0 && (
                      <Text style={styles.itemAddOnPrice}>
                        +${addOnTotal.toFixed(2)} add-ons
                      </Text>
                    )}
                    {item.quantity > 0 && addOnTotal > 0 && (
                      <Text style={styles.itemEffectivePrice}>
                        ${effectivePrice.toFixed(2)} each
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.optionsContainer}>
                  {/* Wash Only + Starch row */}
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => {
                        setSelectedItemId(item._id);
                        setShowWashOnlyModal(true);
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        Wash Only: {item.washOnly ? "Yes" : "No"}
                      </Text>
                      <Text style={styles.dropdownSubText}>Tap to change</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dropdown, styles.starchDropdown]}
                      onPress={() => {
                        setSelectedItemId(item._id);
                        setShowStarchModal(true);
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        Starch: {capitalizeFirst(item.userStarchLevel)}
                      </Text>
                      <Text style={styles.starchCapLabel}>
                        Max: {capitalizeFirst(item.merchantStarchLevel)} ▼
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ✅ Additional Services panel — chip-based multi-select with prices */}
                  {hasAddOns && (
                    <AdditionalServicesPanel
                      additionalServices={item.additionalservice!}
                      selectedAdditionals={
                        item.options.selectedAdditionals || []
                      }
                      onToggle={(name) =>
                        toggleAdditionalService(item._id, name)
                      }
                    />
                  )}

                  {/* Quantity controls */}
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item._id, false)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item._id, true)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                    {item.quantity > 0 && (
                      <Text style={styles.itemSubtotal}>
                        = ${(effectivePrice * item.quantity).toFixed(2)}
                      </Text>
                    )}
                  </View>

                  {item.quantity > 0 && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteItem(item._id)}
                    >
                      <Icon name="delete-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          totalItems === 0 && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={totalItems === 0}
      >
        <Text style={styles.continueButtonText}>
          Continue{" "}
          {totalItems > 0 &&
            `(${totalItems} items • $${totalAmount.toFixed(2)})`}
        </Text>
      </TouchableOpacity>

      {/* Wash Only Modal */}
      <Modal visible={showWashOnlyModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Wash Only</Text>
            {washOnlyOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => updateWashOnly(option)}
              >
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowWashOnlyModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Starch Level Modal */}
      <Modal visible={showStarchModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starch Level</Text>
            {selectedItemForStarch && (
              <Text style={styles.modalSubtitle}>
                Merchant allows up to:{" "}
                <Text style={styles.modalSubtitleBold}>
                  {capitalizeFirst(selectedItemForStarch.merchantStarchLevel)}
                </Text>
              </Text>
            )}
            {selectedItemForStarch &&
              getAllowedStarchLevels(
                selectedItemForStarch.merchantStarchLevel,
              ).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.modalOption,
                    selectedItemForStarch.userStarchLevel === level &&
                      styles.modalOptionSelected,
                  ]}
                  onPress={() => updateUserStarchLevel(level)}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedItemForStarch.userStarchLevel === level &&
                        styles.modalOptionTextSelected,
                    ]}
                  >
                    {capitalizeFirst(level)}
                  </Text>
                  {selectedItemForStarch.userStarchLevel === level && (
                    <Text style={styles.modalOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowStarchModal(false);
                setSelectedItemId(null);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7FA", paddingTop: 40 },
  headerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 0,
    paddingTop: 10,
  },
  titleContainer: { flex: 1, marginLeft: 50, marginTop: -35 },
  title: { fontSize: 25, fontWeight: "400", color: "#000000" },
  subtitle: { fontSize: 16, fontWeight: "300", color: "#666666", marginTop: 4 },
  loadingSubtext: { fontSize: 14, color: "#666666", marginTop: 8 },
  orderSummary: {
    backgroundColor: "#FF8C00",
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  orderSummaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  categoriesWrapper: { marginBottom: 20 },
  categoriesContainer: { flexDirection: "row", paddingHorizontal: 15 },
  categoriesContentContainer: { paddingRight: 20 },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#666666",
    borderRadius: 8,
    marginHorizontal: 4,
    justifyContent: "center",
    minWidth: 60,
  },
  categoryButtonActive: { backgroundColor: "#FF8C00" },
  categoryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  categoryTextActive: { color: "#FFFFFF" },
  itemsContainer: { flex: 1, paddingHorizontal: 20 },
  noItemsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  noItemsText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: "#FF8C00",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  itemCategory: { fontSize: 12, color: "#999", fontWeight: "500" },
  itemPrice: { fontSize: 16, fontWeight: "700", color: "#FF8C00" },
  itemAddOnPrice: {
    fontSize: 12,
    color: "#FF8C00",
    marginTop: 2,
    fontWeight: "500",
  },
  itemEffectivePrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginTop: 2,
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF8C00",
    marginLeft: 12,
    alignSelf: "center",
  },
  optionsContainer: { gap: 12 },
  dropdownContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdown: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  starchDropdown: { backgroundColor: "#FFF8F0", borderColor: "#FFD699" },
  dropdownText: { color: "#333", fontSize: 14, fontWeight: "500" },
  dropdownSubText: { fontSize: 11, color: "#999", marginTop: 2 },
  starchCapLabel: {
    fontSize: 11,
    color: "#FF8C00",
    marginTop: 2,
    fontWeight: "500",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 4,
    alignSelf: "flex-start",
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
  },
  quantityButtonText: { fontSize: 18, color: "#000000", fontWeight: "bold" },
  quantityText: {
    marginHorizontal: 15,
    fontSize: 16,
    color: "#000000",
    fontWeight: "600",
  },
  deleteButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  continueButton: {
    backgroundColor: "#FF8C00",
    margin: 20,
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonDisabled: { backgroundColor: "#CCCCCC" },
  continueButtonText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 20,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 15,
  },
  modalSubtitleBold: { color: "#FF8C00", fontWeight: "600" },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOptionSelected: {
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    borderBottomWidth: 0,
    marginBottom: 2,
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    flex: 1,
  },
  modalOptionTextSelected: { color: "#FF8C00", fontWeight: "600" },
  modalOptionCheck: { color: "#FF8C00", fontSize: 16, fontWeight: "bold" },
  modalCloseButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseButtonText: { color: "#FF8C00", fontSize: 16, fontWeight: "600" },
});

export default AvailableServicesScreen;
