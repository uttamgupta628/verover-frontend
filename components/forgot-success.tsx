import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import colors from '../assets/color';

export default function ForgotSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="email-check" size={100} color={colors.brandColor} />
      </View>

      <Text style={styles.title}>OTP Sent!</Text>
      
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          We've sent an OTP to
        </Text>
        <Text style={styles.email}>{params.email}</Text>
        <Text style={styles.subtitle}>
          Please check your email and enter the OTP to reset your password.
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push({
          pathname: '/forgot-reset-password',
          params: { email: params.email, userType: params.userType }
        })}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: responsiveHeight(4),
  },
  title: {
    fontSize: responsiveFontSize(3.5),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: responsiveHeight(2),
  },
  subtitleContainer: {
    width: responsiveWidth(80),
    marginBottom: responsiveHeight(6),
  },
  subtitle: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    textAlign: 'center',
    lineHeight: responsiveFontSize(2.8),
  },
  email: {
    fontSize: responsiveFontSize(2.2),
    color: colors.brandColor,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: responsiveHeight(1),
  },
  button: {
    height: responsiveHeight(6),
    width: responsiveWidth(85),
    backgroundColor: colors.brandColor,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    fontSize: responsiveFontSize(2),
    color: '#FFFFFF',
    fontWeight: '600',
  },
});