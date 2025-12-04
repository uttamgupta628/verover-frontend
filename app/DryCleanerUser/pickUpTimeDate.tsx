import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconButton } from 'react-native-paper';
import colors from '../../assets/color';
import { useDispatch, useSelector } from 'react-redux';
import { Dropdown } from 'react-native-element-dropdown';
import { 
  saveSchedulingData, 
  SchedulingData,
  saveOrderData,
  OrderData,
  disableOrderProtection,
} from '../../components/redux/userSlice';

const { width, height } = Dimensions.get('window');

interface OrderItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  starchLevel: number;
  washOnly: boolean;
  additionalservice?: string;
  dryCleanerId?: string;
  dryCleanerName?: string;
  options: {
    washAndFold: boolean;
    button: boolean;
    zipper: boolean;
  };
}

const PickupDeliveryScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();
  
  // Get ALL data from Redux with better error handling
  const userState = useSelector((state: any) => state.user);
  const savedScheduling = userState?.scheduling;
  const existingOrder = userState?.order;
  const selectedItems = userState?.selections?.selectedItems || [];
  const selectedCleaner = userState?.order?.selectedCleaner || userState?.selections?.selectedCleaner;

  // Get route params for fallback data
  const { 
    pickupAddress,
    selectedAddressType,
    dryCleanerId,
    dryCleanerName 
  } = params as any;

  // Use ref to track the latest state
  const stateRef = useRef({
    existingOrder,
    selectedItems,
    selectedCleaner,
    userState
  });

  // Update ref when state changes
  useEffect(() => {
    stateRef.current = {
      existingOrder,
      selectedItems,
      selectedCleaner,
      userState
    };
  }, [existingOrder, selectedItems, selectedCleaner, userState]);

  // Debug current state on mount
  useEffect(() => {
    console.log('🚀 PickupDeliveryScreen mounted with data:', {
      hasExistingOrder: !!existingOrder,
      existingOrderItems: existingOrder?.items?.length || 0,
      selectedItemsCount: selectedItems.length,
      hasSelectedCleaner: !!selectedCleaner,
      routeParams: params
    });
  }, []);

  // State with initial values from Redux if available
  const [selectedPickupDate, setSelectedPickupDate] = useState<string>(
    savedScheduling?.pickupDate || '03'
  );
  const [selectedPickupTime, setSelectedPickupTime] = useState<string>(
    savedScheduling?.pickupTime || '10:00AM'
  );
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string>(
    savedScheduling?.deliveryDate || '04'
  );
  const [selectedDeliveryTime, setSelectedDeliveryTime] = useState<string>(
    savedScheduling?.deliveryTime || '04:00PM'
  );
  const [pickupMonth, setPickupMonth] = useState<string>(
    savedScheduling?.pickupMonth || 'November'
  );
  const [deliveryMonth, setDeliveryMonth] = useState<string>(
    savedScheduling?.deliveryMonth || 'November'
  );

  const dates: string[] = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  ];
  
  const pickupTimes: string[] = ['08:00AM', '09:00AM', '10:00AM', '11:00AM', '12:00PM'];
  const deliveryTimes: string[] = ['01:00PM', '02:00PM', '03:00PM', '04:00PM', '05:00PM'];
  
  const months: { label: string; value: string }[] = [
    { label: 'January', value: 'January' },
    { label: 'February', value: 'February' },
    { label: 'March', value: 'March' },
    { label: 'April', value: 'April' },
    { label: 'May', value: 'May' },
    { label: 'June', value: 'June' },
    { label: 'July', value: 'July' },
    { label: 'August', value: 'August' },
    { label: 'September', value: 'September' },
    { label: 'October', value: 'October' },
    { label: 'November', value: 'November' },
    { label: 'December', value: 'December' },
  ];

  // Save scheduling data to Redux
  const saveToRedux = () => {
    const schedulingData: SchedulingData = {
      pickupDate: selectedPickupDate,
      pickupTime: selectedPickupTime,
      pickupMonth: pickupMonth,
      deliveryDate: selectedDeliveryDate,
      deliveryTime: selectedDeliveryTime,
      deliveryMonth: deliveryMonth,
      lastUpdated: new Date().toISOString(),
    };
    
    dispatch(saveSchedulingData(schedulingData));
    console.log('📅 Scheduling data saved to Redux:', schedulingData);
  };

  // Save to Redux whenever state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToRedux();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selectedPickupDate, selectedPickupTime, pickupMonth, selectedDeliveryDate, selectedDeliveryTime, deliveryMonth]);

  // Create a mock order for testing/demo purposes
  const createMockOrder = (): OrderData => {
    console.log('🛠️ Creating mock order for demo purposes');
    
    return {
      items: [
        {
          _id: 'mock-item-1',
          name: 'Shirt',
          category: 'Clothing',
          price: 80,
          quantity: 2,
          starchLevel: 3,
          washOnly: false,
          additionalservice: 'Normal Wash',
          dryCleanerId: dryCleanerId || 'mock-cleaner-1',
          dryCleanerName: dryCleanerName || 'Demo Dry Cleaner',
          options: {
            washAndFold: true,
            button: false,
            zipper: false,
          },
        }
      ],
      selectedCleaner: selectedCleaner || {
        _id: dryCleanerId || 'mock-cleaner-1',
        shopname: dryCleanerName || 'Demo Dry Cleaner',
        address: pickupAddress || 'Demo Address',
        rating: 4.5,
        phoneNumber: '+1234567890',
      },
      totalAmount: 160,
      totalItems: 2,
      lastUpdated: new Date().toISOString(),
    };
  };

  // Enhanced handleContinue with better error handling and fallbacks
  const handleContinue = () => {
    console.log('🔄 handleContinue called');
    
    // Use the ref to get the latest state
    const { 
      existingOrder: latestOrder, 
      selectedItems: latestSelectedItems,
      selectedCleaner: latestCleaner,
      userState: latestUserState 
    } = stateRef.current;
    
    console.log('📦 Current state analysis:', {
      hasExistingOrder: !!latestOrder,
      existingOrderItems: latestOrder?.items?.length || 0,
      hasSelectedItems: latestSelectedItems?.length > 0,
      selectedItemsCount: latestSelectedItems?.length || 0,
      hasUserState: !!latestUserState,
      hasPickupAddress: !!pickupAddress
    });

    // Save scheduling data first
    saveToRedux();

    let orderDataToSave: OrderData | null = null;

    // CASE 1: We have existing order data - use it
    if (latestOrder?.items?.length > 0) {
      console.log('✅ Using existing order data');
      orderDataToSave = {
        ...latestOrder,
        lastUpdated: new Date().toISOString(),
      };
    }
    // CASE 2: No order data but we have selected items with quantity - build from selectedItems
    else if (latestSelectedItems?.some((item: any) => item.quantity > 0)) {
      console.log('🔄 Building order from selected items');
      
      const itemsWithQuantity = latestSelectedItems.filter((item: any) => item.quantity > 0);
      console.log('📝 Items with quantity:', itemsWithQuantity);
      
      // Calculate totals
      const totalItems = itemsWithQuantity.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const totalAmount = itemsWithQuantity.reduce((sum: number, item: any) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (price * quantity);
      }, 0);

      console.log('💰 Calculated totals:', { totalItems, totalAmount });

      // Create proper order structure
      orderDataToSave = {
        items: itemsWithQuantity.map((item: any) => ({
          _id: item.id || item._id || `temp-${Date.now()}-${Math.random()}`,
          name: item.name || 'Unknown Item',
          category: item.category || 'general',
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity) || 1,
          starchLevel: item.starchLevel || item.strachLevel || 3,
          washOnly: item.washOnly || false,
          additionalservice: item.additionalservice || '',
          dryCleanerId: item.dryCleanerId,
          dryCleanerName: item.dryCleanerName,
          options: item.options || {
            washAndFold: false,
            button: false,
            zipper: false,
          },
        })),
        selectedCleaner: latestCleaner || latestOrder?.selectedCleaner,
        totalAmount: totalAmount,
        totalItems: totalItems,
        lastUpdated: new Date().toISOString(),
      };
    }
    // CASE 3: Check if we have items in selections that can be converted
    else if (latestUserState?.selections?.selectedItems?.some((item: any) => item.quantity > 0)) {
      console.log('🔍 Found items in userState selections');
      const selectionItems = latestUserState.selections.selectedItems.filter((item: any) => item.quantity > 0);
      
      const totalItems = selectionItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const totalAmount = selectionItems.reduce((sum: number, item: any) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (price * quantity);
      }, 0);

      orderDataToSave = {
        items: selectionItems.map((item: any) => ({
          _id: item.id || item._id || `temp-${Date.now()}-${Math.random()}`,
          name: item.name || 'Unknown Item',
          category: item.category || 'general',
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity) || 1,
          starchLevel: item.starchLevel || item.strachLevel || 3,
          washOnly: item.washOnly || false,
          additionalservice: item.additionalservice || '',
          dryCleanerId: item.dryCleanerId,
          dryCleanerName: item.dryCleanerName,
          options: item.options || {
            washAndFold: false,
            button: false,
            zipper: false,
          },
        })),
        selectedCleaner: latestCleaner || latestUserState?.order?.selectedCleaner,
        totalAmount: totalAmount,
        totalItems: totalItems,
        lastUpdated: new Date().toISOString(),
      };
    }
    else {
      console.warn('⚠️ No order data found - showing options to user');
      
      Alert.alert(
        'No Items in Order',
        'You need to add items to your order before scheduling pickup. What would you like to do?',
        [
          {
            text: 'Add Items Now',
            onPress: () => {
              // Navigate back to item selection
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push('/dryCleanerUser/noOfItem');
              }
            },
          },
          {
            text: 'Use Demo Order',
            onPress: () => {
              console.log('🎭 User chose demo order');
              const demoOrder = createMockOrder();
              saveOrderAndNavigate(demoOrder);
            },
            style: 'destructive',
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    // Validate the order data before saving
    if (!orderDataToSave || orderDataToSave.totalItems === 0 || orderDataToSave.totalAmount === 0) {
      console.error('❌ Invalid order data created:', orderDataToSave);
      Alert.alert(
        'Invalid Order',
        'Your order appears to be empty. Please add items before proceeding.',
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
          },
          {
            text: 'Add Items',
            onPress: () => router.push('/dryCleanerUser/noOfItem'),
          },
        ]
      );
      return;
    }

    saveOrderAndNavigate(orderDataToSave);
  };

  const saveOrderAndNavigate = (orderData: OrderData) => {
    console.log('💾 Saving order data to Redux:', {
      totalItems: orderData.totalItems,
      totalAmount: orderData.totalAmount,
      itemsCount: orderData.items.length
    });
    
    dispatch(disableOrderProtection());
    
    // Save to Redux
    dispatch(saveOrderData(orderData));
    router.push('/dryCleanerUser/payment'); 
    
    console.log('✅ Order data saved, navigating to DryorderSummary');
    
    // Navigate after a brief delay to ensure Redux update completes
    setTimeout(() => {
      router.push({
        pathname: '/dryCleanerUser/payment',
        params: {
          ...(pickupAddress && { pickupAddress }),
          ...(selectedAddressType && { selectedAddressType }),
        }
      });
    }, 300);
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/userHome');
    }
  };

  // Render components
  interface DateButtonProps {
    date: string;
    isSelected: boolean;
    onPress: () => void;
  }

  const DateButton: React.FC<DateButtonProps> = ({ date, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.dateButton,
        isSelected && styles.selectedDateButton,
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.dateButtonText,
        isSelected && styles.selectedDateButtonText,
      ]}>
        {date}
      </Text>
    </TouchableOpacity>
  );

  interface TimeButtonProps {
    time: string;
    isSelected: boolean;
    onPress: () => void;
  }

  const TimeButton: React.FC<TimeButtonProps> = ({ time, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.timeButton,
        isSelected && styles.selectedTimeButton,
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.timeButtonText,
        isSelected && styles.selectedTimeButtonText,
      ]}>
        {time}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <TouchableOpacity onPress={handleGoBack}>
            <IconButton icon="arrow-left" size={28} iconColor={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.title}>Schedule Pickup and Delivery</Text>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            📍 Pickup from: {pickupAddress || 'Address not set'}
          </Text>
        </View>

        {/* PICKUP SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Pickup Date & Time</Text>

          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Pickup Date</Text>
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              data={months}
              maxHeight={200}
              labelField="label"
              valueField="value"
              value={pickupMonth}
              onChange={item => {
                if (item && item.value) {
                  setPickupMonth(item.value);
                }
              }}
              placeholder="Select month"
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              itemTextStyle={styles.dropdownItemText}
              renderRightIcon={() => (
                <View style={styles.dropdownIconContainer}>
                  <Text style={styles.dropdownIcon}>▼</Text>
                </View>
              )}
            />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.datesContainer}
            contentContainerStyle={styles.datesContent}
          >
            {dates.map((date) => (
              <DateButton
                key={`pickup-${date}`}
                date={date}
                isSelected={date === selectedPickupDate}
                onPress={() => setSelectedPickupDate(date)}
              />
            ))}
          </ScrollView>

          <Text style={styles.timeLabel}>Pickup Time</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.timesContainer}
            contentContainerStyle={styles.timesContent}
          >
            {pickupTimes.map((time) => (
              <TimeButton
                key={`pickup-${time}`}
                time={time}
                isSelected={time === selectedPickupTime}
                onPress={() => setSelectedPickupTime(time)}
              />
            ))}
          </ScrollView>
        </View>

        {/* DELIVERY SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Delivery Date & Time</Text>

          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Delivery Date</Text>
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              data={months}
              maxHeight={200}
              labelField="label"
              valueField="value"
              value={deliveryMonth}
              onChange={item => {
                if (item && item.value) {
                  setDeliveryMonth(item.value);
                }
              }}
              placeholder="Select month"
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              itemTextStyle={styles.dropdownItemText}
              renderRightIcon={() => (
                <View style={styles.dropdownIconContainer}>
                  <Text style={styles.dropdownIcon}>▼</Text>
                </View>
              )}
            />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.datesContainer}
            contentContainerStyle={styles.datesContent}
          >
            {dates.map((date) => (
              <DateButton
                key={`delivery-${date}`}
                date={date}
                isSelected={date === selectedDeliveryDate}
                onPress={() => setSelectedDeliveryDate(date)}
              />
            ))}
          </ScrollView>

          <Text style={styles.timeLabel}>Delivery Time</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.timesContainer}
            contentContainerStyle={styles.timesContent}
          >
            {deliveryTimes.map((time) => (
              <TimeButton
                key={`delivery-${time}`}
                time={time}
                isSelected={time === selectedDeliveryTime}
                onPress={() => setSelectedDeliveryTime(time)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Enhanced Debug info */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Information:</Text>
            <Text style={styles.debugText}>
              {`Scheduling saved: ${savedScheduling ? 'Yes' : 'No'}`}
            </Text>
            <Text style={styles.debugText}>
              {`Order exists: ${existingOrder ? 'Yes' : 'No'}`}
            </Text>
            {existingOrder && (
              <>
                <Text style={styles.debugText}>
                  {`Order items: ${existingOrder.items?.length || 0}`}
                </Text>
                <Text style={styles.debugText}>
                  {`Total: $${existingOrder.totalAmount?.toFixed(2) || '0.00'}`}
                </Text>
              </>
            )}
            <Text style={styles.debugText}>
              {`Selected items count: ${selectedItems.length}`}
            </Text>
            <Text style={styles.debugText}>
              {`Items with quantity: ${selectedItems.filter((i: any) => i.quantity > 0).length}`}
            </Text>
            {selectedCleaner && (
              <Text style={styles.debugText}>
                {`Cleaner: ${selectedCleaner.shopname || selectedCleaner}`}
              </Text>
            )}
            <Text style={styles.debugText}>
              {`Pickup Address: ${pickupAddress || 'Not set'}`}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue to Order Summary</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingBottom: 100,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: height * 0.02,
    marginTop: height * 0.05,
    marginBottom: height * 0.02,
  },
  title: {
    fontSize: width * 0.045,
    fontWeight: '400',
    marginLeft: width * 0.03,
    color: '#000000',
    flex: 1,
    flexWrap: 'wrap',
  },
  infoBanner: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '500',
  },
  section: {
    marginBottom: height * 0.04,
    width: '100%',
  },
  sectionTitle: {
    fontSize: width * 0.05,
    fontWeight: '400',
    marginBottom: height * 0.025,
    color: '#707070',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: height * 0.02,
    width: '100%',
  },
  dateLabel: {
    fontSize: width * 0.04,
    fontWeight: '400',
    color: '#000000',
  },
  dropdown: {
    height: 50,
    minWidth: width * 0.3,
    maxWidth: width * 0.4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 8,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 200,
    width: width * 0.35,
    shadowColor: '#000000',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  placeholderStyle: {
    fontSize: width * 0.04,
    color: '#666',
  },
  selectedTextStyle: {
    fontSize: width * 0.04,
    color: '#000000',
  },
  dropdownItemText: {
    color: '#000000',
    fontSize: width * 0.035,
    paddingVertical: 8,
  },
  dropdownIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  datesContainer: {
    marginBottom: height * 0.02,
  },
  datesContent: {
    paddingRight: width * 0.05,
  },
  dateButton: {
    width: width * 0.15,
    height: width * 0.15,
    maxWidth: 70,
    maxHeight: 70,
    minWidth: 50,
    minHeight: 50,
    backgroundColor: '#FFF5EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: width * 0.025,
    borderRadius: 8,
  },
  selectedDateButton: {
    backgroundColor: '#FF9933',
  },
  dateButtonText: {
    fontSize: width * 0.04,
    color: '#000',
  },
  selectedDateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  timeLabel: {
    fontSize: width * 0.04,
    fontWeight: '400',
    marginBottom: height * 0.02,
    color: '#000000',
  },
  timesContainer: {
    marginBottom: height * 0.02,
  },
  timesContent: {
    paddingRight: width * 0.05,
  },
  timeButton: {
    paddingHorizontal: width * 0.05,
    paddingVertical: height * 0.015,
    backgroundColor: '#666666',
    borderRadius: 8,
    marginRight: width * 0.025,
    minWidth: width * 0.22,
    alignItems: 'center',
  },
  selectedTimeButton: {
    backgroundColor: '#FF9933',
  },
  timeButtonText: {
    color: '#fff',
    fontSize: width * 0.035,
  },
  selectedTimeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: width * 0.05,
    paddingVertical: height * 0.02,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  continueButton: {
    backgroundColor: '#FF9933',
    paddingVertical: height * 0.02,
    borderRadius: 30,
    width: '100%',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  debugContainer: {
    marginTop: height * 0.02,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  debugText: {
    fontSize: width * 0.03,
    color: '#666',
    marginBottom: 2,
  },
  debugTitle: {
    fontSize: width * 0.035,
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 5,
  },
});

export default PickupDeliveryScreen;