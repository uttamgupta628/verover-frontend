import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    StatusBar,
    StyleSheet,
    Text,
    Image,
    View,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import CarRentalSlider from '../components/CarRentalSlider';
import colors from '../assets/color';
import { images } from '../assets/images/images';

// Responsive helper functions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const responsiveWidth = (percentage) => {
    return (percentage * SCREEN_WIDTH) / 100;
};

const responsiveHeight = (percentage) => {
    return (percentage * SCREEN_HEIGHT) / 100;
};

const responsiveFontSize = (percentage) => {
    return Math.round((percentage * SCREEN_WIDTH) / 100);
};

export default function DriverMainHome() {
    const router = useRouter();
    const [text, setText] = React.useState('');
    
    return (
        <View style={styles.container}>
            <StatusBar
                hidden={false}
                barStyle="dark-content"
                animated={true}
                backgroundColor="transparent"
                translucent
            />
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Driver - Home</Text>
                </View>
                <TouchableOpacity 
                    style={styles.scanButton} 
                    onPress={() => router.push('/QRCode')}
                >
                    <Image 
                        source={images.Scanner} 
                        style={styles.scanImage}
                    />
                    <Text style={styles.scanText}>Scan QBR</Text>
                </TouchableOpacity>
            </View>
            
            <View style={styles.sliderContainer}>
                <CarRentalSlider />
            </View>

            {/* First row */}
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.push('/RideTrackingLocate')}
                >
                    <Image source={images.Ride} style={styles.rideImage} />
                    <Text style={styles.buttonText}>Locate Rider</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.push('/dryCleanerDriver/orderRequest')}
                >
                    <Image source={images.Cleaning} style={styles.cleaningImage} />
                    <Text style={styles.buttonText}>Dry Cleaning</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.button}
                    onPress={() => router.push('/FoodDeliveryHome')}
                >
                    <Image source={images.FoodDelivery} style={styles.foodImage} />
                    <Text style={styles.buttonText}>Food Delivery</Text>
                </TouchableOpacity>
            </View>

            {/* Second row */}
            <View style={styles.buttonRow2}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.push('/Vehicleinfo')}
                >
                    <Image source={images.Ride} style={styles.rideImage} />
                    <Text style={styles.buttonText}>Driver Registration</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.push('/QRCode')}
                >
                    <Image source={images.Scanner} style={styles.cleaningImage} />
                    <Text style={styles.buttonText}>Scan QBR</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.button}
                    onPress={() => router.push('/MicroMobility')}
                >
                    <Image source={images.MicroMobility} style={styles.microImage} />
                    <Text style={styles.buttonText}>Micro Mobility</Text>
                </TouchableOpacity>
            </View>

            {/* Third row */}
            <View style={styles.buttonRow3}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                        console.log('Navigating to driver history...');
                        router.push('/dryCleanerDriver/driverHistory');
                    }}
                >
                    <Image source={images.Cleaning} style={styles.cleaningImage} />
                    <Text style={styles.buttonText}>Driver History</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        width: responsiveWidth(90),
        justifyContent: 'space-between',
        marginTop: responsiveHeight(0),
    },
    titleContainer: {
        width: responsiveWidth(60),
    },
    title: {
        fontSize: responsiveFontSize(4.5),
        color: colors.black,
    },
    scanButton: {
        alignItems: 'center',
    },
    scanImage: {
        width: responsiveWidth(8),
        height: responsiveHeight(4),
    },
    scanText: {
        color: colors.text,
    },
    sliderContainer: {
        height: responsiveHeight(20),
    },
    buttonRow: {
        marginTop: responsiveHeight(5),
        width: responsiveWidth(90),
        height: responsiveHeight(12),
        justifyContent: 'space-between',
        flexDirection: 'row',
    },
    buttonRow2: {
        marginTop: responsiveHeight(2.5),
        width: responsiveWidth(90),
        height: responsiveHeight(12),
        justifyContent: 'space-between',
        flexDirection: 'row',
    },
    buttonRow3: {
        marginTop: responsiveHeight(2.5),
        width: responsiveWidth(90),
        height: responsiveHeight(12),
        justifyContent: 'space-between',
        flexDirection: 'row',
    },
    button: {
        backgroundColor: colors.white,
        width: '30%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    buttonText: {
        marginTop: '5%',
        color: colors.black,
        textAlign: 'center',
    },
    rideImage: {
        width: '48%',
        height: '30%',
    },
    cleaningImage: {
        width: '35%',
        height: '35%',
    },
    foodImage: {
        width: '40%',
        height: '35%',
    },
    microImage: {
        width: '40%',
        height: '39%',
    },
});