import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import { Phone } from 'lucide-react-native';
import colors from '../../assets/color';

const Contact = () => {
  const handleCall = () => {
    Linking.openURL('tel:+1234567890');
  };

  return (
    <View style={styles.contactSection}>
      <Text style={styles.sectionTitle}>Contact</Text>
      <View style={styles.contactCard}>
        <Image
          source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
          style={styles.contactImage}
        />
        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>John Doe</Text>
          <Text style={styles.contactPhone}>+1 234 567 890</Text>
        </View>
        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Phone size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  contactSection: {
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666666',
  },
  callButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Contact;