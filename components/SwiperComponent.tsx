import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { responsiveFontSize, responsiveWidth } from 'react-native-responsive-dimensions';
import Swiper from 'react-native-swiper';
import { COLORS } from '../constants/colors';

const SwiperComponent = () => {
  return (
    <Swiper
      style={styles.wrapper}
      showsButtons={false}
      loop={true}
      autoplay={true}
      autoplayTimeout={3}
      activeDotColor={COLORS.primary}
      dotColor={COLORS.border}
      paginationStyle={styles.pagination}
    >
      <View style={styles.slide}>
        <Text style={styles.text}>Rides, Parking,</Text>
        <Text style={styles.text}>Dry Cleaning</Text>
        <Text style={styles.text}>in an Instant!</Text>
      </View>

      <View style={styles.slide}>
        <Text style={styles.text}>Book Your Ride</Text>
        <Text style={styles.text}>Anytime, Anywhere</Text>
      </View>

      <View style={styles.slide}>
        <Text style={styles.text}>Easy Parking</Text>
        <Text style={styles.text}>Solutions</Text>
      </View>
    </Swiper>
  );
};

const styles = StyleSheet.create({
  wrapper: {},
  slide: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: responsiveFontSize(2.8),
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 35,
  },
  pagination: {
    bottom: -5,
    left: -responsiveWidth(30),
  },
});

export default SwiperComponent;