import React, { useState } from 'react';
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Image,
  View,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';

import { useAppDispatch, useAppSelector } from '../components/redux/hooks';
import { loginWithEmailPassword } from '../components/redux/authSlice';

interface LoginFormData {
  email: string;
  password: string;
  userType: 'user' | 'merchant' | 'driver';
}

const colors = {
  primary: '#FF8C00',
  white: '#FFFFFF',
  gray: '#888888',
  black: '#000000',
  error: '#FF0000',
};

export default function Login() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [secureEntry, setSecureEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'user' | 'merchant' | 'driver'>('user');

  const { control, handleSubmit, formState: { errors, isValid }, setValue } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', userType: 'user' },
    mode: 'onChange',
  });

  const handleUserTypeSelect = (type: 'user' | 'merchant' | 'driver') => {
    setSelectedUserType(type);
    setValue('userType', type);
  };

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);
    try {
      // Call the login thunk - it returns the axios response
      const response = await dispatch(loginWithEmailPassword(data.email, data.password, data.userType) as any);
      
      console.log('Login response:', response);
      
      // Check if the response indicates success
      if (response && response.data) {
        // Login was successful - the Redux state is already updated by loginSuccess
        console.log('Login successful, redirecting...');
        
        // Redirect based on user type
        if (data.userType === 'merchant') {
          router.replace('/merchantHome');
        } else if (data.userType === 'driver') {
          router.replace('/driverHome');
        } else {
          router.replace('/userHome');
        }
      } else {
        // If response doesn't have data, something went wrong
        throw new Error('Invalid response from server');
      }
      
    } catch (error: any) {
      console.error('Login error caught:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      // Handle Axios errors
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Handle HTML error responses
        if (typeof errorData === 'string' && errorData.includes('Error:')) {
          const match = errorData.match(/Error:\s*([A-Z_]+)/);
          if (match) {
            const errorCode = match[1];
            errorMessage = errorCode.replace(/_/g, ' ').toLowerCase();
            errorMessage = errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1);
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          
          {/* User Type */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>User Type</Text>

            <View style={styles.userTypeContainer}>
              {['user', 'merchant', 'driver'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.userTypeButton,
                    selectedUserType === type && styles.selectedUserTypeButton,
                  ]}
                  onPress={() => handleUserTypeSelect(type as any)}
                >
                  <Text
                    style={[
                      styles.userTypeButtonText,
                      selectedUserType === type && styles.selectedUserTypeButtonText,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Controller
              control={control}
              name="userType"
              rules={{ required: 'User type is required' }}
              render={() => null}
            />
            {errors.userType && <Text style={styles.error}>{errors.userType.message}</Text>}
          </View>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Email</Text>

            <Controller
              control={control}
              name="email"
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email address',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="Enter your email"
                  style={[styles.input, errors.email && styles.inputError]}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.gray}
                />
              )}
            />
            {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Password</Text>

            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.passwordContainer}>
                  <TextInput
                    placeholder="Enter password"
                    secureTextEntry={secureEntry}
                    style={[styles.input, styles.passwordInput]}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholderTextColor={colors.gray}
                  />
                  <TouchableOpacity
                    onPress={() => setSecureEntry(!secureEntry)}
                    style={styles.eyeIcon}
                  >
                    <Icon name={secureEntry ? 'eye-off' : 'eye'} size={24} color={colors.gray} />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, (!isValid || loading) && styles.loginButtonDisabled]}
            onPress={handleSubmit(handleLogin)}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpPrompt}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  backButton: {
    padding: 16,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    left: 10,
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: responsiveHeight(8),
    marginBottom: responsiveHeight(6),
  },
  logo: {
    width: responsiveWidth(50),
    height: responsiveHeight(6),
  },
  formContainer: {
    paddingHorizontal: responsiveWidth(6),
  },
  inputWrapper: {
    marginBottom: responsiveHeight(3),
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginBottom: 8,
  },
  input: {
    fontSize: responsiveFontSize(2),
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
    color: colors.black,
  },
  inputError: {
    borderBottomColor: colors.error,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
  },
  passwordInput: {
    flex: 1,
    borderBottomWidth: 0,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: responsiveFontSize(1.8),
    marginBottom: responsiveHeight(2),
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    height: responsiveHeight(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: responsiveHeight(2),
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: responsiveFontSize(2),
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: responsiveHeight(3),
  },
  signUpPrompt: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  signUpLink: {
    fontSize: responsiveFontSize(1.8),
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    color: colors.error,
    fontSize: responsiveFontSize(1.6),
    marginTop: 4,
  },
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1),
  },
  userTypeButton: {
    flex: 1,
    marginHorizontal: responsiveWidth(1),
    paddingVertical: responsiveHeight(1),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.gray,
    alignItems: 'center',
  },
  selectedUserTypeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userTypeButtonText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  selectedUserTypeButtonText: {
    color: colors.white,
  },
});