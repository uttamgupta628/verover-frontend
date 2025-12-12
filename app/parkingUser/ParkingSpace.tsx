import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import axiosInstance from '../../api/axios';
import { generatSpaceID, getSpacDetailsFromID } from '../../utils/slotIdConverter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AxiosError } from 'axios';

const { width, height } = Dimensions.get('window');

// Responsive helpers for Expo
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFontSize = (percentage: number) => {
  const baseSize = width > 400 ? 16 : 14;
  return (baseSize * percentage) / 2;
};

type FloorType = '1st Floor' | '2nd Floor' | '3rd Floor';

type ParkingSpot = {
  id: string;
  isOccupied: boolean;
};

type ParkingSection = {
  availableSpots: number;
  spots: ParkingSpot[];
  price: number;
};

type ParkingDataType = {
  [key: string]: ParkingSection;
};

type FetchParkingDataType = {
  status: string;
  message: string;
  success: boolean;
  data: {
    availableSpace: number;
    bookedSlot: {
      rentedSlot: string;
      rentFrom: string;
      rentTo: string;
    }[];
    isOpen?: boolean;
  };
};

const generateAvailableSoltList = (
  data: FetchParkingDataType['data'],
  spaceList: { [key: string]: { count: number; price: number } }
): { parkingData: ParkingDataType; availableSlots: string[] } => {
  const res: ParkingDataType = {};
  const availableSlots: string[] = [];
  const occupiedSlots = new Map<string, number[]>();
  
  console.log('Booked Slots : ', data.bookedSlot);
  
  data.bookedSlot.forEach((slot) => {
    const details = getSpacDetailsFromID(slot.rentedSlot);
    if (details == null) {
      console.log('Invalid Slot ID : ' + slot.rentedSlot);
      return;
    }
    const { zone, slot: slotNumber } = details;
    if (occupiedSlots.has(zone)) {
      occupiedSlots.get(zone)?.push(slotNumber);
    } else {
      occupiedSlots.set(zone, [slotNumber]);
    }
  });
  
  // sort map's array
  occupiedSlots.forEach((value, key) => {
    occupiedSlots.set(key, value.sort((a, b) => a - b));
  });
  
  Object.keys(spaceList).forEach((key) => {
    const occupiedList = occupiedSlots.get(key) || [];
    console.log('Key : ', key);
    console.log('Occupied List : ', occupiedList);
    console.log('Space List : ', spaceList[key]);
    const spots = [];
    for (let i = 1, j = 0; i <= spaceList[key].count; i++) {
      if (j < occupiedList.length && occupiedList[j] === i) {
        j++;
        spots.push({
          id: generatSpaceID(key, i),
          isOccupied: true,
        });
      } else {
        spots.push({
          id: generatSpaceID(key, i),
          isOccupied: false,
        });
        availableSlots.push(generatSpaceID(key, i));
      }
    }
    res[key] = {
      availableSpots: spaceList[key].count - occupiedList.length,
      spots: spots,
      price: spaceList[key].price,
    };
  });
  return { parkingData: res, availableSlots };
};

const FloorSelector: React.FC<{
  selectedFloor: FloorType;
  onSelectFloor: (type: FloorType) => void;
}> = ({ selectedFloor, onSelectFloor }) => (
  <View style={styles.floorSelectorContainer}>
    <View style={styles.floorTypeContainer}>
      <TouchableOpacity
        style={[
          styles.floorTypeButton,
          selectedFloor === '1st Floor' && styles.activeFloorType,
        ]}
        onPress={() => onSelectFloor('1st Floor')}>
        <Text
          style={
            selectedFloor === '1st Floor'
              ? styles.activeFloorTypeText
              : styles.floorTypeText
          }>
          1st Floor
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.floorTypeButton,
          selectedFloor === '2nd Floor' && styles.activeFloorType,
        ]}
        onPress={() => onSelectFloor('2nd Floor')}>
        <Text
          style={
            selectedFloor === '2nd Floor'
              ? styles.activeFloorTypeText
              : styles.floorTypeText
          }>
          2nd Floor
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.floorTypeButton,
          selectedFloor === '3rd Floor' && styles.activeFloorType,
        ]}
        onPress={() => onSelectFloor('3rd Floor')}>
        <Text
          style={
            selectedFloor === '3rd Floor'
              ? styles.activeFloorTypeText
              : styles.floorTypeText
          }>
          3rd Floor
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const ParkingSpace = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedFloor, setSelectedFloor] = useState<FloorType>('1st Floor');
  const [loading, setLoading] = useState<boolean>(false);
  const [availableSpots, setAvailableSpots] = useState<string[]>([]);
  const [parkingData, setParkingData] = useState<ParkingDataType>({});
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Parse params (Expo Router passes params as strings)
  const parsedParams = {
    type: params.type as string,
    lot: params.lot ? JSON.parse(params.lot as string) : null,
    endTime: params.endTime as string,
  };

  useEffect(() => {
    if (parsedParams.type === 'L' && parsedParams.lot && parsedParams.endTime) {
      console.log(parsedParams.lot);
      axiosInstance
        .get('/merchants/parkinglot/getavailable', {
          params: {
            lotId: parsedParams.lot._id,
            startDate: new Date().toISOString(),
            lastDate: parsedParams.endTime,
          },
        })
        .then((res) => {
          console.log(res.data);
          console.log('lot: ', parsedParams.lot);
          const { parkingData, availableSlots } = generateAvailableSoltList(
            res.data.data,
            parsedParams.lot.spacesList
          );
          setParkingData(parkingData);
          setAvailableSpots(availableSlots);
        })
        .catch((err) => {
          console.log(err);
        });
    } else if (parsedParams.type === 'G' && parsedParams.lot && parsedParams.endTime) {
      console.log(parsedParams.lot);
      axiosInstance
        .get<FetchParkingDataType>('/merchants/garage/getavailable', {
          params: {
            garageId: parsedParams.lot._id,
            startDate: new Date().toISOString(),
            endDate: parsedParams.endTime,
          },
        })
        .then((res) => {
          console.log(res.data);
          console.log('lot: ', parsedParams.lot);
          const { parkingData, availableSlots } = generateAvailableSoltList(
            res.data.data,
            parsedParams.lot.spacesList
          );
          setParkingData(parkingData);
          setAvailableSpots(availableSlots);
        })
        .catch((err) => {
          if (err instanceof AxiosError) {
            console.log(err.response?.data);
            console.log(err.toJSON());
          }
          console.log('Error : ', err);
          throw err;
        });
    } else {
      Alert.alert('Error', 'Lot Not Selected', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    }
  }, [parsedParams]);

  const handleCheckout = useCallback(() => {
    if (!selectedSpot) {
      Alert.alert('NO SLOT', 'Please Select a Slot');
      return;
    }
    
    // Navigate to Confirmation screen with all params
    router.push({
      pathname: '/parkingUser/Confirmation',
      params: {
        ...params,
        selectedSpot: selectedSpot,
      }
    });
  }, [selectedSpot, params]);

  const handleSpotSelection = (spot: string, isOccupied: boolean) => {
    if (!isOccupied) {
      setSelectedSpot(spot === selectedSpot ? null : spot);
    }
  };

  const getFloorImage = () => {
    switch (selectedFloor) {
      case '1st Floor':
        return images.floor1;
      case '2nd Floor':
        return images.floor2;
      case '3rd Floor':
        return images.floor3;
      default:
        return images.floor1;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons 
            name="arrow-left" 
            size={30} 
            color={colors.brandColor} 
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Parking Spaces</Text>
      </View>

      {/* Parking Sections */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.keys(parkingData).map((section) => {
          return (
            <View key={section}>
              {/* Section Header */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLetter}>{section}</Text>
                <Text style={styles.spotsText}>
                  Available Spots: {parkingData[section].availableSpots}
                </Text>
                <Text
                  style={[
                    {
                      alignSelf: 'flex-end',
                      textAlign: 'left',
                    },
                    styles.spotsText,
                  ]}>
                  price: ${parkingData[section].price}
                </Text>
              </View>
              {parkingData[section].spots.map((spot) => {
                return (
                  <TouchableOpacity
                    key={spot.id}
                    style={[
                      styles.parkingSpot,
                      selectedSpot === spot.id &&
                        !spot.isOccupied &&
                        styles.selectedSpot,
                      spot.isOccupied && styles.occupiedSpot,
                    ]}
                    onPress={() =>
                      handleSpotSelection(spot.id, spot.isOccupied)
                    }
                    disabled={spot.isOccupied}
                    activeOpacity={0.7}>
                    {spot.isOccupied ? (
                      <>
                        <Image
                          source={images.CarTop}
                          style={styles.carImage}
                        />
                        <Text style={styles.spotText}>{spot.id}</Text>
                      </>
                    ) : selectedSpot === spot.id ? (
                      <>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={30}
                          color="#FFF"
                        />
                        <Text style={styles.selectedText}>Selected</Text>
                        <Text style={styles.selectedSpotId}>{spot.id}</Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="car-outline"
                          size={30}
                          color={colors.gray}
                        />
                        <Text style={styles.spotText}>{spot.id}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
        
        {/* Add padding at bottom for better scroll */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.additionalPriceButton,
            !selectedSpot && styles.disabledButton,
          ]}
          disabled={!selectedSpot}
          onPress={handleCheckout}
          activeOpacity={0.8}>
          <Text style={styles.additionalPriceText}>Go To Checkout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanQRButton}
          onPress={() => {
            router.replace('/userHome');
          }}
          activeOpacity={0.8}>
          <Text style={styles.scanQRText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingHorizontal: responsiveWidth(5),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? responsiveHeight(7) : responsiveHeight(5),
    marginBottom: responsiveHeight(2),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.brandColor,
    marginLeft: responsiveWidth(5),
    fontWeight: '600',
  },
  floorSelectorContainer: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 30,
    padding: 8,
    marginVertical: 7,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  floorTypeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  floorTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFloorType: {
    backgroundColor: '#FFF3E9',
  },
  floorTypeText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFloorTypeText: {
    color: colors.primary || colors.brandColor,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveHeight(3),
    marginBottom: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(2),
  },
  sectionLetter: {
    fontSize: responsiveFontSize(2.8),
    fontWeight: 'bold',
    color: colors.brandColor,
    marginRight: responsiveWidth(3),
  },
  spotsText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginLeft: responsiveWidth(2),
  },
  parkingSpot: {
    backgroundColor: '#F5F5F5',
    margin: responsiveWidth(2),
    padding: responsiveWidth(5),
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: responsiveHeight(12),
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedSpot: {
    backgroundColor: colors.brandColor,
    borderColor: colors.brandColor,
    shadowColor: colors.brandColor,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  occupiedSpot: {
    backgroundColor: '#FFE5E5',
    opacity: 0.7,
  },
  carImage: {
    width: responsiveWidth(15),
    height: responsiveHeight(7),
    resizeMode: 'contain',
    marginBottom: 8,
  },
  spotText: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
    fontWeight: '500',
    marginTop: 4,
  },
  selectedText: {
    fontSize: responsiveFontSize(2.2),
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: 8,
  },
  selectedSpotId: {
    fontSize: responsiveFontSize(1.6),
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4,
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(2),
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  additionalPriceButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: responsiveWidth(2),
    shadowColor: colors.brandColor,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  additionalPriceText: {
    color: '#FFF',
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
  },
  scanQRButton: {
    backgroundColor: '#5E5E5E',
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: responsiveWidth(2),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  scanQRText: {
    color: '#FFF',
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
  },
});

export default ParkingSpace;