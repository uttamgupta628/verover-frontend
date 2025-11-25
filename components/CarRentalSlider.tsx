import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { responsiveWidth } from 'react-native-responsive-dimensions';
import Swiper from 'react-native-swiper';

const { width } = Dimensions.get('window');

interface Slide {
  image: any;
}

const slides: Slide[] = [
  {
    image: require('../assets/images/CARSlider.png'), // Replace with the correct path to your local image

  },
  {
    image: require('../assets/images/CARSlider.png'), // Replace with the correct path to your local image
  },
  {
    image: require('../assets/images/CARSlider.png'), // Replace with the correct path to your local image
  },
  {
    image: require('../assets/images/CARSlider.png'), // Replace with the correct path to your local image
  },
  // Add more slides as needed
];

const CarRentalSlider: React.FC = () => {
  return (
    <Swiper
      style={styles.wrapper}
      showsButtons={false}
      autoplay={true}
      paginationStyle={styles.pagination}
      activeDotColor="orange"
      dotColor="#808080"
    >
      {slides.map((slide, index) => (
        <View key={index} style={styles.slideContainer}>
          <Image source={slide.image} style={styles.image} />
        </View>
      ))}
    </Swiper>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 300,
  },
  slideContainer: {
    padding: 20,
    alignItems: 'center',
    width: responsiveWidth(100),
    alignSelf: 'center',
  },

  image: {
    width: '150%',
    height: 130,
    resizeMode: 'contain',
    marginBottom: 10,

  },
  pagination: {
    bottom: -10,
  },
});

export default CarRentalSlider;
