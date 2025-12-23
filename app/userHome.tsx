import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  Image,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from 'react-native-responsive-dimensions';
import CarRentalSlider from '../components/CarRentalSlider';
import colors from '../assets/color';
import { images } from '../assets/images/images';

export default function UserHome() {
  const router = useRouter();

  const services = [
    {
      id: 1,
      title: 'Parking',
      image: images.Parking,
      imageStyle: { width: '50%', height: '50%' },
      route: 'parkingUser/parking',
    },
    {
      id: 2,
      title: 'Dry Cleaners',
      image: images.Cleaning,
      imageStyle: { width: '50%', height: '50%' },
      route: 'dryCleanerUser/allDrycleanerLocation',
    },
    {
      id: 3,
      title: 'My Orders',
      image: images.Cleaning,
      imageStyle: { width: '50%', height: '50%' },
      route: 'dryCleanerUser/myOrder',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated={true}
        backgroundColor="transparent"
        translucent={Platform.OS === 'android'}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Users - Home</Text>
            <Text style={styles.headerSubtitle}>Welcome back!</Text>
          </View>
        </View>

        {/* Slider Section */}
        <View style={styles.sliderContainer}>
          <CarRentalSlider />
        </View>

        {/* Services Title */}
        <View style={styles.servicesTitleContainer}>
          <Text style={styles.servicesTitle}>Our Services</Text>
          <Text style={styles.servicesSubtitle}>
            Choose from our available services
          </Text>
        </View>

        {/* Services Grid - Vertical Single Column */}
        <View style={styles.servicesContainer}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceButton}
              onPress={() => router.push(service.route as any)}
              activeOpacity={0.7}
            >
              <View style={styles.serviceIconContainer}>
                <Image
                  source={service.image}
                  style={service.imageStyle}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.serviceButtonText}>{service.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white || '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: responsiveHeight(3),
  },
  
  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: responsiveWidth(5),
    paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
    paddingBottom: responsiveHeight(2),
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.8),
    color: colors.black || '#000000',
    fontWeight: '700',
    marginBottom: responsiveHeight(0),
  },
  headerSubtitle: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray || '#666666',
    fontWeight: '400',
  },

  // Slider Styles
  sliderContainer: {
    height: responsiveHeight(22),
    marginTop: responsiveHeight(0),
    marginBottom: responsiveHeight(2),
  },

  // Services Title
  servicesTitleContainer: {
    paddingHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(2),
  },
  servicesTitle: {
    fontSize: responsiveFontSize(2.4),
    color: colors.black || '#000000',
    fontWeight: '600',
    marginBottom: responsiveHeight(0),
  },
  servicesSubtitle: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray || '#666666',
    fontWeight: '400',
  },

  // Services Container - Vertical Single Column
  servicesContainer: {
    flexDirection: 'column',
    paddingHorizontal: responsiveWidth(5),
    alignItems: 'stretch',
  },

  // Service Button Styles - Original Size, Vertical Layout
  serviceButton: {
    backgroundColor: colors.white || '#FFFFFF',
    width: '100%',
    minHeight: responsiveHeight(20),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: responsiveHeight(2.5),
    paddingHorizontal: responsiveWidth(3),
    marginBottom: responsiveHeight(2),
    
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    
    // Shadow for Android
    elevation: 6,
  },
  serviceIconContainer: {
    width: '100%',
    height: responsiveHeight(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveHeight(1),
  },
  serviceButtonText: {
    marginTop: responsiveHeight(1),
    fontSize: responsiveFontSize(1.9),
    color: colors.black || '#000000',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Bottom Spacing
  bottomSpacing: {
    height: responsiveHeight(2),
  },
});