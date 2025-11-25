
import React from 'react';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
    StatusBar,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { responsiveFontSize, responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';

const colors = {
  primary: '#FF8C00',
  white: '#FFFFFF',
  gray: '#888888',
  black: '#000000',
};

export default function EmailOTPSuccess() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent
            />
            
            {/* Header */}
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Icon name="arrow-left" size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Registration</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Success Icon */}
            <View style={styles.imageContainer}>
                <Icon name="check-circle" size={120} color="#4CAF50" />
            </View>

            {/* Success Title */}
            <Text style={styles.title}>Success!</Text>

            {/* Subtitle */}
            <View style={styles.subtitleContainer}>
                <Text style={styles.subtitle}>
                    Your Email ID is verified successfully.
                </Text>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/login')}
            >
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? responsiveHeight(6) : responsiveHeight(4),
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: responsiveWidth(5),
    },
    headerTitle: {
        fontSize: responsiveFontSize(2.5),
        color: colors.primary,
        fontWeight: '600',
    },
    imageContainer: {
        width: responsiveWidth(60),
        height: responsiveHeight(20),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: responsiveHeight(3),
    },
    title: {
        color: colors.black,
        fontSize: responsiveFontSize(3.5),
        fontWeight: 'bold',
        marginBottom: responsiveHeight(2),
    },
    subtitleContainer: {
        width: responsiveWidth(70),
        marginBottom: responsiveHeight(4),
    },
    subtitle: {
        textAlign: 'center',
        fontSize: responsiveFontSize(2),
        color: colors.gray,
        lineHeight: responsiveFontSize(2.8),
    },
    button: {
        height: responsiveHeight(6),
        width: responsiveWidth(85),
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    buttonText: {
        fontSize: responsiveFontSize(2),
        color: colors.white,
        fontWeight: '600',
    },
});