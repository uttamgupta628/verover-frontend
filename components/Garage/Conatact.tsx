import React from 'react';
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import color from '../../assets/color';
import { images } from '../../assets/images/images';

const Contact = ({ name, phoneNo }: { name: string; phoneNo: string }) => {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionTitle}>Contact Info</Text>

      <View style={styles.contactCard}>
        <Image source={images.contactImage} style={styles.contactImage} />

        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>{name}</Text>

          <View style={styles.phoneContainer}>
            <MaterialIcons
              name="phone-in-talk"
              size={18}
              color={color.primary}
              style={styles.phoneIcon}
            />
            <Text style={styles.contactPhone}>{phoneNo}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.callButton}
          onPress={() => Linking.openURL(`tel:${phoneNo}`)}
        >
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Contact;

const styles = StyleSheet.create({
  infoSection: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#F5F5F5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  contactImage: {
    marginRight: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contactDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666666',
  },
  callButton: {
    backgroundColor: '#666666',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 16,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneIcon: {
    marginRight: 6,
  },
});
