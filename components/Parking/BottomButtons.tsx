import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import colors from '../../assets/color';

interface BottomButtonsProps {
  onViewDetails: () => void;
  onFindParking: () => void;
}

const BottomButtons: React.FC<BottomButtonsProps> = ({
  onViewDetails,
  onFindParking,
}) => (
  <View style={styles.bottomButtons}>
    <TouchableOpacity style={styles.viewDetailsButton} onPress={onViewDetails}>
      <Text style={styles.viewDetailsText}>View Details</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.findParkingButton} onPress={onFindParking}>
      <Text style={styles.findParkingText}>Find Parking</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: 'white',
  },
  viewDetailsButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#666666',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findParkingButton: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewDetailsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  findParkingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default BottomButtons;
