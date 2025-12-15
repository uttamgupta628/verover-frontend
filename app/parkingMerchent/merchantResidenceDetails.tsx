import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Switch,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from 'react-native-responsive-dimensions';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import { useSelector } from 'react-redux';
import { RootState } from '../../components/redux/store';
import axiosInstance from '../../api/axios';
import { ArrowLeft, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';

// Define the data structure for a Residence
interface WorkingHours {
    day: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
    isOpen?: boolean;
    openTime?: string;
    closeTime?: string;
    is24Hours: boolean;
}

interface IResidence {
    _id: string;
    residenceName: string;
    about: string;
    address: string;
    contactNumber: string;
    email?: string;
    price: number;
    images: string[];
    generalAvailable: WorkingHours[];
    is24x7: boolean;
    gpsLocation: {
        type: 'Point';
        coordinates: [number, number];
    };
    isActive: boolean;
    emergencyContact?: {
        person: string;
        number: string;
    };
    parking_pass: boolean;
    transportationAvailable: boolean;
    transportationTypes?: string[];
    coveredDrivewayAvailable: boolean;
    coveredDrivewayTypes?: string[];
    securityCamera: boolean;
}

const MerchantResidenceDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { token } = useSelector((state: RootState) => state.auth);

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [residenceDetails, setResidenceDetails] = useState<IResidence | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<IResidence>>({});
    const [isUpdating, setIsUpdating] = useState(false);
    const [localImages, setLocalImages] = useState<{ uri: string; name: string; type: string }[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Get residenceId from params
    const residenceId = params.residenceId as string;

    const fetchResidenceDetails = useCallback(async (showLoader = true) => {
        if (!residenceId) {
            setError('No residence ID provided.');
            return;
        }

        if (showLoader) setIsLoading(true);
        setError(null);

        try {
            const response = await axiosInstance.get(`/merchants/residence/${residenceId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data?.success && response.data.data) {
                const fetchedData = response.data.data;
                setResidenceDetails(fetchedData);
                setFormData(fetchedData);
                setLocalImages(fetchedData.images.map((uri: string) => ({
                    uri,
                    name: uri.split('/').pop() || 'image.jpg',
                    type: 'image/jpeg',
                })));
            } else {
                throw new Error(response.data?.message || 'Invalid response.');
            }
        } catch (err: any) {
            console.error('Error fetching residence details:', err.response?.data || err.message);
            setError('Failed to load residence details: ' + (err.response?.data?.message || err.message));
        } finally {
            if (showLoader) setIsLoading(false);
            setRefreshing(false);
        }
    }, [residenceId, token]);

    useFocusEffect(
        useCallback(() => {
            fetchResidenceDetails();
        }, [fetchResidenceDetails])
    );

    const handleDeleteResidence = async () => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this residence? This is irreversible.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            await axiosInstance.delete(`/merchants/residence/delete/${residenceId}`, {
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            Alert.alert('Success', 'Residence deleted successfully.');
                            router.back();
                        } catch (err: any) {
                            Alert.alert('Deletion Failed', err.response?.data?.message || 'An error occurred.');
                        } finally {
                            setIsLoading(false);
                        }
                    },
                    style: 'destructive',
                },
            ]
        );
    };

    const handleUpdateResidence = async () => {
        if (!residenceId || !formData) return;

        setIsUpdating(true);
        setError(null);

        try {
            const data = new FormData();

            // Append all fields, converting where necessary
            Object.keys(formData).forEach(key => {
                const formKey = key as keyof IResidence;
                const value = formData[formKey];

                if (value === undefined || value === null) return;

                if (['generalAvailable', 'gpsLocation', 'emergencyContact', 'transportationTypes', 'coveredDrivewayTypes'].includes(formKey)) {
                    data.append(formKey, JSON.stringify(value));
                } else if (typeof value === 'boolean') {
                    data.append(formKey, String(value));
                } else if (typeof value === 'number') {
                    data.append(formKey, value.toString());
                } else if (typeof value === 'string') {
                    data.append(formKey, value);
                }
            });

            // Handle images
            localImages.forEach((image) => {
                if (!image.uri.startsWith('http')) {
                    data.append('images', {
                        uri: image.uri,
                        name: image.name,
                        type: image.type,
                    } as any);
                }
            });

            const response = await axiosInstance.put(`/merchants/residence/update/${residenceId}`, data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data?.success) {
                Alert.alert('Success', 'Residence updated successfully');
                setIsEditing(false);
                await fetchResidenceDetails(false);
            } else {
                throw new Error(response.data?.message || 'Update failed');
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message;
            setError(errorMessage);
            Alert.alert('Update Error', errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleInputChange = (field: keyof IResidence, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleEmergencyContactChange = (field: 'person' | 'number', value: string) => {
        setFormData(prev => ({
            ...prev,
            emergencyContact: {
                ...(prev.emergencyContact || { person: '', number: '' }),
                [field]: value,
            },
        }));
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setFormData(residenceDetails || {});
        setLocalImages(residenceDetails?.images.map(uri => ({
            uri,
            name: uri.split('/').pop() || 'image.jpg',
            type: 'image/jpeg',
        })) || []);
        setError(null);
    };

    const handleImagePickerForEdit = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
            selectionLimit: 10 - localImages.length,
        });
        if (result.assets) {
            const newImages = result.assets.map(asset => ({
                uri: asset.uri || '',
                name: asset.fileName || `image_${Date.now()}.jpg`,
                type: asset.type || 'image/jpeg',
            }));
            setLocalImages(prev => [...prev, ...newImages]);
        }
    };

    const removeLocalImage = (index: number) => {
        setLocalImages(prev => prev.filter((_, i) => i !== index));
        if (currentImageIndex >= localImages.length - 1) {
            setCurrentImageIndex(Math.max(0, localImages.length - 2));
        }
    };

    const handleNextImage = () => setCurrentImageIndex(prev => (prev + 1) % localImages.length);
    const handlePrevImage = () => setCurrentImageIndex(prev => (prev - 1 + localImages.length) % localImages.length);

    // Render functions for different states
    if (isLoading && !residenceDetails) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
            </View>
        );
    }

    if (error && !residenceDetails) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchResidenceDetails()}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!residenceDetails) {
        return (
            <View style={styles.loadingContainer}>
                <Text>No residence data found.</Text>
            </View>
        );
    }

    // Main component render
    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={() => fetchResidenceDetails(false)} 
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={30} color={colors.brandColor} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {residenceDetails.residenceName}
                </Text>
                <View style={styles.headerActions}>
                    {isEditing ? (
                        <>
                            <TouchableOpacity onPress={handleCancelEdit}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleUpdateResidence} 
                                disabled={isUpdating} 
                                style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                            >
                                <Text style={styles.saveText}>
                                    {isUpdating ? 'Saving...' : 'Save'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity onPress={() => setIsEditing(true)}>
                                <Text style={styles.editText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleDeleteResidence}>
                                <Trash2 size={25} color={colors.error} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {/* Image Gallery */}
            <View style={styles.imageGalleryContainer}>
                {localImages.length > 0 ? (
                    <View style={styles.imageWrapper}>
                        <Image 
                            source={{ uri: localImages[currentImageIndex].uri }} 
                            style={styles.galleryImage} 
                        />
                        {isEditing && (
                            <TouchableOpacity 
                                style={styles.deleteGalleryImageButton} 
                                onPress={() => removeLocalImage(currentImageIndex)}
                            >
                                <X size={20} color={colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <Image source={images.defaultParkingLot} style={styles.mainImagePlaceholder} />
                )}
                {localImages.length > 1 && (
                    <>
                        <TouchableOpacity 
                            style={[styles.arrowButton, styles.leftArrow]} 
                            onPress={handlePrevImage}
                        >
                            <ChevronLeft size={24} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.arrowButton, styles.rightArrow]} 
                            onPress={handleNextImage}
                        >
                            <ChevronRight size={24} color="#FFF" />
                        </TouchableOpacity>
                    </>
                )}
                {isEditing && (
                    <TouchableOpacity 
                        style={styles.addImagesButton} 
                        onPress={handleImagePickerForEdit}
                    >
                        <Text style={styles.addImagesText}>Add Images</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Basic Info */}
            <View style={styles.card}>
                <Text style={styles.label}>Residence Name</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.residenceName || ''} 
                        onChangeText={text => handleInputChange('residenceName', text)} 
                    />
                ) : (
                    <Text style={styles.displayValue}>{residenceDetails.residenceName}</Text>
                )}

                <Text style={styles.label}>Address</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.address || ''} 
                        onChangeText={text => handleInputChange('address', text)} 
                        multiline 
                    />
                ) : (
                    <Text style={styles.displayValue}>{residenceDetails.address}</Text>
                )}

                <Text style={styles.label}>Price per Night</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.price?.toString() || ''} 
                        onChangeText={text => handleInputChange('price', parseFloat(text) || 0)} 
                        keyboardType="numeric" 
                    />
                ) : (
                    <Text style={styles.priceValue}>
                        ${residenceDetails.price?.toFixed(2) || '0.00'}/night
                    </Text>
                )}

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Active Listing</Text>
                    {isEditing ? (
                        <Switch 
                            value={formData.isActive} 
                            onValueChange={value => handleInputChange('isActive', value)} 
                            trackColor={{ false: '#767577', true: colors.brandColor }} 
                        />
                    ) : (
                        <Text style={styles.displayValue}>
                            {residenceDetails.isActive ? 'Yes' : 'No'}
                        </Text>
                    )}
                </View>
            </View>

            {/* About Section */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>About</Text>
                {isEditing ? (
                    <TextInput 
                        style={[styles.input, styles.aboutInput]} 
                        value={formData.about || ''} 
                        onChangeText={text => handleInputChange('about', text)} 
                        multiline 
                    />
                ) : (
                    <Text style={styles.aboutText}>
                        {residenceDetails.about || 'No description.'}
                    </Text>
                )}
            </View>

            {/* Amenities Section */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Amenities</Text>
                
                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Security Camera</Text>
                    {isEditing ? (
                        <Switch 
                            value={formData.securityCamera} 
                            onValueChange={v => handleInputChange('securityCamera', v)} 
                        />
                    ) : (
                        <Text style={styles.displayValue}>
                            {residenceDetails.securityCamera ? 'Yes' : 'No'}
                        </Text>
                    )}
                </View>

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Parking Pass</Text>
                    {isEditing ? (
                        <Switch 
                            value={formData.parking_pass} 
                            onValueChange={v => handleInputChange('parking_pass', v)} 
                        />
                    ) : (
                        <Text style={styles.displayValue}>
                            {residenceDetails.parking_pass ? 'Yes' : 'No'}
                        </Text>
                    )}
                </View>

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Transportation</Text>
                    {isEditing ? (
                        <Switch 
                            value={formData.transportationAvailable} 
                            onValueChange={v => handleInputChange('transportationAvailable', v)} 
                        />
                    ) : (
                        <Text style={styles.displayValue}>
                            {residenceDetails.transportationAvailable ? 'Yes' : 'No'}
                        </Text>
                    )}
                </View>
                {formData.transportationAvailable && isEditing && (
                    <TextInput 
                        style={styles.input} 
                        value={formData.transportationTypes?.join(', ') || ''} 
                        onChangeText={t => handleInputChange('transportationTypes', t.split(',').map(s => s.trim()))} 
                        placeholder="e.g., Bus, Metro"
                    />
                )}

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Covered Driveway</Text>
                    {isEditing ? (
                        <Switch 
                            value={formData.coveredDrivewayAvailable} 
                            onValueChange={v => handleInputChange('coveredDrivewayAvailable', v)} 
                        />
                    ) : (
                        <Text style={styles.displayValue}>
                            {residenceDetails.coveredDrivewayAvailable ? 'Yes' : 'No'}
                        </Text>
                    )}
                </View>
                {formData.coveredDrivewayAvailable && isEditing && (
                    <TextInput 
                        style={styles.input} 
                        value={formData.coveredDrivewayTypes?.join(', ') || ''} 
                        onChangeText={t => handleInputChange('coveredDrivewayTypes', t.split(',').map(s => s.trim()))} 
                        placeholder="e.g., Garage, Carport"
                    />
                )}
            </View>

            {/* Contact Info */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                
                <Text style={styles.label}>Contact Number</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.contactNumber || ''} 
                        onChangeText={t => handleInputChange('contactNumber', t)} 
                        keyboardType="phone-pad"
                    />
                ) : (
                    <Text style={styles.displayValue}>{residenceDetails.contactNumber}</Text>
                )}

                <Text style={styles.label}>Email</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.email || ''} 
                        onChangeText={t => handleInputChange('email', t)} 
                        keyboardType="email-address"
                    />
                ) : (
                    <Text style={styles.displayValue}>{residenceDetails.email || 'N/A'}</Text>
                )}

                <Text style={styles.label}>Emergency Contact Person</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.emergencyContact?.person || ''} 
                        onChangeText={t => handleEmergencyContactChange('person', t)} 
                    />
                ) : (
                    <Text style={styles.displayValue}>
                        {residenceDetails.emergencyContact?.person || 'N/A'}
                    </Text>
                )}

                <Text style={styles.label}>Emergency Contact Number</Text>
                {isEditing ? (
                    <TextInput 
                        style={styles.input} 
                        value={formData.emergencyContact?.number || ''} 
                        onChangeText={t => handleEmergencyContactChange('number', t)} 
                        keyboardType="phone-pad"
                    />
                ) : (
                    <Text style={styles.displayValue}>
                        {residenceDetails.emergencyContact?.number || 'N/A'}
                    </Text>
                )}
            </View>

            <View style={{ height: responsiveHeight(5) }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: responsiveWidth(5),
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
        marginTop: Platform.OS === 'ios' ? responsiveHeight(6) : responsiveHeight(2),
    },
    headerTitle: {
        fontSize: responsiveFontSize(2.2),
        fontWeight: 'bold',
        color: colors.black,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: responsiveWidth(2),
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: responsiveWidth(4),
    },
    editText: {
        color: colors.brandColor,
        fontSize: responsiveFontSize(1.8),
        fontWeight: 'bold',
    },
    cancelText: {
        color: colors.error,
        fontSize: responsiveFontSize(1.8),
        fontWeight: 'bold',
    },
    saveButton: {
        padding: responsiveWidth(1.5),
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveText: {
        color: colors.success,
        fontSize: responsiveFontSize(1.8),
        fontWeight: 'bold',
    },
    imageGalleryContainer: {
        height: responsiveHeight(30),
        width: '90%',
        backgroundColor: colors.lightGray,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        alignSelf: 'center',
        borderRadius: responsiveWidth(10),
        overflow: 'hidden',
        marginVertical: responsiveHeight(2),
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    galleryImage: {
        width: '100%',
        height: '100%',
    },
    deleteGalleryImageButton: {
        position: 'absolute',
        top: responsiveWidth(2.5),
        right: responsiveWidth(2.5),
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: responsiveWidth(5),
        padding: responsiveWidth(1.5),
    },
    mainImagePlaceholder: {
        width: '100%',
        height: '100%',
    },
    addImagesButton: {
        position: 'absolute',
        bottom: responsiveWidth(2.5),
        right: responsiveWidth(2.5),
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: responsiveHeight(1),
        paddingHorizontal: responsiveWidth(3.5),
        borderRadius: 5,
    },
    addImagesText: {
        color: 'white',
        fontSize: responsiveFontSize(1.6),
    },
    arrowButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -responsiveWidth(5),
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: responsiveWidth(5.5),
        width: responsiveWidth(11),
        height: responsiveWidth(11),
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    leftArrow: {
        left: responsiveWidth(2),
    },
    rightArrow: {
        right: responsiveWidth(2),
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: responsiveWidth(4),
        margin: responsiveWidth(3),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    displayValue: {
        fontSize: responsiveFontSize(1.8),
        color: colors.black,
        marginBottom: responsiveHeight(1),
    },
    priceValue: {
        fontSize: responsiveFontSize(2),
        color: colors.brandColor,
        fontWeight: 'bold',
        marginBottom: responsiveHeight(1),
    },
    label: {
        fontSize: responsiveFontSize(1.8),
        color: colors.gray,
        marginBottom: responsiveHeight(0.5),
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.lightGray,
        padding: responsiveWidth(3),
        fontSize: responsiveFontSize(1.8),
        color: colors.black,
        marginBottom: responsiveHeight(1),
    },
    sectionTitle: {
        fontSize: responsiveFontSize(2),
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: responsiveHeight(1.5),
    },
    aboutInput: {
        minHeight: responsiveHeight(10),
        textAlignVertical: 'top',
    },
    aboutText: {
        fontSize: responsiveFontSize(1.8),
        color: colors.black,
        lineHeight: responsiveHeight(2.5),
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: responsiveHeight(1),
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: responsiveWidth(5),
    },
    errorText: {
        fontSize: responsiveFontSize(1.8),
        color: colors.error,
        textAlign: 'center',
        marginBottom: responsiveHeight(2),
    },
    retryButton: {
        backgroundColor: colors.brandColor,
        borderRadius: 8,
        padding: responsiveWidth(4),
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(1.8),
        fontWeight: 'bold',
    },
});

export default MerchantResidenceDetails;