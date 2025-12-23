import React from 'react';
import { StyleSheet, Text, View , Image } from 'react-native';
import { COLORS } from '../constants/colors';
import { images } from "../assets/images/images";

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={images.Vlogo}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.brandText}>ERVOER</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginRight: -10,
  },
  brandText: {
    fontSize: 80,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom:15,
    letterSpacing: 2,
  },
});

