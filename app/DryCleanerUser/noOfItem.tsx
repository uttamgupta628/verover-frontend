import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  saveOrderData,
  setSelectedCleaner as setSelectedCleanerRedux,
  enableOrderProtection,
  disableOrderProtection,
} from "../../components/redux/userSlice";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// Types for TypeScript
interface Cleaner {
  _id: string;
  shopname: string;
  address: any;
  rating: number;
  phoneNumber: string;
  hoursOfOperation?: any[];
  services?: any[];
}

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  starchLevel: number;
  washOnly: boolean;
  additionalservice?: string;
  dryCleanerId: string;
  dryCleanerName: string;
  options: {
    washAndFold: boolean;
    button?: boolean;
    zipper?: boolean;
  };
}

const AvailableServicesScreen: React.FC = () => {
  // Local state
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [selectedCleaner, setSelectedCleaner] = useState<Cleaner | null>(null);
  const [showWashOnlyModal, setShowWashOnlyModal] = useState(false);
  const [showStarchLevelModal, setShowStarchLevelModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedServices, setHasFetchedServices] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All"); // LOCAL STATE FOR CATEGORIES

  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();

  // Redux state
  const orderData = useSelector((state: any) => state.user?.order || null);

  // Standard categories - always show these
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
  const starchLevelOptions = ["None", "Light", "Medium", "Heavy"];

  // Validate item data
  const validateItemData = useCallback((item: any): ServiceItem => {
    try {
      // Category mapping - convert old/incorrect categories to standard ones
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

      const validatedItem = {
        _id: item._id?.toString() || `temp_${Date.now()}_${Math.random()}`,
        name: item.name || "Unknown Item",
        price: typeof item.price === "number" ? item.price : 0,
        quantity:
          typeof item.quantity === "number" ? Math.max(0, item.quantity) : 0,
        category: mappedCategory, // Use mapped category
        starchLevel:
          typeof item.starchLevel === "number" ? item.starchLevel : 3,
        washOnly: typeof item.washOnly === "boolean" ? item.washOnly : false,
        additionalservice: item.additionalservice || null,
        dryCleanerId: item.dryCleanerId || null,
        dryCleanerName: item.dryCleanerName || "",
        options: {
          washAndFold: false,
          button: false,
          zipper: false,
        },
      };

      // Process options safely
      if (
        item.options &&
        typeof item.options === "object" &&
        !Array.isArray(item.options)
      ) {
        Object.keys(item.options).forEach((key) => {
          if (typeof item.options[key] === "boolean") {
            validatedItem.options[key as keyof typeof validatedItem.options] =
              item.options[key];
          }
        });
      }

      if (validatedItem.additionalservice === "button") {
        validatedItem.options.button = validatedItem.options.button || false;
      }
      if (validatedItem.additionalservice === "zipper") {
        validatedItem.options.zipper = validatedItem.options.zipper || false;
      }

      return validatedItem;
    } catch (error) {
      console.error("Error validating item data:", error);
      return {
        _id: `temp_${Date.now()}_${Math.random()}`,
        name: "Unknown Item",
        price: 0,
        quantity: 0,
        category: "Other",
        starchLevel: 3,
        washOnly: false,
        additionalservice: null,
        dryCleanerId: null,
        dryCleanerName: "",
        options: { washAndFold: false, button: false, zipper: false },
      };
    }
  }, []);

  // Check if dry cleaner is open
  const isDryCleanerOpen = useCallback((hoursOfOperation: any[]): boolean => {
    try {
      if (!hoursOfOperation || !Array.isArray(hoursOfOperation)) {
        return true;
      }

      const now = new Date();
      const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const todayHours = hoursOfOperation.find(
        (h: any) =>
          h && h.day && h.day.toLowerCase() === currentDay.toLowerCase()
      );

      if (!todayHours) {
        return false;
      }

      // Parse time function
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
            minutes = 0;
          }

          if (isPM && hours !== 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;

          return hours * 60 + minutes;
        }

        // Handle 24-hour format
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
        console.error("No cleaner data provided");
        Alert.alert("Error", "No dry cleaner selected.");
        return;
      }

      try {
        setIsLoading(true);
        console.log("Fetching services for cleaner:", cleaner.shopname);

        if (
          cleaner.hoursOfOperation &&
          !isDryCleanerOpen(cleaner.hoursOfOperation)
        ) {
          Alert.alert(
            "Dry Cleaner Closed",
            `${cleaner.shopname} is currently closed. Please try again during business hours.`,
            [{ text: "OK" }]
          );
          setItems([]);
          setIsInitialized(true);
          return;
        }

        const apiUrl = `https://vervoer-backend2.onrender.com/api/users/dry-cleaners/${cleaner._id}/services`;

        console.log("Fetching from URL:", apiUrl);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("API Response received:", data);

        let services: any[] = [];

        if (data.data && Array.isArray(data.data)) {
          services = data.data;
        } else if (data.services && Array.isArray(data.services)) {
          services = data.services;
        } else if (Array.isArray(data)) {
          services = data;
        } else {
          services = [];
        }

        if (services.length === 0) {
          Alert.alert(
            "No Services",
            `No services available from ${cleaner.shopname} at this time.`
          );
          setItems([]);
          setIsInitialized(true);
          return;
        }

        const cleanerServices = services.map((service) => {
          const baseOptions = {
            washAndFold: false,
            button: false,
            zipper: false,
          };

          if (service.additionalservice === "button") {
            baseOptions.button = false;
          }
          if (service.additionalservice === "zipper") {
            baseOptions.zipper = false;
          }

          return {
            ...service,
            quantity: 0,
            dryCleanerId: cleaner._id,
            dryCleanerName: cleaner.shopname,
            options: baseOptions,
          };
        });

        const validatedServices = cleanerServices.map(validateItemData);
        setItems(validatedServices);

        console.log(`Successfully loaded ${validatedServices.length} services`);
      } catch (error: any) {
        console.error("Error fetching services:", error);

        let errorMessage = "Failed to load services. Please try again.";

        if (
          error.message.includes("Network Error") ||
          error.name === "TypeError"
        ) {
          errorMessage =
            "Cannot connect to server. Please check your internet connection.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        } else if (error.message.includes("404")) {
          errorMessage = "Services not found for this dry cleaner.";
        } else if (error.message.includes("500")) {
          errorMessage = "Server error. Please try again later.";
        }

        Alert.alert("Error", errorMessage, [{ text: "OK" }]);
        setItems([]);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    },
    [isDryCleanerOpen, validateItemData]
  );

  // Initialize component
  useEffect(() => {
    const initializeCleaner = async () => {
      console.log("Route params:", params);

      let cleaner: Cleaner | null = null;

      // Parse cleaner data
      if (params?.selectedCleaner) {
        const selectedCleanerParam = params.selectedCleaner;
        if (typeof selectedCleanerParam === "string") {
          try {
            cleaner = JSON.parse(selectedCleanerParam);
            console.log("Parsed cleaner from string:", cleaner);
          } catch (error) {
            console.error("Error parsing cleaner data:", error);
            Alert.alert(
              "Error",
              "Invalid dry cleaner data. Please select a dry cleaner again.",
              [{ text: "Go Back", onPress: () => router.back() }]
            );
            return;
          }
        } else if (typeof selectedCleanerParam === "object") {
          cleaner = selectedCleanerParam as Cleaner;
        }
      }

      if (!cleaner) {
        console.error("No cleaner found in route params");
        Alert.alert(
          "Error",
          "No dry cleaner selected. Please select a dry cleaner first.",
          [{ text: "Go Back", onPress: () => router.back() }]
        );
        return;
      }

      // Validate cleaner data
      if (!cleaner._id || !cleaner.shopname) {
        console.error("Invalid cleaner data structure:", cleaner);
        Alert.alert(
          "Error",
          "Invalid dry cleaner data. Please select a dry cleaner again.",
          [{ text: "Go Back", onPress: () => router.back() }]
        );
        return;
      }

      console.log("Initializing with cleaner:", {
        id: cleaner._id,
        name: cleaner.shopname,
      });

      // Only update selectedCleaner if it's different
      if (!selectedCleaner || selectedCleaner._id !== cleaner._id) {
        setSelectedCleaner(cleaner);
        setHasFetchedServices(false);
      }
    };

    initializeCleaner();
  }, [params, router]);

  // Fetch services when selectedCleaner changes
  useEffect(() => {
    const fetchServices = async () => {
      if (!selectedCleaner || hasFetchedServices) {
        return;
      }

      console.log("Fetching services for cleaner:", selectedCleaner.shopname);
      await fetchSelectedCleanerServices(selectedCleaner);
      setHasFetchedServices(true);
    };

    fetchServices();
  }, [selectedCleaner, hasFetchedServices, fetchSelectedCleanerServices]);

  // Category selection - NOW FUNCTIONAL
  const handleCategorySelection = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  // Delete item (reset quantity to 0)
  const deleteItem = useCallback((id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item._id === id ? { ...item, quantity: 0 } : item
      )
    );
    console.log("Item deleted:", id);
  }, []);

  // Update quantity
  const updateQuantity = useCallback((id: string, increment: boolean) => {
    setItems((prevItems) => {
      const newItems = prevItems.map((item) => {
        if (item._id === id) {
          const newQuantity = increment
            ? item.quantity + 1
            : Math.max(0, item.quantity - 1);

          console.log("Updated quantity:", { id, newQuantity });

          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      return newItems;
    });
  }, []);

  // Update wash only option
  const updateWashOnly = useCallback(
    (value: string) => {
      if (selectedItemId) {
        const washOnly = value === "Yes";
        setItems((prevItems) =>
          prevItems.map((item) =>
            item._id === selectedItemId ? { ...item, washOnly } : item
          )
        );
        setShowWashOnlyModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId]
  );

  // Update starch level
  const updateStarchLevel = useCallback(
    (value: string) => {
      if (selectedItemId) {
        const starchLevelMap: { [key: string]: number } = {
          None: 1,
          Light: 2,
          Medium: 3,
          Heavy: 4,
        };
        const starchLevel = starchLevelMap[value] || 3;
        setItems((prevItems) =>
          prevItems.map((item) =>
            item._id === selectedItemId ? { ...item, starchLevel } : item
          )
        );
        setShowStarchLevelModal(false);
        setSelectedItemId(null);
      }
    },
    [selectedItemId]
  );

  // Toggle additional options
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
      })
    );
  }, []);

  // Get starch level text
  const getStarchLevelText = useCallback((level: number): string => {
    const starchLevels: { [key: number]: string } = {
      1: "None",
      2: "Light",
      3: "Medium",
      4: "Heavy",
    };
    return starchLevels[level] || "Medium";
  }, []);

  // Check if item has option
  const hasOption = useCallback(
    (item: ServiceItem, optionName: string): boolean => {
      if (
        !item.options ||
        typeof item.options !== "object" ||
        Array.isArray(item.options)
      ) {
        return false;
      }
      return item.options.hasOwnProperty(optionName);
    },
    []
  );

  // Get option value
  const getOptionValue = useCallback(
    (item: ServiceItem, optionName: string): boolean => {
      if (!hasOption(item, optionName)) {
        return false;
      }
      return Boolean(item.options[optionName as keyof typeof item.options]);
    },
    [hasOption]
  );

  // Calculate totals
  const { totalItems, totalAmount } = useMemo(() => {
    const totalItems = items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );
    return { totalItems, totalAmount };
  }, [items]);

  // Filter items based on category
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    if (selectedCategory === "All") {
      return items;
    }

    return items.filter(
      (item) => item.category === selectedCategory || (item.quantity || 0) > 0
    );
  }, [items, selectedCategory]);

  const handleContinue = useCallback(() => {
    if (totalItems === 0) {
      Alert.alert(
        "No Items Selected",
        "Please add at least one item to continue."
      );
      return;
    }

    const selectedItemsForOrder = items.filter((item) => item.quantity > 0);

    console.log("Final Order Summary:", {
      totalItems,
      totalAmount: totalAmount.toFixed(2),
      selectedCleaner: selectedCleaner?.shopname,
      items: selectedItemsForOrder.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        washOnly: item.washOnly,
        starchLevel: getStarchLevelText(item.starchLevel),
        options: item.options,
      })),
    });

    try {
      // Save cleaner
      if (selectedCleaner) {
        const cleanerData = {
          _id: selectedCleaner._id,
          shopname: selectedCleaner.shopname,
          address: selectedCleaner.address || {},
          rating: selectedCleaner.rating || 0,
          phoneNumber: selectedCleaner.phoneNumber || "",
          hoursOfOperation: selectedCleaner.hoursOfOperation || [],
        };
        dispatch(setSelectedCleanerRedux(cleanerData));
        console.log("✅ Cleaner saved");
      }

      // Save order data
      const orderData = {
        items: selectedItemsForOrder.map((item) => ({
          _id: item._id,
          name: item.name,
          category: item.category,
          price: item.price,
          quantity: item.quantity,
          starchLevel: item.starchLevel,
          washOnly: item.washOnly,
          additionalservice: item.additionalservice || "",
          dryCleanerId: item.dryCleanerId || "",
          dryCleanerName: item.dryCleanerName || "",
          options: {
            washAndFold: item.options?.washAndFold || false,
            button: item.options?.button || false,
            zipper: item.options?.zipper || false,
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
        totalAmount: totalAmount,
        totalItems: totalItems,
        lastUpdated: new Date().toISOString(),
      };

      dispatch(saveOrderData(orderData));
      console.log("✅ Order data saved to Redux");

      // Navigate with a small delay to ensure Redux state is updated
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
    getStarchLevelText,
    dispatch,
    router,
  ]);

  // Loading state
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
            {totalItems} items • ${totalAmount.toFixed(2)}
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
                ? `No services available from ${
                    selectedCleaner?.shopname || "this dry cleaner"
                  }`
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
          filteredItems.map((item, index) => (
            <View key={`${item._id}-${index}`} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                {item.quantity > 0 &&
                  item.category !== selectedCategory &&
                  selectedCategory !== "All" && (
                    <Text style={styles.categoryBadge}>{item.category}</Text>
                  )}
              </View>

              <View style={styles.optionsContainer}>
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
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => {
                      setSelectedItemId(item._id);
                      setShowStarchLevelModal(true);
                    }}
                  >
                    <Text style={styles.dropdownText}>
                      Starch Level: {getStarchLevelText(item.starchLevel)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.checkboxContainer}>
                  {hasOption(item, "zipper") && (
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        getOptionValue(item, "zipper") &&
                          styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, "zipper")}
                    >
                      <View style={styles.checkboxInner}>
                        {getOptionValue(item, "zipper") && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>Zipper</Text>
                    </TouchableOpacity>
                  )}
                  {hasOption(item, "button") && (
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        getOptionValue(item, "button") &&
                          styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, "button")}
                    >
                      <View style={styles.checkboxInner}>
                        {getOptionValue(item, "button") && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>Button</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      getOptionValue(item, "washAndFold") &&
                        styles.checkboxChecked,
                    ]}
                    onPress={() => toggleOption(item._id, "washAndFold")}
                  >
                    <View style={styles.checkboxInner}>
                      {getOptionValue(item, "washAndFold") && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.checkboxText}>Wash & Fold</Text>
                  </TouchableOpacity>
                </View>

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
          ))
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
          Continue {totalItems > 0 && `(${totalItems} items)`}
        </Text>
      </TouchableOpacity>

      {/* Wash Only Modal */}
      <Modal
        visible={showWashOnlyModal}
        transparent={true}
        animationType="slide"
      >
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
      <Modal
        visible={showStarchLevelModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starch Level</Text>
            {starchLevelOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => updateStarchLevel(option)}
              >
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowStarchLevelModal(false)}
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
  container: {
    flex: 1,
    backgroundColor: "#F7F7FA",
    paddingTop: 40,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 0,
    paddingTop: 10,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 50,
    marginTop: -35,
  },
  title: {
    fontSize: 25,
    fontWeight: "400",
    color: "#000000",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "300",
    color: "#666666",
    marginTop: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
  },
  orderSummary: {
    backgroundColor: "#FF8C00",
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  orderSummaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  categoriesWrapper: {
    marginBottom: 20,
  },
  categoriesContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
  },
  categoriesContentContainer: {
    paddingRight: 20,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#666666",
    borderRadius: 8,
    marginHorizontal: 4,
    justifyContent: "center",
    minWidth: 60,
  },
  categoryButtonActive: {
    backgroundColor: "#FF8C00",
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
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
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    flexWrap: "wrap",
  },
  itemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF8C00",
  },
  categoryBadge: {
    fontSize: 12,
    color: "#FF8C00",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  optionsContainer: {
    gap: 15,
  },
  dropdownContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dropdown: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
  },
  dropdownText: {
    color: "#666",
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#F5F5F5",
  },
  checkmark: {
    color: "#FF8C00",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxText: {
    color: "#666",
    fontSize: 14,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  quantityButtonText: {
    fontSize: 18,
    color: "#000000",
    fontWeight: "bold",
  },
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  continueButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
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
    marginBottom: 15,
    textAlign: "center",
  },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#FF8C00",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AvailableServicesScreen;
