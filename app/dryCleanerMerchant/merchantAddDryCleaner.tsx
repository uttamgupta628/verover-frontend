import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../components/redux/store';
import colors from '../../assets/color';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFontSize = (size: number) => {
    const scale = Math.min(width / 375, height / 812);
    return size * scale;
};

interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

interface HoursOfOperation {
    day: string;
    open: string;
    close: string;
}

interface Service {
    name: string;
    category: string;
    strachLevel: number;
    washOnly: boolean;
    additionalservice: 'zipper' | 'button' | 'wash/fold';
    price: number;
}

interface SelectedImage {
    uri: string;
    type: string;
    fileName?: string;
}

interface Images {
    contactPersonImg: SelectedImage | null;
    shopImages: SelectedImage[];
}

const DryClean: React.FC = () => {
    const router = useRouter();
    const authToken = useSelector((state: RootState) => state.auth.token);
    
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        shopname: '',
        address: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: '',
        },
        about: '',
        contactPerson: '',
        phoneNumber: '',
        hoursOfOperation: [
            { day: 'Monday', open: '09:00 AM', close: '07:00 PM' },
            { day: 'Tuesday', open: '09:00 AM', close: '07:00 PM' },
            { day: 'Wednesday', open: '09:00 AM', close: '07:00 PM' },
            { day: 'Thursday', open: '09:00 AM', close: '07:00 PM' },
            { day: 'Friday', open: '09:00 AM', close: '07:00 PM' },
            { day: 'Saturday', open: '09:00 AM', close: '05:00 PM' },
            { day: 'Sunday', open: '10:00 AM', close: '04:00 PM' },
        ],
        services: [
            {
                name: 'Shirt Cleaning',
                category: 'Clothes',
                strachLevel: 3,
                washOnly: false,
                additionalservice: 'zipper' as const,
                price: 50,
            },
        ],
    });
    
    const [images, setImages] = useState<Images>({
        contactPersonImg: null,
        shopImages: [],
    });

    // Handle text input changes
    const handleInputChange = (field: string, value: string): void => {
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev[parent as keyof typeof prev] as any),
                    [child]: value,
                },
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [field]: value,
            }));
        }
    };

    // Handle hours of operation changes
    const handleHoursChange = (index: number, field: keyof HoursOfOperation, value: string): void => {
        setFormData(prev => ({
            ...prev,
            hoursOfOperation: prev.hoursOfOperation.map((hour, i) =>
                i === index ? { ...hour, [field]: value } : hour
            ),
        }));
    };

    // Handle service changes
    const handleServiceChange = (index: number, field: keyof Service, value: string | number | boolean): void => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.map((service, i) =>
                i === index ? { ...service, [field]: value } : service
            ),
        }));
    };

    // Add new service
    const addService = (): void => {
        setFormData(prev => ({
            ...prev,
            services: [
                ...prev.services,
                {
                    name: '',
                    category: '',
                    strachLevel: 3,
                    washOnly: false,
                    additionalservice: 'zipper' as const,
                    price: 0,
                },
            ],
        }));
    };

    // Remove service
    const removeService = (index: number): void => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.filter((_, i) => i !== index),
        }));
    };

    // Handle contact person image selection
    const handleContactImagePick = async (): Promise<void> => {
        try {
            // Request permissions
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please allow access to your photo library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setImages(prev => ({
                    ...prev,
                    contactPersonImg: {
                        uri: asset.uri,
                        type: 'image/jpeg',
                        fileName: asset.fileName || 'contact.jpg',
                    },
                }));
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    // Handle shop images selection
    const handleShopImagesPick = async (): Promise<void> => {
        try {
            // Request permissions
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please allow access to your photo library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 4,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedImages: SelectedImage[] = result.assets.map(asset => ({
                    uri: asset.uri,
                    type: 'image/jpeg',
                    fileName: asset.fileName || `shop_${Date.now()}.jpg`,
                }));
                setImages(prev => ({
                    ...prev,
                    shopImages: selectedImages,
                }));
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to pick images. Please try again.');
        }
    };

    // Submit form
    const handleSubmit = async (): Promise<void> => {
        try {
            setLoading(true);

            // Validate required fields
            if (!formData.shopname || !formData.contactPerson || !formData.phoneNumber) {
                Alert.alert('Error', 'Please fill in all required fields');
                return;
            }

            // Create FormData
            const submitData = new FormData();
            
            // Add text fields
            submitData.append('shopname', formData.shopname);
            submitData.append('address', JSON.stringify(formData.address));
            submitData.append('about', formData.about);
            submitData.append('contactPerson', formData.contactPerson);
            submitData.append('phoneNumber', formData.phoneNumber);
            submitData.append('hoursOfOperation', JSON.stringify(formData.hoursOfOperation));
            submitData.append('services', JSON.stringify(formData.services));

            // Add contact person image
            if (images.contactPersonImg) {
                const { uri, type, fileName } = images.contactPersonImg;
                const imageName = fileName || 'contact.jpg';
                const imageType = type || 'image/jpeg';
                
                // For React Native, we need to create a proper FormData object
                const imageData = {
                    uri,
                    type: imageType,
                    name: imageName,
                };
                submitData.append('contactPersonImg', imageData as any);
            }

            // Add shop images
            images.shopImages.forEach((image, index) => {
                const { uri, type, fileName } = image;
                const imageName = fileName || `shop_${index}.jpg`;
                const imageType = type || 'image/jpeg';
                
                const imageData = {
                    uri,
                    type: imageType,
                    name: imageName,
                };
                submitData.append('shopimage', imageData as any);
            });

            // Make API call - Update with your actual backend URL
            const response = await fetch('https://vervoer-backend2.onrender.com/api/users/dry-cleaner', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: submitData,
            });

            const result = await response.json();

            if (response.ok) {
                Alert.alert('Success', 'Dry Cleaner registered successfully!', [
                    { text: 'OK', onPress: () => router.back() },
                ]);
            } else {
                Alert.alert('Error', result.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Fixed Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={30} color={colors.brandColor} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Register Dry Cleaner</Text>
                <View style={{ width: 30 }} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Shop Basic Info */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Shop Information</Text>
                    
                    <Text style={styles.label}>Shop Name *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.shopname}
                        onChangeText={(value) => handleInputChange('shopname', value)}
                        placeholder="Enter shop name"
                        placeholderTextColor={colors.gray}
                    />

                    <Text style={styles.label}>Contact Person *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.contactPerson}
                        onChangeText={(value) => handleInputChange('contactPerson', value)}
                        placeholder="Enter contact person name"
                        placeholderTextColor={colors.gray}
                    />

                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.phoneNumber}
                        onChangeText={(value) => handleInputChange('phoneNumber', value)}
                        placeholder="Enter phone number"
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.gray}
                    />

                    <Text style={styles.label}>About</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={formData.about}
                        onChangeText={(value) => handleInputChange('about', value)}
                        placeholder="Describe your dry cleaning service"
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={colors.gray}
                    />
                </View>

                {/* Address */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Address</Text>
                    
                    <Text style={styles.label}>Street</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.address.street}
                        onChangeText={(value) => handleInputChange('address.street', value)}
                        placeholder="Enter street address"
                        placeholderTextColor={colors.gray}
                    />

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>City</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.address.city}
                                onChangeText={(value) => handleInputChange('address.city', value)}
                                placeholder="City"
                                placeholderTextColor={colors.gray}
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>State</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.address.state}
                                onChangeText={(value) => handleInputChange('address.state', value)}
                                placeholder="State"
                                placeholderTextColor={colors.gray}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Zip Code</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.address.zipCode}
                                onChangeText={(value) => handleInputChange('address.zipCode', value)}
                                placeholder="Zip Code"
                                placeholderTextColor={colors.gray}
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Country</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.address.country}
                                onChangeText={(value) => handleInputChange('address.country', value)}
                                placeholder="Country"
                                placeholderTextColor={colors.gray}
                            />
                        </View>
                    </View>
                </View>

                {/* Images */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Images</Text>
                    
                    <TouchableOpacity style={styles.imageButton} onPress={handleContactImagePick}>
                        <MaterialCommunityIcons name="camera" size={24} color="#FFF" />
                        <Text style={styles.buttonText}>
                            {images.contactPersonImg ? 'Contact Image Selected' : 'Select Contact Person Image'}
                        </Text>
                    </TouchableOpacity>
                    
                    {images.contactPersonImg && (
                        <Image 
                            source={{ uri: images.contactPersonImg.uri }} 
                            style={styles.previewImage}
                            contentFit="cover"
                        />
                    )}

                    <TouchableOpacity style={styles.imageButton} onPress={handleShopImagesPick}>
                        <MaterialCommunityIcons name="image-multiple" size={24} color="#FFF" />
                        <Text style={styles.buttonText}>
                            {images.shopImages.length > 0 
                                ? `${images.shopImages.length} Shop Images Selected` 
                                : 'Select Shop Images (Max 4)'}
                        </Text>
                    </TouchableOpacity>
                    
                    <View style={styles.imagePreviewContainer}>
                        {images.shopImages.map((image, index) => (
                            <Image 
                                key={index} 
                                source={{ uri: image.uri }} 
                                style={styles.shopPreviewImage}
                                contentFit="cover"
                            />
                        ))}
                    </View>
                </View>

                {/* Hours of Operation */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Hours of Operation</Text>
                    {formData.hoursOfOperation.map((hour, index) => (
                        <View key={index} style={styles.hourRow}>
                            <Text style={styles.dayText}>{hour.day}</Text>
                            <View style={styles.timeInputs}>
                                <TextInput
                                    style={styles.timeInput}
                                    value={hour.open}
                                    onChangeText={(value) => handleHoursChange(index, 'open', value)}
                                    placeholder="Open"
                                    placeholderTextColor={colors.gray}
                                />
                                <Text style={styles.toText}>to</Text>
                                <TextInput
                                    style={styles.timeInput}
                                    value={hour.close}
                                    onChangeText={(value) => handleHoursChange(index, 'close', value)}
                                    placeholder="Close"
                                    placeholderTextColor={colors.gray}
                                />
                            </View>
                        </View>
                    ))}
                </View>

                {/* Services */}
                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Services</Text>
                        <TouchableOpacity onPress={addService} style={styles.addButton}>
                            <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                            <Text style={styles.addButtonText}>Add Service</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {formData.services.map((service, index) => (
                        <View key={index} style={styles.serviceCard}>
                            <View style={styles.serviceHeader}>
                                <Text style={styles.serviceTitle}>Service {index + 1}</Text>
                                {formData.services.length > 1 && (
                                    <TouchableOpacity onPress={() => removeService(index)}>
                                        <MaterialCommunityIcons name="close" size={20} color="#FF6B6B" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            
                            <Text style={styles.label}>Service Name</Text>
                            <TextInput
                                style={styles.input}
                                value={service.name}
                                onChangeText={(value) => handleServiceChange(index, 'name', value)}
                                placeholder="e.g., Shirt Cleaning"
                                placeholderTextColor={colors.gray}
                            />
                            
                            <Text style={styles.label}>Category</Text>
                            <TextInput
                                style={styles.input}
                                value={service.category}
                                onChangeText={(value) => handleServiceChange(index, 'category', value)}
                                placeholder="e.g., Clothes"
                                placeholderTextColor={colors.gray}
                            />
                            
                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Price</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={service.price?.toString()}
                                        onChangeText={(value) => handleServiceChange(index, 'price', parseInt(value) || 0)}
                                        placeholder="Price"
                                        keyboardType="numeric"
                                        placeholderTextColor={colors.gray}
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Starch Level (1-5)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={service.strachLevel?.toString()}
                                        onChangeText={(value) => handleServiceChange(index, 'strachLevel', parseInt(value) || 3)}
                                        placeholder="3"
                                        keyboardType="numeric"
                                        placeholderTextColor={colors.gray}
                                    />
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Submit Button */}
                <TouchableOpacity 
                    style={[styles.submitButton, loading && styles.disabledButton]} 
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="check" size={24} color="#FFF" />
                            <Text style={styles.submitButtonText}>Register Dry Cleaner</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: responsiveWidth(5),
        paddingTop: responsiveHeight(6),
        paddingBottom: responsiveHeight(2),
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: responsiveFontSize(15),
        color: colors.black,
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: '#FFF',
        marginHorizontal: responsiveWidth(5),
        marginVertical: responsiveHeight(1),
        padding: responsiveWidth(4),
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: responsiveFontSize(15),
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: responsiveHeight(1.5),
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: responsiveHeight(1.5),
    },
    label: {
        fontSize: responsiveFontSize(15),
        color: colors.black,
        marginBottom: responsiveHeight(0.5),
        marginTop: responsiveHeight(1),
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.lightGray,
        paddingVertical: responsiveHeight(1.2),
        paddingHorizontal: responsiveWidth(3),
        fontSize: responsiveFontSize(15),
        color: colors.black,
    },
    textArea: {
        height: responsiveHeight(8),
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    halfInput: {
        width: '48%',
    },
    imageButton: {
        backgroundColor: colors.brandColor,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: responsiveHeight(1.5),
        borderRadius: 8,
        marginVertical: responsiveHeight(1),
        gap: 8,
    },
    buttonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(15),
        fontWeight: '600',
    },
    previewImage: {
        width: responsiveWidth(20),
        height: responsiveWidth(20),
        borderRadius: 10,
        marginTop: responsiveHeight(1),
        alignSelf: 'center',
    },
    imagePreviewContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: responsiveHeight(1),
        justifyContent: 'center',
    },
    shopPreviewImage: {
        width: responsiveWidth(18),
        height: responsiveWidth(18),
        borderRadius: 8,
        margin: responsiveWidth(1),
    },
    hourRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: responsiveHeight(1),
        paddingVertical: responsiveHeight(0.5),
    },
    dayText: {
        fontSize: responsiveFontSize(15),
        color: colors.black,
        width: responsiveWidth(20),
        fontWeight: '500',
    },
    timeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-end',
    },
    timeInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.lightGray,
        paddingVertical: responsiveHeight(0.8),
        paddingHorizontal: responsiveWidth(2),
        fontSize: responsiveFontSize(15),
        color: colors.black,
        width: responsiveWidth(22),
        textAlign: 'center',
    },
    toText: {
        marginHorizontal: responsiveWidth(2),
        color: colors.gray,
        fontSize: responsiveFontSize(15),
    },
    addButton: {
        backgroundColor: colors.brandColor,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: responsiveWidth(3),
        paddingVertical: responsiveHeight(0.8),
        borderRadius: 6,
        gap: 4,
    },
    addButtonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(15),
        fontWeight: '600',
    },
    serviceCard: {
        backgroundColor: '#F8F9FA',
        padding: responsiveWidth(3),
        borderRadius: 8,
        marginBottom: responsiveHeight(2),
        borderWidth: 1,
        borderColor: colors.lightGray,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: responsiveHeight(1),
    },
    serviceTitle: {
        fontSize: responsiveFontSize(15),
        fontWeight: 'bold',
        color: colors.black,
    },
    submitButton: {
        backgroundColor: colors.brandColor,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: responsiveWidth(5),
        paddingVertical: responsiveHeight(1.8),
        borderRadius: 12,
        marginBottom: responsiveHeight(4),
        marginTop: responsiveHeight(1),
        gap: 8,
        shadowColor: colors.brandColor,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(15),
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.6,
    },
});

export default DryClean;