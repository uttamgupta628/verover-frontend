import React from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {images} from '../../assets/images/images';
import colors from '../../assets/color';

type VehicleType = 'car' | 'bike';

interface VehicleTypeSelectorProps {
  selectedVehicle: VehicleType;
  onSelectVehicle: (type: VehicleType) => void;
}

const VehicleTypeSelector: React.FC<VehicleTypeSelectorProps> = ({
  selectedVehicle,
  onSelectVehicle,
}) => (
  <View style={styles.vehicleTypeSelectorContainer}>
    <View style={styles.vehicleTypeContainer}>
      <TouchableOpacity
        style={[
          styles.vehicleTypeButton,
          selectedVehicle === 'car' && styles.activeVehicleType,
        ]}
        onPress={() => onSelectVehicle('car')}>
        <Image
          source={images.carPick}
          style={styles.vehicleIcon}
          resizeMode="contain"
        />
        <Text
          style={
            selectedVehicle === 'car'
              ? styles.activeVehicleTypeText
              : styles.vehicleTypeText
          }>
          For Car
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.vehicleTypeButton,
          selectedVehicle === 'bike' && styles.activeVehicleType,
        ]}
        onPress={() => onSelectVehicle('bike')}>
        <Image
          source={images.bikePick}
          style={styles.vehicleIcon}
          resizeMode="contain"
        />
        <Text
          style={
            selectedVehicle === 'bike'
              ? styles.activeVehicleTypeText
              : styles.vehicleTypeText
          }>
          For Bike
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  vehicleTypeSelectorContainer: {
    backgroundColor: '#FFFFFF',
    width: '70%',
    borderRadius: 30,
    padding: 8,
    marginBottom: 20,
    alignSelf: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  vehicleTypeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  vehicleIcon: {
    width: 20,
    height: 20,
  },
  activeVehicleType: {
    backgroundColor: '#FFF3E9',
  },
  vehicleTypeText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  activeVehicleTypeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default VehicleTypeSelector;
