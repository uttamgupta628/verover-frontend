import React, { useState, useRef, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../components/redux/hooks';
import { verifyOTP } from '../components/redux/authSlice';
import axiosInstance from '../api/axios';

const colors = {
  primary: '#FF8C00',
  white: '#FFFFFF',
  gray: '#888888',
  black: '#000000',
  error: '#FF0000',
  lightGray: '#E0E0E0',
  backgroundGray: '#F9F9F9',
};

export default function EmailOTP() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const router = useRouter();
  const dispatch = useAppDispatch();
  
  // Get token and email from Redux store
  const { token, user } = useAppSelector((state) => state.auth);

  // Timer for resend OTP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (resendTimer > 0 && !canResend) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer, canResend]);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) {
      return;
    }

    if (value.length > 1) {
      value = value[0];
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value !== '') {
      const fullOtp = [...newOtp.slice(0, 5), value].join('');
      if (fullOtp.length === 6) {
        setTimeout(() => handleVerifyOTP(fullOtp), 100);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      // Clear the previous input
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    
    if (code.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Session expired. Please register again.', [
        {
          text: 'OK',
          onPress: () => router.replace('/signup'),
        },
      ]);
      return;
    }

    setLoading(true);

    try {
      console.log('Verifying OTP:', code);
      console.log('Using token:', token);
      
      await dispatch(verifyOTP(code, token));
      
      Alert.alert(
        'Success', 
        'Email verified successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to tabs (home) after successful verification
              router.replace('/email-otp-success');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('OTP Verification Error:', error);
      
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      Alert.alert(
        'Verification Failed', 
        error.message || 'Invalid OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend || resendLoading) {
      return;
    }

    if (!token || !user?.email) {
      Alert.alert('Error', 'Session expired. Please register again.', [
        {
          text: 'OK',
          onPress: () => router.replace('/signup'),
        },
      ]);
      return;
    }

    setResendLoading(true);

    try {
      console.log('Resending OTP to:', user.email);
      
      const response = await axiosInstance.post('/users/resend-otp', {
        email: user.email,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      console.log('Resend OTP Response:', response.data);

      Alert.alert('Success', 'A new OTP has been sent to your email.');
      
      // Reset timer
      setResendTimer(60);
      setCanResend(false);
      
      // Clear current OTP
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
    } catch (error: any) {
      console.error('Resend OTP Error:', error);
      
      let errorMessage = 'Failed to resend OTP. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.message 
          || error.response.data?.error 
          || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Verification</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Icon name="email-check" size={80} color={colors.primary} />
        <Text style={styles.mainTitle}>Enter Verification Code</Text>
        <Text style={styles.subtitleText}>
          We've sent a 6-digit code to {'\n'}
          <Text style={styles.emailText}>{user?.email || 'your email'}</Text>
        </Text>
      </View>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              digit !== '' && styles.otpInputFilled,
            ]}
            maxLength={1}
            keyboardType="number-pad"
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            editable={!loading}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        style={[
          styles.verifyButton, 
          (loading || otp.join('').length !== 6) && styles.disabledButton
        ]}
        onPress={() => handleVerifyOTP()}
        disabled={loading || otp.join('').length !== 6}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.verifyButtonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>

      {/* Resend OTP */}
      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code?</Text>
        {canResend ? (
          <TouchableOpacity 
            onPress={handleResendOTP}
            disabled={resendLoading}
          >
            {resendLoading ? (
              <ActivityIndicator 
                size="small" 
                color={colors.primary} 
                style={{ marginLeft: 8 }}
              />
            ) : (
              <Text style={styles.resendLink}>Resend OTP</Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={styles.timerText}>
            Resend in {resendTimer}s
          </Text>
        )}
      </View>

      {/* Help Text */}
      <View style={styles.helpContainer}>
        <Icon name="information" size={responsiveFontSize(2)} color={colors.gray} />
        <Text style={styles.helpText}>
          Check your spam folder if you don't see the email
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: responsiveWidth(90),
    marginTop: Platform.OS === 'ios' ? responsiveHeight(6) : responsiveHeight(4),
    paddingHorizontal: responsiveWidth(5),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.primary,
    fontWeight: '600',
  },
  titleContainer: {
    width: responsiveWidth(85),
    marginTop: responsiveHeight(5),
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: responsiveFontSize(2.8),
    color: colors.black,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: responsiveHeight(2),
  },
  subtitleText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    textAlign: 'center',
    marginTop: responsiveHeight(1.5),
    lineHeight: responsiveFontSize(2.6),
  },
  emailText: {
    color: colors.primary,
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: responsiveWidth(85),
    marginTop: responsiveHeight(5),
  },
  otpInput: {
    width: responsiveWidth(12),
    height: responsiveHeight(7),
    borderWidth: 2,
    borderColor: colors.lightGray,
    borderRadius: 12,
    fontSize: responsiveFontSize(3.5),
    textAlign: 'center',
    color: colors.black,
    fontWeight: '600',
    backgroundColor: colors.backgroundGray,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  verifyButton: {
    height: responsiveHeight(6),
    width: responsiveWidth(85),
    marginTop: responsiveHeight(4),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: colors.gray,
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    fontSize: responsiveFontSize(2),
    color: colors.white,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    marginTop: responsiveHeight(3),
    alignItems: 'center',
  },
  resendText: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
  },
  resendLink: {
    fontSize: responsiveFontSize(1.7),
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  timerText: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginLeft: 8,
    fontWeight: '500',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveHeight(4),
    paddingHorizontal: responsiveWidth(10),
  },
  helpText: {
    fontSize: responsiveFontSize(1.5),
    color: colors.gray,
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
});