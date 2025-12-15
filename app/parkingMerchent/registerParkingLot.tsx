import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from 'react-native-responsive-dimensions';
import { useSelector } from 'react-redux';
import { RootState } from '../../components/redux/store';
import axiosInstance from '../../api/axios';
import * as ImagePicker from 'expo-image-picker'; // Changed to Expo ImagePicker
import * as Location from 'expo-location';
import colors from '../../assets/color';
import { ArrowLeft, Camera, X, Plus, Trash2 } from 'lucide-react-native';

// Interface for working hours
interface WorkingHours {
    day: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
    isOpen?: boolean;
    openTime?: string;
    closeTime?: string;
    is24Hours: boolean;
}

// Updated interface to include all backend fields
interface ParkingLotFormData {
    parkingName: string;
    price: number;
    about: string;
    contactNumber: string;
    email?: string;
    address: string;
    spacesList: Record<string, { count: number; price: number }>;
    generalAvailable: WorkingHours[];
    is24x7: boolean;
    gpsLocation: {
        type: string;
        coordinates: number[];
    };
    vehicleType: 'bike' | 'car' | 'both';
    totalSlot: number;
}

const RegisterParkingLot = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const parkingLotId = params.parkingLotId as string | undefined;
    const [selectedTab, setSelectedTab] = useState('Parking Lot');
    const { token, user } = useSelector((state: RootState) => state.auth);
    const [isLoading, setIsLoading] = useState(false);
    const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number, longitude: number } | null>(null);

    // Initialize state with all required fields
    const [formData, setFormData] = useState<ParkingLotFormData>({
        parkingName: '',
        price: 0,
        about: '',
        contactNumber: user?.phoneNumber || '',
        email: user?.email || '',
        address: '',
        vehicleType: 'both',
        totalSlot: 0,
        spacesList: {
            'A': { count: 10, price: 10 },
            'B': { count: 15, price: 10 },
        },
        generalAvailable: [
            { day: 'SUN', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
            { day: 'MON', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
            { day: 'TUE', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
            { day: 'WED', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
            { day: 'THU', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
            { day: 'FRI', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
            { day: 'SAT', isOpen: true, openTime: '09:00', closeTime: '17:00', is24Hours: false },
        ],
        is24x7: false,
        gpsLocation: {
            type: 'Point',
            coordinates: [0, 0],
        },
    });

    // Effect to fetch details if editing and get location
    useEffect(() => {
        if (parkingLotId) {
            fetchParkingLotDetails();
        }
        requestLocationPermissionAndGetLocation();
    }, [parkingLotId]);

    // Effect to calculate total slots whenever spacesList changes
    useEffect(() => {
        const total = Object.values(formData.spacesList).reduce((acc, zone) => acc + (zone.count || 0), 0);
        setFormData(prev => ({ ...prev, totalSlot: total }));
    }, [formData.spacesList]);

    // Location Permission and Fetching Logic using Expo Location
    const requestLocationPermissionAndGetLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required.');
                return;
            }
            getCurrentLocation();
        } catch (err) {
            console.warn(err);
            Alert.alert('Error', 'Failed to request location permission.');
        }
    };

    const getCurrentLocation = async () => {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            const { latitude, longitude } = location.coords;
            setCurrentLocation({ latitude, longitude });
            setFormData(prev => ({
                ...prev,
                gpsLocation: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
            }));
        } catch (error) {
            Alert.alert('Location Error', 'Could not get your current location.');
            console.error(error);
        }
    };

    // Fetch existing parking lot details for editing
    const fetchParkingLotDetails = async () => {
        setIsLoading(true);
        try {
            const response = await axiosInstance.get(`/api/merchants/parkinglot/${parkingLotId}`);
            const parkingLotData = response.data.data;

            setFormData({
                parkingName: parkingLotData.parkingName,
                price: parkingLotData.price,
                about: parkingLotData.about,
                contactNumber: parkingLotData.contactNumber,
                email: parkingLotData.email,
                address: parkingLotData.address,
                vehicleType: parkingLotData.vehicleType || 'both',
                totalSlot: parkingLotData.totalSlot || 0,
                spacesList: Object.fromEntries(parkingLotData.spacesList),
                generalAvailable: parkingLotData.generalAvailable,
                is24x7: parkingLotData.is24x7,
                gpsLocation: parkingLotData.gpsLocation,
            });

            if (parkingLotData.images?.length > 0) {
                setImages(parkingLotData.images.map((uri: string) => ({
                    uri,
                    name: uri.split('/').pop() || 'image.jpg',
                    type: 'image/jpeg',
                })));
            }
        } catch (error) {
            console.error('Error fetching parking lot details:', error);
            Alert.alert('Error', 'Failed to fetch parking lot details');
        } finally {
            setIsLoading(false);
        }
    };

    // Image handling functions - UPDATED WITH EXPO IMAGE PICKER
    const handleImageUpload = async () => {
        try {
            // Request permissions first
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'You need to grant permission to access photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                selectionLimit: 5 - images.length,
            });

            if (result.canceled || !result.assets) return;

            const newImages = result.assets.map(asset => ({
                uri: asset.uri || '',
                name: asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
                type: 'image/jpeg',
            }));
            setImages(prev => [...prev, ...newImages]);

        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to select images');
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // Generic handler for form field changes
    const handleChange = (field: keyof ParkingLotFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Specific handlers for complex fields
    const handleSpaceChange = (zone: string, field: 'count' | 'price', value: string) => {
        const numValue = parseInt(value) || 0;
        setFormData(prev => ({
            ...prev,
            spacesList: {
                ...prev.spacesList,
                [zone]: { ...prev.spacesList[zone], [field]: numValue },
            },
        }));
    };

    const addZone = () => {
        const zones = Object.keys(formData.spacesList);
        const newZone = zones.length > 0 ? String.fromCharCode(zones[zones.length - 1].charCodeAt(0) + 1) : 'A';
        setFormData(prev => ({
            ...prev,
            spacesList: { ...prev.spacesList, [newZone]: { count: 0, price: 0 } },
        }));
    };

    const removeZone = (zone: string) => {
        if (Object.keys(formData.spacesList).length <= 1) {
            return Alert.alert('Error', 'You must have at least one zone');
        }
        const newSpaces = { ...formData.spacesList };
        delete newSpaces[zone];
        setFormData(prev => ({ ...prev, spacesList: newSpaces }));
    };

    const handleWorkingHoursChange = (index: number, field: keyof WorkingHours, value: any) => {
        const newWorkingHours = [...formData.generalAvailable];
        newWorkingHours[index] = { ...newWorkingHours[index], [field]: value };
        setFormData(prev => ({ ...prev, generalAvailable: newWorkingHours }));
    };

    // Form submission handler
    const handleSubmit = async () => {
        if (!formData.parkingName || !formData.address || !formData.contactNumber || formData.price <= 0) {
            return Alert.alert('Validation Error', 'Please fill all required fields.');
        }

        setIsLoading(true);
        try {
            const data = new FormData();

            data.append('parkingName', formData.parkingName);
            data.append('about', formData.about);
            data.append('address', formData.address);
            data.append('contactNumber', formData.contactNumber);
            if (formData.email) data.append('email', formData.email);
            data.append('price', formData.price.toString());
            data.append('is24x7', formData.is24x7.toString());
            data.append('vehicleType', formData.vehicleType);
            data.append('totalSlot', formData.totalSlot.toString());
            data.append('spacesList', JSON.stringify(Object.fromEntries(Object.entries(formData.spacesList))));
            data.append('generalAvailable', JSON.stringify(formData.generalAvailable));
            data.append('gpsLocation', JSON.stringify(formData.gpsLocation));

            images.forEach((image) => {
                if (!image.uri.startsWith('http')) {
                    data.append('images', {
                        uri: image.uri,
                        name: image.name,
                        type: image.type,
                    } as any);
                }
            });

            const endpoint = parkingLotId
                ? `/api/merchants/parkinglot/${parkingLotId}`
                : 'https://vervoer-backend2.onrender.com/api/merchants/parkinglot/registration';

            const method = parkingLotId ? 'put' : 'post';

            await axiosInstance[method](endpoint, data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            Alert.alert('Success', `Parking Lot ${parkingLotId ? 'updated' : 'created'} successfully`);
            router.back();

        } catch (error: any) {
            console.error('Error submitting parking lot:', error.response?.data || error.message);
            Alert.alert('Error', error.response?.data?.message || 'Failed to submit details');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !parkingLotId) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={30} color={colors.brandColor} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {parkingLotId ? 'Edit Parking Lot' : 'Register Parking Lot'}
                </Text>
                <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.brandColor} />
                    ) : (
                        <Text style={styles.submitText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                {/* Residence Tab */}
                <TouchableOpacity
                    style={[styles.tabButton, selectedTab === 'Residence' && styles.activeTab]}
                    onPress={() => {
                        setSelectedTab('Residence');
                        router.push('/parkingMerchent/registerResidence');
                    }}
                >
                    <Text style={[styles.tabText, selectedTab === 'Residence' && styles.activeTabText]}>
                        Residence
                    </Text>
                </TouchableOpacity>

                {/* Parking Lot Tab */}
                <TouchableOpacity
                    style={[styles.tabButton, selectedTab === 'Parking Lot' && styles.activeTab]}
                    onPress={() => {
                        setSelectedTab('Parking Lot');
                        router.push('/parkingMerchent/registerParkingLot');
                    }}
                >
                    <Text style={[styles.tabText, selectedTab === 'Parking Lot' && styles.activeTabText]}>
                        Parking Lot
                    </Text>
                </TouchableOpacity>

                {/* Garage Tab */}
                <TouchableOpacity
                    style={[styles.tabButton, selectedTab === 'Garage' && styles.activeTab]}
                    onPress={() => {
                        setSelectedTab('Garage');
                        router.push('/parkingMerchent/registerGarage');
                    }}
                >
                    <Text style={[styles.tabText, selectedTab === 'Garage' && styles.activeTabText]}>
                        Garage
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Parking Lot Image Upload */}
            <View style={styles.imageUploadContainer}>
                <TouchableOpacity 
                    style={styles.imageUploadButton} 
                    onPress={handleImageUpload} 
                    disabled={images.length >= 5}
                >
                    <Camera size={25} color={colors.brandColor} />
                    <Text style={styles.imageUploadText}>Upload Images ({images.length}/5)</Text>
                </TouchableOpacity>
                {images.length > 0 && (
                    <View style={styles.imagePreviewContainer}>
                        {images.map((image, index) => (
                            <View key={index} style={styles.imageWrapper}>
                                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                                <TouchableOpacity 
                                    style={styles.deleteImageButton} 
                                    onPress={() => removeImage(index)}
                                >
                                    <X size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Parking Lot Details */}
            <View style={styles.card}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Parking Lot Name*</Text>
                    <TextInput 
                        style={styles.input} 
                        value={formData.parkingName} 
                        onChangeText={(text) => handleChange('parkingName', text)} 
                        placeholder="Enter parking lot name" 
                    />
                    <Text style={styles.label}>Address*</Text>
                    <TextInput 
                        style={styles.input} 
                        value={formData.address} 
                        onChangeText={(text) => handleChange('address', text)} 
                        placeholder="Enter address" 
                    />
                    <Text style={styles.label}>Price per Hour*</Text>
                    <TextInput 
                        style={styles.input} 
                        value={formData.price.toString()} 
                        onChangeText={(text) => handleChange('price', parseFloat(text) || 0)} 
                        placeholder="Enter base price (e.g., 5.00)" 
                        keyboardType="decimal-pad" 
                    />
                </View>
            </View>

            {/* Vehicle Type Selection */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Vehicle Type Accepted*</Text>
                <View style={styles.vehicleTypeContainer}>
                    {(['bike', 'car', 'both'] as const).map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.vehicleTypeButton, 
                                formData.vehicleType === type && styles.vehicleTypeButtonActive
                            ]}
                            onPress={() => handleChange('vehicleType', type)}
                        >
                            <Text style={[
                                styles.vehicleTypeButtonText, 
                                formData.vehicleType === type && styles.vehicleTypeButtonTextActive
                            ]}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Zones/Spaces Form */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Zones & Spaces (Total: {formData.totalSlot})</Text>
                {Object.entries(formData.spacesList).map(([zone, space]) => (
                    <View key={zone} style={styles.zoneInputContainer}>
                        <Text style={styles.zoneLabel}>Zone {zone}</Text>
                        <TextInput 
                            style={[styles.input, { flex: 1, marginRight: responsiveWidth(2) }]} 
                            value={space.count.toString()} 
                            onChangeText={(text) => handleSpaceChange(zone, 'count', text)} 
                            placeholder="Spaces" 
                            keyboardType="numeric" 
                        />
                        <TextInput 
                            style={[styles.input, { flex: 1 }]} 
                            value={space.price.toString()} 
                            onChangeText={(text) => handleSpaceChange(zone, 'price', text)} 
                            placeholder="Zone Price" 
                            keyboardType="decimal-pad" 
                        />
                        {Object.keys(formData.spacesList).length > 1 && (
                            <TouchableOpacity 
                                style={styles.removeButton} 
                                onPress={() => removeZone(zone)}
                            >
                                <Trash2 size={20} color={colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
                <TouchableOpacity style={styles.addButton} onPress={addZone}>
                    <Plus size={20} color={colors.brandColor} />
                    <Text style={styles.addButtonText}>Add Zone</Text>
                </TouchableOpacity>
            </View>

            {/* About Form */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>About</Text>
                <TextInput 
                    style={[styles.input, { height: responsiveHeight(10), textAlignVertical: 'top' }]} 
                    value={formData.about} 
                    onChangeText={(text) => handleChange('about', text)} 
                    placeholder="Describe your parking lot..." 
                    multiline 
                />
            </View>

            {/* Contact & Availability */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Contact Info</Text>
                <Text style={styles.label}>Contact Number*</Text>
                <TextInput 
                    style={styles.input} 
                    value={formData.contactNumber} 
                    onChangeText={(text) => handleChange('contactNumber', text)} 
                    placeholder="Enter contact number" 
                    keyboardType="phone-pad" 
                />
                <Text style={styles.label}>Email</Text>
                <TextInput 
                    style={styles.input} 
                    value={formData.email} 
                    onChangeText={(text) => handleChange('email', text)} 
                    placeholder="Enter email" 
                    keyboardType="email-address" 
                />
            </View>

            {/* Working Hours Section */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Availability</Text>
                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Open 24/7?</Text>
                    <TouchableOpacity
                        style={[styles.switchButton, formData.is24x7 && styles.switchButtonActive]}
                        onPress={() => handleChange('is24x7', !formData.is24x7)}
                    >
                        <Text style={[styles.switchText, formData.is24x7 && { color: '#FFF' }]}>
                            {formData.is24x7 ? 'YES' : 'NO'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {!formData.is24x7 && (
                    <>
                        {formData.generalAvailable.map((day, index) => (
                            <View key={day.day} style={styles.dayContainer}>
                                <Text style={styles.dayLabel}>{day.day}</Text>

                                <View style={styles.switchContainer}>
                                    <Text style={styles.label}>Open</Text>
                                    <TouchableOpacity
                                        style={[styles.switchButton, day.isOpen && styles.switchButtonActive]}
                                        onPress={() => handleWorkingHoursChange(index, 'isOpen', !day.isOpen)}
                                    >
                                        <Text style={[styles.switchText, day.isOpen && { color: '#FFF' }]}>
                                            {day.isOpen ? 'YES' : 'NO'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {day.isOpen && !day.is24Hours && (
                                    <>
                                        <Text style={styles.label}>Open Time</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={day.openTime}
                                            onChangeText={(text) => handleWorkingHoursChange(index, 'openTime', text)}
                                            placeholder="09:00"
                                        />

                                        <Text style={styles.label}>Close Time</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={day.closeTime}
                                            onChangeText={(text) => handleWorkingHoursChange(index, 'closeTime', text)}
                                            placeholder="17:00"
                                        />
                                    </>
                                )}

                                {day.isOpen && (
                                    <View style={styles.switchContainer}>
                                        <Text style={styles.label}>24 Hours for this day?</Text>
                                        <TouchableOpacity
                                            style={[styles.switchButton, day.is24Hours && styles.switchButtonActive]}
                                            onPress={() => handleWorkingHoursChange(index, 'is24Hours', !day.is24Hours)}
                                        >
                                            <Text style={[styles.switchText, day.is24Hours && { color: '#FFF' }]}>
                                                {day.is24Hours ? 'YES' : 'NO'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </>
                )}
            </View>

            {/* Location */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Location (GPS)</Text>
                {currentLocation ? (
                    <>
                        <Text style={styles.label}>
                            Latitude: {currentLocation.latitude.toFixed(6)}
                        </Text>
                        <Text style={styles.label}>
                            Longitude: {currentLocation.longitude.toFixed(6)}
                        </Text>
                        <TouchableOpacity 
                            style={styles.locationButton} 
                            onPress={requestLocationPermissionAndGetLocation}
                        >
                            <Text style={styles.locationButtonText}>Refresh Location</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <ActivityIndicator size="small" color={colors.brandColor} />
                )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSubmit} 
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={styles.submitButtonText}>
                        {parkingLotId ? 'Update Parking Lot' : 'Save Parking Lot'}
                    </Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

// RegisterParkingLot
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    contentContainer: { paddingBottom: 30 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: responsiveWidth(5), 
        paddingVertical: responsiveHeight(2), 
        backgroundColor: '#FFF', 
        borderBottomWidth: 1, 
        borderBottomColor: '#EEE', 
        marginTop: Platform.OS === 'ios' ? responsiveHeight(6) : responsiveHeight(2) 
    },
    headerTitle: { fontSize: responsiveFontSize(2.5), color: colors.black, fontWeight: 'bold' },
    submitText: { color: colors.brandColor, fontSize: responsiveFontSize(2), fontWeight: 'bold' },
    tabContainer: { 
        flexDirection: 'row', 
        justifyContent: 'center', 
        marginVertical: responsiveHeight(2),
        backgroundColor: '#FFF',
        paddingVertical: responsiveHeight(1),
    },
    tabButton: {
        paddingVertical: responsiveHeight(1.2),
        paddingHorizontal: responsiveWidth(5),
        borderRadius: 20,
        marginHorizontal: responsiveWidth(1),
        backgroundColor: '#E0E0E0',
    },
    activeTab: {
        backgroundColor: colors.brandColor,
    },
    tabText: {
        fontSize: responsiveFontSize(1.8),
        color: colors.black,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#FFF',
    },
    imageUploadContainer: { marginHorizontal: responsiveWidth(5), marginVertical: responsiveHeight(2) },
    imageUploadButton: { 
        borderWidth: 1, 
        borderColor: colors.brandColor, 
        borderRadius: 10, 
        padding: responsiveWidth(4), 
        alignItems: 'center', 
        justifyContent: 'center', 
        flexDirection: 'row', 
        borderStyle: 'dashed' 
    },
    imageUploadText: { color: colors.brandColor, fontSize: responsiveFontSize(1.8), marginLeft: responsiveWidth(2) },
    imagePreviewContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: responsiveHeight(1) },
    imageWrapper: { position: 'relative', margin: responsiveWidth(1) },
    imagePreview: { width: responsiveWidth(25), height: responsiveWidth(25), borderRadius: 10 },
    deleteImageButton: { 
        position: 'absolute', 
        top: -5, 
        right: -5, 
        backgroundColor: 'white', 
        borderRadius: 15,
        padding: 2 
    },
    card: { 
        backgroundColor: '#FFF', 
        marginHorizontal: responsiveWidth(5), 
        marginBottom: responsiveHeight(2), 
        padding: responsiveWidth(4), 
        borderRadius: 10, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        elevation: 3 
    },
    inputContainer: { flex: 1 },
    label: { fontSize: responsiveFontSize(1.8), color: colors.gray, marginBottom: responsiveHeight(0.5) },
    input: { 
        backgroundColor: '#F5F5F5', 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: colors.lightGray, 
        paddingVertical: responsiveHeight(1.5), 
        paddingHorizontal: responsiveWidth(4), 
        fontSize: responsiveFontSize(1.8), 
        color: colors.black, 
        marginBottom: responsiveHeight(1.5) 
    },
    sectionTitle: { 
        fontSize: responsiveFontSize(2.2), 
        fontWeight: 'bold', 
        color: colors.black, 
        marginBottom: responsiveHeight(1.5) 
    },
    vehicleTypeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: responsiveHeight(2),
    },
    vehicleTypeButton: {
        flex: 1,
        paddingVertical: responsiveHeight(1.5),
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.lightGray,
        alignItems: 'center',
        marginHorizontal: responsiveWidth(1),
    },
    vehicleTypeButtonActive: {
        borderColor: colors.brandColor,
        backgroundColor: '#E3F2FD',
    },
    vehicleTypeButtonText: {
        fontSize: responsiveFontSize(1.8),
        color: colors.gray,
        fontWeight: '600',
    },
    vehicleTypeButtonTextActive: {
        color: colors.brandColor,
    },
    zoneInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveHeight(1) },
    zoneLabel: { 
        fontSize: responsiveFontSize(1.8), 
        fontWeight: 'bold', 
        color: colors.black, 
        marginRight: responsiveWidth(2), 
        minWidth: responsiveWidth(15) 
    },
    removeButton: { marginLeft: responsiveWidth(2), padding: responsiveWidth(2) },
    addButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: responsiveWidth(3), 
        borderWidth: 1, 
        borderColor: colors.brandColor, 
        borderRadius: 8, 
        marginTop: responsiveHeight(1), 
        borderStyle: 'dashed' 
    },
    addButtonText: { 
        color: colors.brandColor, 
        fontSize: responsiveFontSize(1.8), 
        marginLeft: responsiveWidth(2), 
        fontWeight: '600' 
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: responsiveHeight(2),
        paddingVertical: responsiveHeight(0.5),
    },
    switchButton: {
        paddingVertical: responsiveHeight(0.5),
        paddingHorizontal: responsiveWidth(4),
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.lightGray,
        backgroundColor: '#F5F5F5',
    },
    switchButtonActive: {
        backgroundColor: colors.brandColor,
        borderColor: colors.brandColor,
    },
    switchText: {
        fontSize: responsiveFontSize(1.6),
        color: colors.gray,
        fontWeight: '600',
    },
    dayContainer: {
        marginBottom: responsiveHeight(2),
        paddingBottom: responsiveHeight(2),
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    dayLabel: {
        fontSize: responsiveFontSize(2),
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: responsiveHeight(1),
    },
    locationButton: {
        backgroundColor: colors.brandColor,
        paddingVertical: responsiveHeight(1.5),
        paddingHorizontal: responsiveWidth(4),
        borderRadius: 8,
        alignItems: 'center',
        marginTop: responsiveHeight(1),
    },
    locationButtonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(1.8),
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: colors.brandColor,
        marginHorizontal: responsiveWidth(5),
        paddingVertical: responsiveHeight(2),
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: responsiveHeight(2),
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(2.2),
        fontWeight: 'bold',
    },
});

export default RegisterParkingLot;