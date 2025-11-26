import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import {
  saveOrderData,
  updateItemQuantity,
  removeOrderItem,
  updateItemOptions,
  setSelectedCategory,
  setLoading,
  initializeUserData,
} from '../../components/redux/userSlice';

const AvailableServicesScreen = () => {
  // Local state
  const [items, setItems] = useState([]);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [showWashOnlyModal, setShowWashOnlyModal] = useState(false);
  const [showStarchLevelModal, setShowStarchLevelModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();

  // Use ref to prevent infinite fetching
  const hasFetchedRef = useRef(false);

  // Get ALL Redux state at the top level
  const reduxState = useSelector((state) => {
    return {
      order: state.user?.order || null,
      selectedCategory: state.user?.selections?.selectedCategory || 'All',
      selectedItems: state.user?.selections?.selectedItems || [],
      userInteractions: state.user?.selections?.userInteractions || [],
      isLoading: state.user?.ui?.isLoading || false,
      reduxCleaner: state.user?.selectedCleaner || null
    };
  });

  const { order: orderData, selectedCategory, selectedItems, userInteractions, isLoading, reduxCleaner } = reduxState;

  // Categories and options
  const categories = [
    'All',
    'Blanket',
    'Blouse/Tops',
    'Coat',
    'Comforter',
    'Duvet Cover',
    'Pants',
  ];

  const washOnlyOptions = ['Yes', 'No'];
  const starchLevelOptions = ['None', 'Light', 'Medium', 'Heavy'];

  // Helper function to validate and sanitize item data
  const validateItemData = useCallback((item) => {
    const validatedItem = {
      _id: item._id || `temp_${Date.now()}_${Math.random()}`,
      name: item.name || 'Unknown Item',
      price: typeof item.price === 'number' ? item.price : 0,
      quantity: typeof item.quantity === 'number' ? item.quantity : 0,
      category: item.category || 'All',
      starchLevel: typeof item.starchLevel === 'number' ? item.starchLevel : (typeof item.strachLevel === 'number' ? item.strachLevel : 3),
      washOnly: typeof item.washOnly === 'boolean' ? item.washOnly : false,
      additionalservice: item.additionalservice || null,
      dryCleanerId: item.dryCleanerId || null,
      dryCleanerName: item.dryCleanerName || '',
    };

    const safeOptions = {
      washAndFold: false,
    };

    if (item.options && typeof item.options === 'object' && !Array.isArray(item.options) && item.options !== null) {
      try {
        for (const key in item.options) {
          if (item.options.hasOwnProperty(key) && typeof item.options[key] === 'boolean') {
            safeOptions[key] = item.options[key];
          }
        }
      } catch (error) {
        console.warn('Error processing item options:', error);
      }
    }

    if (validatedItem.additionalservice === 'button') {
      safeOptions.button = safeOptions.button || false;
    }
    if (validatedItem.additionalservice === 'zipper') {
      safeOptions.zipper = safeOptions.zipper || false;
    }

    validatedItem.options = safeOptions;
    return validatedItem;
  }, []);

  // FIXED: Simplified API call without items dependency
  const fetchSelectedCleanerServices = useCallback(async (cleaner) => {
    // Prevent multiple fetches for the same cleaner
    if (hasFetchedRef.current === cleaner._id) {
      console.log('Already fetched services for this cleaner, skipping...');
      return;
    }

    try {
      dispatch(setLoading(true));
      console.log(`Fetching services for cleaner: ${cleaner.shopname} (ID: ${cleaner._id})`);

      const apiUrl = `https://vervoer-backend2.onrender.com/api/users/dry-cleaners/${cleaner._id}/services`;
      console.log(`Attempting to fetch from: ${apiUrl}`);

      const servicesResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!servicesResponse.ok) {
        throw new Error(`HTTP ${servicesResponse.status}: ${servicesResponse.statusText}`);
      }

      const servicesData = await servicesResponse.json();
      console.log('Services API Response:', servicesData);

      let services = [];
      
      if (servicesData.data && Array.isArray(servicesData.data)) {
        services = servicesData.data;
      } else if (servicesData.services && Array.isArray(servicesData.services)) {
        services = servicesData.services;
      } else if (Array.isArray(servicesData)) {
        services = servicesData;
      } else {
        console.warn('Unexpected API response structure:', servicesData);
        services = [];
      }

      if (services.length === 0) {
        Alert.alert(
          'Notice',
          `No services available from ${cleaner.shopname} at this time.`,
        );
        setItems([]);
        return;
      }

      // Convert services to items format - REMOVED existing quantities logic to break the loop
      const cleanerServices = services.map((service) => {
        const baseOptions = {
          washAndFold: false,
        };

        if (service.additionalservice === 'button') {
          baseOptions.button = false;
        }
        if (service.additionalservice === 'zipper') {
          baseOptions.zipper = false;
        }

        return {
          ...service,
          quantity: 0, // Always start with 0 to break the loop
          dryCleanerId: cleaner._id,
          dryCleanerName: cleaner.shopname,
          options: baseOptions,
        };
      });

      const validatedServices = cleanerServices.map(validateItemData);
      setItems(validatedServices);

      dispatch(initializeUserData({
        items: validatedServices,
        selectedCleaner: cleaner,
      }));

      console.log(`Successfully loaded ${validatedServices.length} services from ${cleaner.shopname}`);
      hasFetchedRef.current = cleaner._id; // Mark as fetched
      setIsInitialized(true);

    } catch (error) {
      console.error('Error fetching services:', error);
      
      let errorMessage = 'Failed to load services';
      
      if (error.message.includes('Network Error') || error.name === 'TypeError') {
        errorMessage = 'Cannot connect to server. Please check your internet connection and make sure the server is running.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Services not found for this dry cleaner.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      }

      Alert.alert('Connection Error', errorMessage, [
        {
          text: 'Try Again',
          onPress: () => fetchSelectedCleanerServices(cleaner),
        },
        {
          text: 'Go Back',
          onPress: () => router.back(),
        }
      ]);

      setItems([]);
      
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, validateItemData, router]); // REMOVED items dependency

  // FIXED: Simplified initialization with minimal dependencies
  useEffect(() => {
    console.log('=== INITIALIZING AVAILABLE SERVICES SCREEN ===');
    console.log('Route params:', params);
    
    let cleaner = null;

    // Method 1: Check route params first
    if (params.selectedCleaner) {
      try {
        cleaner = typeof params.selectedCleaner === 'string' 
          ? JSON.parse(params.selectedCleaner)
          : params.selectedCleaner;
        console.log('Cleaner from route params:', cleaner);
      } catch (error) {
        console.error('Error parsing cleaner from params:', error);
      }
    }
    
    // Method 2: Check Redux store
    if (!cleaner && reduxCleaner) {
      cleaner = reduxCleaner;
      console.log('Cleaner from Redux:', cleaner);
    }

    if (!cleaner) {
      console.error('NO CLEANER FOUND!');
      Alert.alert(
        'Error',
        'No dry cleaner selected. Please select a dry cleaner first.',
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
          },
        ],
      );
      return;
    }

    // Only initialize if we haven't already or if cleaner changed
    if (!selectedCleaner || selectedCleaner._id !== cleaner._id) {
      console.log('Setting new cleaner and fetching services:', cleaner.shopname);
      setSelectedCleaner(cleaner);
      
      // Reset fetch flag for new cleaner
      if (selectedCleaner?._id !== cleaner._id) {
        hasFetchedRef.current = null;
      }
      
      fetchSelectedCleanerServices(cleaner);
    }
  }, [params.selectedCleaner, reduxCleaner]); // FIXED: Only depend on these two

  // All the same functions from your App component (keeping them the same)
  const handleCategorySelection = useCallback((category) => {
    console.log('Category Selection:', {
      previousCategory: selectedCategory,
      newCategory: category,
      timestamp: new Date().toISOString(),
    });
    
    if (selectedCategory !== category) {
      dispatch(setSelectedCategory(category));
    }
  }, [selectedCategory, dispatch]);

  const deleteItem = useCallback((id) => {
    const item = items.find(item => item._id === id);
    console.log('Item Reset:', {
      itemId: id,
      itemName: item?.name,
      timestamp: new Date().toISOString(),
    });

    setItems(prevItems => 
      prevItems.map(item => 
        item._id === id ? { ...item, quantity: 0 } : item
      )
    );
    dispatch(removeOrderItem(id));
  }, [items, dispatch]);

  const updateQuantity = useCallback((id, increment) => {
    console.log('Update quantity called:', { id, increment, currentItemsLength: items.length });
    
    setItems(prevItems => {
      const newItems = prevItems.map(item => {
        if (item._id === id) {
          const oldQuantity = item.quantity;
          const newQuantity = increment
            ? oldQuantity + 1
            : Math.max(0, oldQuantity - 1);

          console.log('Quantity update:', {
            itemName: item.name,
            oldQuantity,
            newQuantity
          });

          return {
            ...item,
            quantity: newQuantity,
          };
        }
        return { ...item };
      });

      const updatedItem = newItems.find(item => item._id === id);
      if (updatedItem) {
        setTimeout(() => {
          dispatch(updateItemQuantity({
            itemId: id,
            quantity: updatedItem.quantity,
            itemName: updatedItem.name,
          }));
        }, 0);
      }

      return newItems;
    });
  }, [dispatch]);

  const updateWashOnly = useCallback((value) => {
    if (selectedItemId) {
      const washOnly = value === 'Yes';
      
      setItems(prevItems => {
        const item = prevItems.find(item => item._id === selectedItemId);
        
        dispatch(updateItemOptions({
          itemId: selectedItemId,
          washOnly,
          itemName: item?.name,
        }));

        return prevItems.map(item =>
          item._id === selectedItemId ? {...item, washOnly} : item,
        );
      });

      setShowWashOnlyModal(false);
      setSelectedItemId(null);
    }
  }, [selectedItemId, dispatch]);

  const updateStarchLevel = useCallback((value) => {
    if (selectedItemId) {
      const starchLevelMap = {
        None: 1,
        Light: 2,
        Medium: 3,
        Heavy: 4,
      };

      const starchLevel = starchLevelMap[value] || 3;
      
      setItems(prevItems => {
        const item = prevItems.find(item => item._id === selectedItemId);

        dispatch(updateItemOptions({
          itemId: selectedItemId,
          starchLevel,
          itemName: item?.name,
        }));

        return prevItems.map(item =>
          item._id === selectedItemId ? {...item, starchLevel} : item,
        );
      });

      setShowStarchLevelModal(false);
      setSelectedItemId(null);
    }
  }, [selectedItemId, dispatch]);

  const toggleOption = useCallback((itemId, optionName) => {
    setItems(prevItems => {
      return prevItems.map(item => {
        if (item._id === itemId) {
          const currentOptions = (item.options && 
                                typeof item.options === 'object' && 
                                !Array.isArray(item.options) && 
                                item.options !== null) ? item.options : {};
          
          const oldValue = currentOptions.hasOwnProperty(optionName) ? currentOptions[optionName] : false;
          const newValue = !oldValue;

          const newOptions = {
            ...currentOptions,
            [optionName]: newValue,
          };

          dispatch(updateItemOptions({
            itemId,
            options: { [optionName]: newValue },
            itemName: item.name,
          }));

          return {
            ...item,
            options: newOptions,
          };
        }
        return item;
      });
    });
  }, [dispatch]);

  const getStarchLevelText = useCallback((level) => {
    const starchLevels = {
      1: 'None',
      2: 'Light',
      3: 'Medium',
      4: 'Heavy',
      5: 'Extra Heavy',
    };
    return starchLevels[level] || 'Medium';
  }, []);

  const hasOption = useCallback((item, optionName) => {
    if (!item.options || 
        typeof item.options !== 'object' || 
        Array.isArray(item.options) || 
        item.options === null) {
      return false;
    }
    
    try {
      return item.options.hasOwnProperty(optionName);
    } catch (error) {
      console.warn('Error checking option:', error);
      return false;
    }
  }, []);

  const getOptionValue = useCallback((item, optionName) => {
    if (!hasOption(item, optionName)) {
      return false;
    }
    
    try {
      return Boolean(item.options[optionName]);
    } catch (error) {
      console.warn('Error getting option value:', error);
      return false;
    }
  }, [hasOption]);

  // Redux update effect - simplified
  useEffect(() => {
    if (!isInitialized || items.length === 0 || !selectedCleaner) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const orderItems = items
        .filter(item => item.quantity > 0)
        .map(item => ({
          _id: item._id,
          name: item.name,
          category: item.category,
          starchLevel: item.starchLevel || 3,
          washOnly: item.washOnly || false,
          additionalservice: item.additionalservice,
          price: item.price,
          quantity: item.quantity,
          dryCleanerId: item.dryCleanerId,
          dryCleanerName: item.dryCleanerName,
          options: (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) 
            ? { ...item.options }
            : { washAndFold: false },
        }));

      const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const newOrderData = {
        items: orderItems,
        selectedCleaner: {
          _id: selectedCleaner._id,
          shopname: selectedCleaner.shopname,
          address: selectedCleaner.address,
          rating: selectedCleaner.rating,
          phoneNumber: selectedCleaner.phoneNumber,
        },
        totalAmount,
        totalItems,
        lastUpdated: new Date().toISOString(),
      };

      console.log('Order Data Updated:', {
        totalItems,
        totalAmount,
        selectedCleaner: selectedCleaner.shopname,
        numberOfDifferentItems: orderItems.length,
      });

      dispatch(saveOrderData(newOrderData));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [items, selectedCleaner, isInitialized, dispatch]);

  // Filtered items
  const filteredItems = useMemo(() => {
    console.log('Filtering items:', {
      totalItems: items.length,
      selectedCategory,
      itemsWithQuantity: items.filter(item => item.quantity > 0).length
    });
    
    if (!items || items.length === 0) {
      return [];
    }
    
    let filtered;
    if (selectedCategory === 'All') {
      filtered = [...items];
    } else {
      filtered = items.filter(item => 
        item.category === selectedCategory || item.quantity > 0
      );
    }
    
    return filtered;
  }, [items, selectedCategory]);

  const { totalItems, totalAmount } = useMemo(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    return { totalItems, totalAmount };
  }, [items]);

  const handleContinue = useCallback(() => {
    const selectedItemsForOrder = items.filter(item => item.quantity > 0);

    console.log('Final Order Summary:', {
      totalItems: totalItems,
      totalAmount: totalAmount.toFixed(2),
      selectedCleaner: selectedCleaner?.shopname,
      finalSelections: selectedItemsForOrder.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        washOnly: item.washOnly,
        starchLevel: getStarchLevelText(item.starchLevel),
        options: item.options || {},
        lineTotal: (item.price * item.quantity).toFixed(2),
      })),
    });

    if (totalItems === 0) {
      Alert.alert(
        'No Items Selected',
        'Please add at least one item to continue.',
      );
      return;
    }

    router.push('/dryCleanerUser/pickUpLocation');
  }, [items, totalItems, totalAmount, selectedCleaner, getStarchLevelText, router]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/dryCleanerUser/dryCleanersList');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.brandColor} />
        <Text style={styles.title}>Loading services...</Text>
        {selectedCleaner && (
          <Text style={styles.loadingSubtext}>
            From {selectedCleaner.shopname}
          </Text>
        )}
      </View>
    );
  }

  // ... rest of your JSX return remains exactly the same as before
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Available Services</Text>
          {selectedCleaner && (
            <Text style={styles.subtitle}>From {selectedCleaner.shopname}</Text>
          )}
        </View>
      </View>

      {totalItems > 0 && (
        <View style={styles.orderSummary}>
          <Text style={styles.orderSummaryText}>
            {totalItems} items • ${totalAmount.toFixed(2)}
          </Text>
          {selectedItems.length > 0 && (
            <Text style={styles.orderSummarySubtext}>
              {selectedItems.length} different items selected
            </Text>
          )}
        </View>
      )}

      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                category === selectedCategory && styles.categoryButtonActive,
              ]}
              onPress={() => handleCategorySelection(category)}>
              <Text
                style={[
                  styles.categoryText,
                  category === selectedCategory && styles.categoryTextActive,
                ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.itemsContainer}>
        {filteredItems.length === 0 ? (
          <View style={styles.noItemsContainer}>
            <Text style={styles.noItemsText}>
              {items.length === 0
                ? `No services available from ${
                    selectedCleaner?.shopname || 'this dry cleaner'
                  }`
                : 'No services available in this category'}
            </Text>
            {items.length === 0 && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => selectedCleaner && fetchSelectedCleanerServices(selectedCleaner)}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredItems.map((item, index) => (
            <View key={`${item._id}-${item.dryCleanerId}-${index}`} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                {item.quantity > 0 && item.category !== selectedCategory && selectedCategory !== 'All' && (
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
                    }}>
                    <Text style={styles.dropdownText}>
                      Wash Only: {item.washOnly ? 'Yes' : 'No'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => {
                      setSelectedItemId(item._id);
                      setShowStarchLevelModal(true);
                    }}>
                    <Text style={styles.dropdownText2}>
                      Starch Level: {getStarchLevelText(item.starchLevel)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.checkboxContainer}>
                  {hasOption(item, 'zipper') && (
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        getOptionValue(item, 'zipper') && styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, 'zipper')}>
                      <View style={styles.checkboxInner}>
                        {getOptionValue(item, 'zipper') && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>Zipper</Text>
                    </TouchableOpacity>
                  )}
                  {hasOption(item, 'button') && (
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        getOptionValue(item, 'button') && styles.checkboxChecked,
                      ]}
                      onPress={() => toggleOption(item._id, 'button')}>
                      <View style={styles.checkboxInner}>
                        {getOptionValue(item, 'button') && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>Button</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      getOptionValue(item, 'washAndFold') && styles.checkboxChecked,
                    ]}
                    onPress={() => toggleOption(item._id, 'washAndFold')}>
                    <View style={styles.checkboxInner}>
                      {getOptionValue(item, 'washAndFold') && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.checkboxText}>Wash & Fold</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item._id, true)}>
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item._id, false)}>
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteItem(item._id)}>
                  <Image
                    source={images.delete}
                    style={styles.deleteButtonImage}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>

      <Modal
        visible={showWashOnlyModal}
        transparent={true}
        animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Wash Only</Text>
            {washOnlyOptions.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => updateWashOnly(option)}>
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowWashOnlyModal(false)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showStarchLevelModal}
        transparent={true}
        animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starch Level</Text>
            {starchLevelOptions.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => updateStarchLevel(option)}>
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowStarchLevelModal(false)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ... keep your existing styles exactly the same

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7FA',
    paddingTop: 60,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 50,
    marginTop: -35,
  },
  title: {
    fontSize: 25,
    fontWeight: '400',
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#666666',
    marginTop: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  orderSummary: {
    backgroundColor: '#F99026',
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  orderSummaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  orderSummarySubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
  },
  categoriesWrapper: {
    marginBottom: 30,
  },
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    height: 35,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#666666',
    borderRadius: 8,
    marginHorizontal: 4,
    height: 32,
    justifyContent: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#FF8C00',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -10,
  },
  noItemsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  noItemsText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '400',
    color: '#F99026',
    marginRight: 50,
  },
  categoryBadge: {
    fontSize: 12,
    color: '#FF8C00',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  optionsContainer: {
    gap: 15,
    paddingRight: 80,
    paddingBottom: 15, 
  },
  dropdownContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdown: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
  },
  dropdownText: {
    color: '#666',
    left: -10,
  },
  dropdownText2: {
    color: '#666',
    left: -50,
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#F5F5F5',
  },
  checkmark: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    color: '#666',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: -28,
    top: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 4,
    transform: [{rotate: '90deg'}],
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    color: '#000000',
    transform: [{rotate: '90deg'}],
  },
  quantityText: {
    marginHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    transform: [{rotate: '270deg'}],
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    bottom: -8,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonImage: {
    height: 27,
    width: 27,
  },
  continueButton: {
    backgroundColor: '#FF8C00',
    margin: 20,
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AvailableServicesScreen;