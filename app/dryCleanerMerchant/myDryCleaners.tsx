import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Camera from 'expo-camera';
import axios from 'axios';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import { RootState } from '../../components/redux/store';
import { Image } from 'expo-image';

const { width: screenWidth } = Dimensions.get('window');
const API_BASE_URL = 'https://vervoer-backend2.onrender.com/api/users';
// Define the DryCleaner type based on your backend model
interface DryCleaner {
  _id: string;
  shopname: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  rating: number;
  about: string;
  contactPerson: string;
  phoneNumber: string;
  contactPersonImg: string;
  shopimage: string[];
  hoursOfOperation: Array<{
    day: string;
    open: string;
    close: string;
    _id: string;
  }>;
  services: Array<{
    name: string;
    category: string;
    strachLevel: number;
    washOnly: boolean;
    additionalservice?: string;
    price: number;
    _id: string;
  }>;
  owner: string;
  ownerId?: string;
}

// Helper function to check ownership
const isOwner = (cleaner: DryCleaner, currentUserId: string): boolean => {
  const cleanerOwnerId = cleaner.ownerId || cleaner.owner;
  return cleanerOwnerId === currentUserId;
};

// Service Edit Modal Component
const ServiceEditModal = ({ 
  visible, 
  service, 
  onClose, 
  onSave,
  loading 
}: { 
  visible: boolean;
  service: any | null;
  onClose: () => void;
  onSave: (serviceData: any) => void;
  loading: boolean;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    strachLevel: 1,
    washOnly: false,
    additionalservice: '',
    price: 0,
  });

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        category: service.category || '',
        strachLevel: service.strachLevel || 1,
        washOnly: service.washOnly || false,
        additionalservice: service.additionalservice || '',
        price: service.price || 0,
      });
    }
  }, [service]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Service name is required');
      return;
    }
    if (!formData.category.trim()) {
      Alert.alert('Error', 'Category is required');
      return;
    }
    if (formData.price <= 0) {
      Alert.alert('Error', 'Price must be greater than 0');
      return;
    }

    onSave({
      serviceId: service._id,
      ...formData,
    });
  };

  if (!service) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Service</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={[styles.saveButton, loading && styles.disabledButton]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Service Name *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
              placeholder="Enter service name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.category}
              onChangeText={(text) => setFormData({...formData, category: text})}
              placeholder="Enter category"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Starch Level (1-5)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.strachLevel.toString()}
              onChangeText={(text) => {
                const level = parseInt(text) || 1;
                if (level >= 1 && level <= 5) {
                  setFormData({...formData, strachLevel: level});
                }
              }}
              keyboardType="numeric"
              placeholder="1-5"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Price (₹) *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.price.toString()}
              onChangeText={(text) => {
                const price = parseFloat(text) || 0;
                setFormData({...formData, price: price});
              }}
              keyboardType="numeric"
              placeholder="Enter price"
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.inputLabel}>Wash Only</Text>
            <Switch
              value={formData.washOnly}
              onValueChange={(value) => setFormData({...formData, washOnly: value})}
              trackColor={{ false: '#767577', true: colors.brandColor }}
              thumbColor={formData.washOnly ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Additional Service</Text>
            <TextInput
              style={styles.textInput}
              value={formData.additionalservice}
              onChangeText={(text) => setFormData({...formData, additionalservice: text})}
              placeholder="zipper, button, wash/fold"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Hours Edit Modal Component
const HoursEditModal = ({ 
  visible, 
  hours, 
  onClose, 
  onSave,
  loading 
}: { 
  visible: boolean;
  hours: any[];
  onClose: () => void;
  onSave: (hoursData: any[]) => void;
  loading: boolean;
}) => {
  const [hoursData, setHoursData] = useState<any[]>([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (hours && hours.length > 0) {
      setHoursData(hours);
    } else {
      // Initialize with default hours
      const defaultHours = daysOfWeek.map(day => ({
        day,
        open: '09:00 AM',
        close: '07:00 PM',
      }));
      setHoursData(defaultHours);
    }
  }, [hours]);

  const updateHour = (index: number, field: string, value: string) => {
    const newHours = [...hoursData];
    newHours[index] = { ...newHours[index], [field]: value };
    setHoursData(newHours);
  };

  const handleSave = () => {
    onSave(hoursData);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Operating Hours</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={[styles.saveButton, loading && styles.disabledButton]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {hoursData.map((hour, index) => (
            <View key={index} style={styles.hourRow}>
              <Text style={styles.dayLabel}>{hour.day}</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={styles.timeInput}
                  value={hour.open}
                  onChangeText={(text) => updateHour(index, 'open', text)}
                  placeholder="09:00 AM"
                />
                <Text style={styles.timeSeparator}>to</Text>
                <TextInput
                  style={styles.timeInput}
                  value={hour.close}
                  onChangeText={(text) => updateHour(index, 'close', text)}
                  placeholder="07:00 PM"
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Profile Edit Modal Component
const ProfileEditModal = ({ 
  visible, 
  cleaner, 
  onClose, 
  onSave,
  loading 
}: { 
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (profileData: any) => void;
  loading: boolean;
}) => {
  const [formData, setFormData] = useState({
    contactPerson: '',
    phoneNumber: '',
    contactPersonImg: '',
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageData, setSelectedImageData] = useState<any>(null);

  const authToken = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    if (cleaner) {
      setFormData({
        contactPerson: cleaner.contactPerson || '',
        phoneNumber: cleaner.phoneNumber || '',
        contactPersonImg: cleaner.contactPersonImg || '',
      });
      setSelectedImageUri(null);
      setSelectedImageData(null);
    }
  }, [cleaner]);

  // Request permissions
  const requestPermissions = async () => {
  try {
    // Request camera permissions
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    console.log('Camera permission status:', cameraPermission.status);
    
    // Request media library permissions
    const mediaPermission = await MediaLibrary.requestPermissionsAsync();
    console.log('Media library permission status:', mediaPermission.status);
    
    // Check if permissions are granted
    if (cameraPermission.status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in your device settings to take photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
    
    if (mediaPermission.status !== 'granted') {
      Alert.alert(
        'Gallery Permission Required',
        'Please allow gallery access in your device settings to select photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Permission request error:', error);
    Alert.alert('Error', 'Failed to request permissions. Please try again.');
    return false;
  }
};

  // Show image picker options
  const showImagePicker = async () => {
  Alert.alert(
    'Select Image',
    'Choose an option to select contact person image',
    [
      {
        text: 'Camera',
        onPress: () => openCamera(),
      },
      {
        text: 'Gallery',
        onPress: () => openGallery(),
      },
      {
        text: 'Remove Image',
        onPress: () => removeImage(),
        style: 'destructive',
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
  );
};

  // Open camera
 const openCamera = async () => {
  try {
    console.log('Opening camera...');
    
    // Request camera permission from ImagePicker
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    console.log('Camera permission status:', status);
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied', 
        'Camera permission is required to take photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => openCamera() }
        ]
      );
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    console.log('Camera result:', result);

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      console.log('Image selected:', asset.uri);
      setSelectedImageUri(asset.uri);
      setSelectedImageData(asset);
    }
  } catch (error) {
    console.error('Camera error:', error);
    Alert.alert('Error', 'Failed to take photo. Please try again.');
  }
};

// In ProfileEditModal - openGallery function
const openGallery = async () => {
  try {
    console.log('Opening gallery...');
    
    // Request media library permission from ImagePicker
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('Gallery permission status:', status);
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied', 
        'Gallery permission is required to select photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => openGallery() }
        ]
      );
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    console.log('Gallery result:', result);

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      console.log('Image selected:', asset.uri);
      setSelectedImageUri(asset.uri);
      setSelectedImageData(asset);
    }
  } catch (error) {
    console.error('Gallery error:', error);
    Alert.alert('Error', 'Failed to select image. Please try again.');
  }
};

  // Remove image
  const removeImage = () => {
    setSelectedImageUri(null);
    setSelectedImageData(null);
    setFormData({
      ...formData,
      contactPersonImg: '',
    });
  };

 const handleSave = async () => {
  if (!formData.contactPerson.trim()) {
    Alert.alert('Error', 'Contact person name is required');
    return;
  }
  if (!formData.phoneNumber.trim()) {
    Alert.alert('Error', 'Phone number is required');
    return;
  }

  if (!cleaner || !authToken) {
    Alert.alert('Error', 'Authentication required');
    return;
  }

  try {
    setImageUploading(true);

    const formDataUpload = new FormData();
    formDataUpload.append('contactPerson', formData.contactPerson);
    formDataUpload.append('phoneNumber', formData.phoneNumber);

    if (selectedImageData) {
      // FIXED: Proper file object for React Native
      const fileExtension = selectedImageData.uri.split('.').pop() || 'jpg';
      const fileName = `contact-person-${Date.now()}.${fileExtension}`;
      
      formDataUpload.append('contactPersonImg', {
        uri: selectedImageData.uri,
        type: `image/${fileExtension}`,
        name: fileName,
      } as any);
    }

    console.log('Uploading to:', `${API_BASE_URL}/edit-profile-drycleaner/${cleaner._id}`);

    const response = await axios.put(
      `${API_BASE_URL}/edit-profile-drycleaner/${cleaner._id}`,
      formDataUpload,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log('Upload response:', response.data);

    if (response.data.success) {
      Alert.alert('Success', 'Contact information updated successfully');
      
      const updatedData = {
        contactPerson: formData.contactPerson,
        phoneNumber: formData.phoneNumber,
        contactPersonImg: response.data.data?.dryCleaner?.contactPersonImg || formData.contactPersonImg,
      };
      
      onSave(updatedData);
      onClose();
    }
  } catch (error: any) {
    console.error('Error updating profile:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error config:', error.config);
    
    if (error.code === 'ECONNABORTED') {
      Alert.alert('Error', 'Request timed out. Please check your internet connection.');
    } else if (error.response?.status === 403) {
      Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.');
    } else if (error.message === 'Network Error') {
      Alert.alert('Network Error', 'Cannot connect to server. Please check if the backend is running and the IP address is correct.');
    } else {
      const message = error.response?.data?.message || 'Failed to update contact information';
      Alert.alert('Error', message);
    }
  } finally {
    setImageUploading(false);
  }
};


  if (!cleaner) return null;

  // Determine which image to show
  const displayImageUri = selectedImageUri || formData.contactPersonImg;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Contact Info</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || imageUploading}>
            <Text style={[styles.saveButton, (loading || imageUploading) && styles.disabledButton]}>
              {loading || imageUploading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Contact Person Image Section */}
          <View style={styles.imageSection}>
            <Text style={styles.inputLabel}>Contact Person Image</Text>
            <View style={styles.imageContainer}>
              <TouchableOpacity 
                style={styles.imagePickerButton}
                onPress={showImagePicker}
                disabled={imageUploading}
              >
                {displayImageUri ? (
                  <Image
                    source={{ uri: displayImageUri }}
                    style={styles.contactPersonImageLarge}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <MaterialCommunityIcons name="account-plus" size={40} color="#999" />
                    <Text style={styles.placeholderText}>Add Photo</Text>
                  </View>
                )}
                
                {imageUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color={colors.brandColor} />
                  </View>
                )}
                
                {/* Edit icon overlay */}
                <View style={styles.editImageIcon}>
                  <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
              
              <Text style={styles.imageHint}>
                Tap to change contact person photo
              </Text>
              
              {selectedImageUri && (
                <Text style={styles.imageSelectedText}>
                  ✓ New image selected. Save to upload.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Person *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.contactPerson}
              onChangeText={(text) => setFormData({...formData, contactPerson: text})}
              placeholder="Enter contact person name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Shop Image Edit Modal Component
const ShopImageEditModal = ({ 
  visible, 
  cleaner, 
  onClose, 
  onSave,
  loading 
}: { 
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (imageData: any) => void;
  loading: boolean;
}) => {
  const [shopImages, setShopImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<any[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [deletedImages, setDeletedImages] = useState<string[]>([]);

  const authToken = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    if (cleaner) {
      setShopImages(cleaner.shopimage || []);
      setNewImages([]);
      setDeletedImages([]);
    }
  }, [cleaner]);

  // Request permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    
    return cameraStatus === 'granted' && mediaStatus === 'granted';
  };

  // Show image picker options
  const showImagePicker = async () => {
  Alert.alert(
    'Select Image',
    'Choose an option to select contact person image',
    [
      {
        text: 'Camera',
        onPress: () => openCamera(),
      },
      {
        text: 'Gallery',
        onPress: () => openGallery(),
      },
      {
        text: 'Remove Image',
        onPress: () => removeImage(),
        style: 'destructive',
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
  );
};

  // Open camera
 const openCamera = async () => {
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], // FIXED
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const remainingSlots = 5 - (shopImages.length - deletedImages.length) - newImages.length;
      if (remainingSlots <= 0) return;
      
      const asset = result.assets[0];
      setNewImages(prev => [...prev, asset]);
    }
  } catch (error) {
    console.error('Camera error:', error);
    Alert.alert('Error', 'Failed to take photo. Please try again.');
  }
};

//  openGallery function
const openGallery = async () => {
  try {
    const remainingSlots = 5 - (shopImages.length - deletedImages.length) - newImages.length;
    const availableSlots = remainingSlots > 0 ? remainingSlots : 1;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // FIXED
      allowsMultipleSelection: true,
      selectionLimit: availableSlots,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewImages(prev => [...prev, ...result.assets]);
    }
  } catch (error) {
    console.error('Gallery error:', error);
    Alert.alert('Error', 'Failed to select images. Please try again.');
  }
};

  // Remove existing image (mark for deletion)
  const removeExistingImage = (imageUrl: string) => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setDeletedImages(prev => [...prev, imageUrl]);
          }
        }
      ]
    );
  };

  // Remove new image (before upload)
  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  // Restore deleted image
  const restoreImage = (imageUrl: string) => {
    setDeletedImages(prev => prev.filter(img => img !== imageUrl));
  };

  const handleSave = async () => {
  if (!cleaner || !authToken) {
    Alert.alert('Error', 'Authentication required');
    return;
  }

  try {
    setImageUploading(true);

    // Step 1: Delete images if any
    if (deletedImages.length > 0) {
      for (const imageUrl of deletedImages) {
        try {
          await axios.delete(
            `${API_BASE_URL}/delete-drycleaner-shop-image/${cleaner._id}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
              data: { imageUrl },
              timeout: 30000,
            }
          );
        } catch (deleteError) {
          console.error('Error deleting image:', deleteError);
        }
      }
    }

    // Step 2: Upload new images if any
    if (newImages.length > 0) {
      const formData = new FormData();
      
      newImages.forEach((image, index) => {
        if (image.uri) {
          // FIXED: Proper file object for React Native
          const fileExtension = image.uri.split('.').pop() || 'jpg';
          const fileName = `shop-image-${Date.now()}-${index}.${fileExtension}`;
          
          formData.append('shopimage', {
            uri: image.uri,
            type: `image/${fileExtension}`,
            name: fileName,
          } as any);
        }
      });

      console.log('Uploading to:', `${API_BASE_URL}/update-drycleaner-shop-images/${cleaner._id}`);
      console.log('Number of images:', newImages.length);

      const uploadResponse = await axios.put(
        `${API_BASE_URL}/update-drycleaner-shop-images/${cleaner._id}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 second timeout for multiple images
        }
      );

      console.log('Upload response:', uploadResponse.data);

      if (uploadResponse.data.success) {
        Alert.alert('Success', 'Shop images updated successfully');
        
        const updatedData = {
          shopimage: uploadResponse.data.data?.dryCleaner?.shopimage || [],
        };
        
        onSave(updatedData);
      }
    } else if (deletedImages.length > 0) {
      Alert.alert('Success', 'Shop images updated successfully');
      
      const remainingImages = shopImages.filter(img => !deletedImages.includes(img));
      const updatedData = {
        shopimage: remainingImages,
      };
      
      onSave(updatedData);
    } else {
      Alert.alert('Info', 'No changes made to shop images');
    }
    
    onClose();
    
  } catch (error: any) {
    console.error('Error updating shop images:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error config:', error.config);
    
    if (error.code === 'ECONNABORTED') {
      Alert.alert('Error', 'Request timed out. Please check your internet connection.');
    } else if (error.response?.status === 403) {
      Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.');
    } else if (error.message === 'Network Error') {
      Alert.alert('Network Error', 'Cannot connect to server. Please check:\n1. Backend is running\n2. IP address is correct\n3. Device is on same network');
    } else {
      const message = error.response?.data?.message || 'Failed to update shop images';
      Alert.alert('Error', message);
    }
  } finally {
    setImageUploading(false);
  }
};

  if (!cleaner) return null;

  // Calculate display counts
  const currentImages = shopImages.filter(img => !deletedImages.includes(img));
  const totalImagesAfterSave = currentImages.length + newImages.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Shop Images</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={loading || imageUploading}
          >
            <Text style={[styles.saveButton, (loading || imageUploading) && styles.disabledButton]}>
              {loading || imageUploading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Image Count Info */}
          <View style={styles.imageCountSection}>
            <Text style={styles.imageCountText}>
              Shop Images ({totalImagesAfterSave}/5)
            </Text>
            <Text style={styles.imageCountSubText}>
              Add up to 5 images to showcase your shop
            </Text>
            {(deletedImages.length > 0 || newImages.length > 0) && (
              <Text style={styles.changesText}>
                {deletedImages.length > 0 && `${deletedImages.length} to remove`}
                {deletedImages.length > 0 && newImages.length > 0 && ' • '}
                {newImages.length > 0 && `${newImages.length} to add`}
              </Text>
            )}
          </View>

          {/* Current Images */}
          {shopImages.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>Current Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.imagesRow}>
                  {shopImages.map((imageUrl, index) => {
                    const isDeleted = deletedImages.includes(imageUrl);
                    return (
                      <View key={`existing-${index}`} style={styles.imageContainer}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={[
                            styles.shopImageEdit,
                            isDeleted && styles.deletedImage
                          ]}
                          contentFit="cover"
                        />
                        
                        {isDeleted ? (
                          <TouchableOpacity
                            style={styles.restoreImageButton}
                            onPress={() => restoreImage(imageUrl)}
                          >
                            <MaterialCommunityIcons name="restore" size={16} color="#fff" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => removeExistingImage(imageUrl)}
                          >
                            <MaterialCommunityIcons name="close" size={16} color="#fff" />
                          </TouchableOpacity>
                        )}
                        
                        <View style={[
                          styles.imageLabel,
                          isDeleted && styles.deletedImageLabel
                        ]}>
                          <Text style={styles.imageLabelText}>
                            {isDeleted ? 'Will Delete' : 'Current'}
                          </Text>
                        </View>
                        
                        {isDeleted && (
                          <View style={styles.deletedOverlay}>
                            <MaterialCommunityIcons name="delete" size={24} color="#fff" />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* New Images */}
          {newImages.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>New Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.imagesRow}>
                  {newImages.map((image, index) => (
                    <View key={`new-${index}`} style={styles.imageContainer}>
                      <Image
                        source={{ uri: image.uri }}
                        style={styles.shopImageEdit}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeNewImage(index)}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                      <View style={[styles.imageLabel, styles.newImageLabel]}>
                        <Text style={styles.imageLabelText}>New</Text>
                      </View>
                      
                      {imageUploading && (
                        <View style={styles.uploadingOverlay}>
                          <ActivityIndicator size="small" color={colors.brandColor} />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Add Images Section */}
          <View style={styles.addImageSection}>
            {totalImagesAfterSave < 5 ? (
              <TouchableOpacity 
                style={styles.addImageButton}
                onPress={showImagePicker}
                disabled={imageUploading}
              >
                <MaterialCommunityIcons name="camera-plus" size={40} color={colors.brandColor} />
                <Text style={styles.addImageText}>Add Shop Images</Text>
                <Text style={styles.addImageSubText}>
                  Tap to add photos from camera or gallery
                </Text>
                <Text style={styles.slotText}>
                  {5 - totalImagesAfterSave} slot(s) remaining
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.limitReachedContainer}>
                <MaterialCommunityIcons name="check-circle" size={40} color="#4CAF50" />
                <Text style={styles.limitReachedText}>Image limit reached</Text>
                <Text style={styles.limitReachedSubText}>
                  You have reached the maximum number of images (5)
                </Text>
              </View>
            )}
          </View>

          {/* Tips Section */}
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>📷 Photo Tips</Text>
            <Text style={styles.tipsText}>
              • Take clear, well-lit photos of your shop{'\n'}
              • Show your storefront, interior, and equipment{'\n'}
              • Avoid blurry or dark images{'\n'}
              • Include photos that showcase cleanliness and professionalism
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Address Edit Modal Component
const AddressEditModal = ({ 
  visible, 
  cleaner, 
  onClose, 
  onSave,
  loading 
}: { 
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (addressData: any) => void;
  loading: boolean;
}) => {
  const [formData, setFormData] = useState({
    shopname: '',
    about: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
  });

  useEffect(() => {
    if (cleaner) {
      setFormData({
        shopname: cleaner.shopname || '',
        about: cleaner.about || '',
        address: {
          street: cleaner.address?.street || '',
          city: cleaner.address?.city || '',
          state: cleaner.address?.state || '',
          zipCode: cleaner.address?.zipCode || '',
          country: cleaner.address?.country || '',
        },
      });
    }
  }, [cleaner]);

  const handleSave = () => {
    if (!formData.shopname.trim()) {
      Alert.alert('Error', 'Shop name is required');
      return;
    }

    onSave(formData);
  };

  if (!cleaner) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Shop Details</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={[styles.saveButton, loading && styles.disabledButton]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Shop Name *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.shopname}
              onChangeText={(text) => setFormData({...formData, shopname: text})}
              placeholder="Enter shop name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>About</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.about}
              onChangeText={(text) => setFormData({...formData, about: text})}
              placeholder="Enter shop description"
              multiline
              numberOfLines={4}
            />
          </View>

          <Text style={styles.sectionHeader}>Address</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Street</Text>
            <TextInput
              style={styles.textInput}
              value={formData.address.street}
              onChangeText={(text) => setFormData({
                ...formData, 
                address: {...formData.address, street: text}
              })}
              placeholder="Enter street address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.textInput}
              value={formData.address.city}
              onChangeText={(text) => setFormData({
                ...formData, 
                address: {...formData.address, city: text}
              })}
              placeholder="Enter city"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>State</Text>
            <TextInput
              style={styles.textInput}
              value={formData.address.state}
              onChangeText={(text) => setFormData({
                ...formData, 
                address: {...formData.address, state: text}
              })}
              placeholder="Enter state"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ZIP Code</Text>
            <TextInput
              style={styles.textInput}
              value={formData.address.zipCode}
              onChangeText={(text) => setFormData({
                ...formData, 
                address: {...formData.address, zipCode: text}
              })}
              placeholder="Enter ZIP code"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country</Text>
            <TextInput
              style={styles.textInput}
              value={formData.address.country}
              onChangeText={(text) => setFormData({
                ...formData, 
                address: {...formData.address, country: text}
              })}
              placeholder="Enter country"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Merchant's Dry Cleaner Card Component
const MerchantCleanerCard = ({ 
  cleaner, 
  onViewDetails, 
  onEdit,
  onDelete,
  currentUserId
}: { 
  cleaner: DryCleaner; 
  onViewDetails: (cleaner: DryCleaner) => void;
  onEdit: (cleaner: DryCleaner) => void;
  onDelete: (cleaner: DryCleaner) => void;
  currentUserId: string;
}) => {
  const canEdit = isOwner(cleaner, currentUserId);

  return (
    <View style={styles.cleanerCard}>
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={() => onViewDetails(cleaner)}
      >
        <View style={styles.iconContainer}>
          <Image
            source={require('../../assets/images/washing.png')}
            style={styles.washingIcon}
            contentFit="cover"
          />
        </View>
        <View style={styles.cleanerInfo}>
          <View style={styles.nameRating}>
            <Text style={styles.cleanerName}>{cleaner.shopname}</Text>
            <View style={styles.ratingContainer}>
              <Text style={styles.starIcon}>★</Text>
              <Text style={styles.rating}>{cleaner.rating || '0.0'}</Text>
            </View>
          </View>
          <Text style={styles.address}>
            {cleaner.address 
              ? `${cleaner.address.street}, ${cleaner.address.city}, ${cleaner.address.state}`
              : 'Address not available'
            }
          </Text>
          <View style={styles.detailsContainer}>
            <View style={styles.distanceContainer}>
              <Text style={styles.phoneIcon}>📞</Text>
              <Text style={styles.phoneText}>{cleaner.phoneNumber}</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.clockIcon}>🕐</Text>
              <Text style={styles.time}>
                {cleaner.hoursOfOperation && cleaner.hoursOfOperation.length > 0
                  ? `${cleaner.hoursOfOperation[0].open} - ${cleaner.hoursOfOperation[0].close}`
                  : '09:00 AM - 07:00 PM'
                }
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Ownership Status Indicator */}
      {!canEdit && (
        <View style={styles.ownershipIndicator}>
          <MaterialCommunityIcons name="account-multiple" size={14} color="#666" />
          <Text style={styles.ownershipText}>Other Owner</Text>
        </View>
      )}
      
      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        {/* <TouchableOpacity 
          style={[styles.editButton, !canEdit && styles.disabledActionButton]}
          onPress={() => canEdit ? onEdit(cleaner) : Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.')}
          disabled={!canEdit}
        >
          <MaterialCommunityIcons name="pencil" size={16} color={canEdit ? "#4CAF50" : "#ccc"} />
          <Text style={[styles.editButtonText, !canEdit && styles.disabledActionText]}>Edit</Text>
        </TouchableOpacity>
         */}
        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => onViewDetails(cleaner)}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.brandColor} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.deleteButton, !canEdit && styles.disabledActionButton]}
          onPress={() => canEdit ? onDelete(cleaner) : Alert.alert('Access Denied', 'You can only delete dry cleaners that you own.')}
          disabled={!canEdit}
        >
          <MaterialCommunityIcons name="delete" size={16} color={canEdit ? "#f44336" : "#ccc"} />
          <Text style={[styles.deleteButtonText, !canEdit && styles.disabledActionText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Enhanced Detailed Modal Component with Edit Functionality
const CleanerDetailsModal = ({ 
  cleaner, 
  visible, 
  onClose, 
  onEdit,
  onRefresh,
  currentUserId
}: { 
  cleaner: DryCleaner | null; 
  visible: boolean; 
  onClose: () => void;
  onEdit: (cleaner: DryCleaner) => void;
  onRefresh: () => void;
  currentUserId: string;
}) => {
  const [serviceEditModal, setServiceEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [hoursEditModal, setHoursEditModal] = useState(false);
  const [profileEditModal, setProfileEditModal] = useState(false);
  const [addressEditModal, setAddressEditModal] = useState(false);
  const [shopImageEditModal, setShopImageEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentCleanerData, setCurrentCleanerData] = useState<DryCleaner | null>(null);

  const authToken = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    if (cleaner) {
      setCurrentCleanerData(cleaner);
    }
  }, [cleaner]);

  const canEdit = currentCleanerData ? isOwner(currentCleanerData, currentUserId) : false;

  const showAccessDeniedAlert = () => {
    Alert.alert(
      'Access Denied', 
      'You can only edit dry cleaners that you own. This dry cleaner belongs to another merchant.',
      [{ text: 'OK' }]
    );
  };

  const handleEditService = (service: any) => {
    if (!canEdit) {
      showAccessDeniedAlert();
      return;
    }
    setSelectedService(service);
    setServiceEditModal(true);
  };

  const handleSaveService = async (serviceData: any) => {
  if (!currentCleanerData || !authToken) {
    Alert.alert('Error', 'Authentication required');
    return;
  }

  if (!canEdit) {
    showAccessDeniedAlert();
    return;
  }

  try {
    setLoading(true);
    
    // FIXED URL HERE
    const response = await axios.put(
      `${API_BASE_URL}/edit-service-drycleaner/${currentCleanerData._id}`,
      serviceData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.success) {
      Alert.alert('Success', 'Service updated successfully');
      setServiceEditModal(false);
      
      const updatedServices = currentCleanerData.services.map(service => 
        service._id === serviceData.serviceId 
          ? { ...service, ...serviceData }
          : service
      );
      
      setCurrentCleanerData({
        ...currentCleanerData,
        services: updatedServices
      });
      
      onRefresh();
    }
  } catch (error: any) {
    console.error('Error updating service:', error);
    console.error('Error details:', error.response?.data);
    
    if (error.response?.status === 403) {
      showAccessDeniedAlert();
    } else {
      const message = error.response?.data?.message || 'Failed to update service';
      Alert.alert('Error', message);
    }
  } finally {
    setLoading(false);
  }
};


  const handleSaveHours = async (hoursData: any[]) => {
  if (!currentCleanerData || !authToken) {
    Alert.alert('Error', 'Authentication required');
    return;
  }

  if (!canEdit) {
    showAccessDeniedAlert();
    return;
  }

  try {
    setLoading(true);
    
    // FIXED URL HERE
    const response = await axios.put(
      `${API_BASE_URL}/edit-hours-drycleaner/${currentCleanerData._id}`,
      hoursData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.success) {
      Alert.alert('Success', 'Operating hours updated successfully');
      setHoursEditModal(false);
      
      setCurrentCleanerData({
        ...currentCleanerData,
        hoursOfOperation: hoursData
      });
      
      onRefresh();
    }
  } catch (error: any) {
    console.error('Error updating hours:', error);
    console.error('Error details:', error.response?.data);
    
    if (error.response?.status === 403) {
      showAccessDeniedAlert();
    } else {
      const message = error.response?.data?.message || 'Failed to update operating hours';
      Alert.alert('Error', message);
    }
  } finally {
    setLoading(false);
  }
};

  const handleSaveProfile = async (profileData: any) => {
  if (!currentCleanerData || !authToken) {
    Alert.alert('Error', 'Authentication required');
    return;
  }

  if (!canEdit) {
    showAccessDeniedAlert();
    return;
  }

  try {
    setLoading(true);
    
    // FIXED URL HERE
    const response = await axios.put(
      `${API_BASE_URL}/edit-profile-drycleaner/${currentCleanerData._id}`,
      profileData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.success) {
      Alert.alert('Success', 'Contact information updated successfully');
      setProfileEditModal(false);
      
      setCurrentCleanerData({
        ...currentCleanerData,
        contactPerson: profileData.contactPerson,
        phoneNumber: profileData.phoneNumber,
        contactPersonImg: profileData.contactPersonImg
      });
      
      onRefresh();
    }
  } catch (error: any) {
    console.error('Error updating profile:', error);
    console.error('Error details:', error.response?.data);
    
    if (error.response?.status === 403) {
      showAccessDeniedAlert();
    } else {
      Alert.alert('Error', 'Failed to update profile');
    }
  } finally {
    setLoading(false);
  }
};

  const handleSaveAddress = async (addressData: any) => {
  if (!currentCleanerData || !authToken) {
    Alert.alert('Error', 'Authentication required');
    return;
  }

  if (!canEdit) {
    showAccessDeniedAlert();
    return;
  }

  try {
    setLoading(true);
    
    // FIXED URL HERE
    const response = await axios.put(
      `${API_BASE_URL}/edit-address-drycleaner/${currentCleanerData._id}`,
      addressData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.success) {
      Alert.alert('Success', 'Shop details updated successfully');
      setAddressEditModal(false);
      
      setCurrentCleanerData({
        ...currentCleanerData,
        shopname: addressData.shopname,
        about: addressData.about,
        address: addressData.address
      });
      
      onRefresh();
    }
  } catch (error: any) {
    console.error('Error updating address:', error);
    console.error('Error details:', error.response?.data);
    
    if (error.response?.status === 403) {
      showAccessDeniedAlert();
    } else {
      const message = error.response?.data?.message || 'Failed to update shop details';
      Alert.alert('Error', message);
    }
  } finally {
    setLoading(false);
  }
};

  const handleSaveShopImages = async (imageData: any) => {
    if (!currentCleanerData || !authToken) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    if (!canEdit) {
      showAccessDeniedAlert();
      return;
    }

    try {
      setLoading(true);
      
      setCurrentCleanerData({
        ...currentCleanerData,
        shopimage: imageData.shopimage
      });
      
      setShopImageEditModal(false);
      Alert.alert('Success', 'Shop images updated successfully');
      onRefresh();
      
    } catch (error: any) {
      console.error('Error updating shop images:', error);
      
      if (error.response?.status === 403) {
        showAccessDeniedAlert();
      } else {
        const message = error.response?.data?.message || 'Failed to update shop images';
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

 const handleDeleteShopImage = async (imageUrl: string) => {
  if (!currentCleanerData || !authToken) return;

  if (!canEdit) {
    showAccessDeniedAlert();
    return;
  }

  Alert.alert(
    'Delete Image',
    'Are you sure you want to delete this image?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // FIXED URL HERE
            const response = await axios.delete(
              `${API_BASE_URL}/delete-drycleaner-shop-image/${currentCleanerData._id}`,
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
                data: { imageUrl }
              }
            );

            if (response.data.success) {
              Alert.alert('Success', 'Image deleted successfully');
              
              const updatedImages = currentCleanerData.shopimage.filter(img => img !== imageUrl);
              setCurrentCleanerData({
                ...currentCleanerData,
                shopimage: updatedImages
              });
              
              onRefresh();
            }
          } catch (error: any) {
            console.error('Error deleting image:', error);
            console.error('Error details:', error.response?.data);
            
            if (error.response?.status === 403) {
              showAccessDeniedAlert();
            } else {
              Alert.alert('Error', 'Failed to delete image');
            }
          }
        }
      }
    ]
  );
};

  if (!currentCleanerData) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {canEdit ? 'My Dry Cleaner Details' : 'Dry Cleaner Details'}
            </Text>
            <TouchableOpacity 
              onPress={() => canEdit ? onEdit(currentCleanerData) : showAccessDeniedAlert()}
            >
              <MaterialCommunityIcons name="pencil" size={24} color={canEdit ? colors.brandColor : "#ccc"} />
            </TouchableOpacity>
          </View>

          {/* Ownership Status Banner */}
          {!canEdit && (
            <View style={styles.ownershipBanner}>
              <MaterialCommunityIcons name="information" size={20} color={colors.brandColor} />
              <Text style={styles.ownershipBannerText}>
                This dry cleaner belongs to another merchant. You can view details but cannot make changes.
              </Text>
            </View>
          )}

          <ScrollView style={styles.modalContent}>
            {/* Shop Images Section */}
            <View style={styles.detailSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Shop Images</Text>
                <View style={styles.imageActionButtons}>
                  {canEdit && (
                    <TouchableOpacity 
                      onPress={() => setShopImageEditModal(true)}
                      style={styles.editImagesButton}
                    >
                      <MaterialCommunityIcons name="camera-plus" size={16} color={colors.brandColor} />
                      <Text style={styles.editImagesButtonText}>Manage Images</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.subText}>
                    {canEdit ? 'Tap to manage images' : 'View only'}
                  </Text>
                </View>
              </View>
              
              {currentCleanerData.shopimage && currentCleanerData.shopimage.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScrollView}>
                  {currentCleanerData.shopimage.map((imageUrl, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.shopImageContainer}
                      onPress={() => canEdit ? handleDeleteShopImage(imageUrl) : null}
                      disabled={!canEdit}
                    >
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.shopImage}
                        contentFit="cover"
                      />
                      {canEdit && (
                        <View style={styles.deleteImageOverlay}>
                          <MaterialCommunityIcons name="delete" size={16} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  
                  {/* Add Image Quick Button */}
                  {canEdit && currentCleanerData.shopimage.length < 5 && (
                    <TouchableOpacity 
                      style={styles.addImageQuickButton}
                      onPress={() => setShopImageEditModal(true)}
                    >
                      <MaterialCommunityIcons name="camera-plus" size={24} color={colors.brandColor} />
                      <Text style={styles.addImageQuickText}>Add More</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              ) : (
                <View style={styles.noImagesContainer}>
                  <MaterialCommunityIcons name="image-off" size={40} color="#ccc" />
                  <Text style={styles.noImagesText}>No images uploaded yet</Text>
                  {canEdit && (
                    <TouchableOpacity 
                      style={styles.addFirstImageButton}
                      onPress={() => setShopImageEditModal(true)}
                    >
                      <MaterialCommunityIcons name="camera-plus" size={30} color={colors.brandColor} />
                      <Text style={styles.addFirstImageText}>Add Shop Images</Text>
                      <Text style={styles.addFirstImageSubText}>Upload up to 5 photos</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Contact Information Section */}
            <View style={styles.detailSection}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleWithImage}>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  {currentCleanerData.contactPersonImg && (
                    <Image
                      source={{ uri: currentCleanerData.contactPersonImg }}
                      style={styles.contactPersonImage}
                      contentFit="cover"
                    />
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => canEdit ? setProfileEditModal(true) : showAccessDeniedAlert()}
                  disabled={!canEdit}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={canEdit ? colors.brandColor : "#ccc"} />
                </TouchableOpacity>
              </View>
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="map-marker" size={20} color="#666" />
                <Text style={styles.contactText}>
                  {currentCleanerData.address 
                    ? `${currentCleanerData.address.street}, ${currentCleanerData.address.city}, ${currentCleanerData.address.state} ${currentCleanerData.address.zipCode}`
                    : 'Address not available'
                  }
                </Text>
              </View>
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="phone" size={20} color="#666" />
                <Text style={styles.contactText}>{currentCleanerData.phoneNumber}</Text>
              </View>
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="account" size={20} color="#666" />
                <Text style={styles.contactText}>{currentCleanerData.contactPerson}</Text>
              </View>
            </View>

            {/* Operating Hours */}
            <View style={styles.detailSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Operating Hours</Text>
                <TouchableOpacity 
                  onPress={() => canEdit ? setHoursEditModal(true) : showAccessDeniedAlert()}
                  disabled={!canEdit}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={canEdit ? colors.brandColor : "#ccc"} />
                </TouchableOpacity>
              </View>
              {currentCleanerData.hoursOfOperation.map((hours, index) => (
                <View key={index} style={styles.contactItem}>
                  <MaterialCommunityIcons name="clock" size={20} color="#666" />
                  <Text style={styles.contactText}>
                    {hours.day}: {hours.open === 'Closed' ? 'Closed' : `${hours.open} - ${hours.close}`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Services & Pricing */}
            <View style={styles.detailSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Services & Pricing</Text>
                <Text style={styles.subText}>
                  {canEdit ? 'Tap to edit service' : 'View only'}
                </Text>
              </View>
              <View style={styles.servicesContainer}>
                {currentCleanerData.services.map((service, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.serviceTag, !canEdit && styles.disabledServiceTag]}
                    onPress={() => handleEditService(service)}
                    disabled={!canEdit}
                  >
                    <Text style={styles.serviceText}>{service.name}</Text>
                    <Text style={styles.servicePriceText}>₹{service.price}</Text>
                    <Text style={styles.serviceCategoryText}>{service.category}</Text>
                    {canEdit && (
                      <View style={styles.serviceEditIcon}>
                        <MaterialCommunityIcons name="pencil" size={12} color={colors.brandColor} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.detailSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>About</Text>
                <TouchableOpacity 
                  onPress={() => canEdit ? setAddressEditModal(true) : showAccessDeniedAlert()}
                  disabled={!canEdit}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={canEdit ? colors.brandColor : "#ccc"} />
                </TouchableOpacity>
              </View>
              <Text style={styles.descriptionText}>
                {currentCleanerData.about || `${currentCleanerData.shopname} is a professional dry cleaning service.`}
              </Text>
            </View>

            {/* Business Metrics */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Business Metrics</Text>
              <View style={styles.metricsContainer}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>15</Text>
                  <Text style={styles.metricLabel}>Active Orders</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>150+</Text>
                  <Text style={styles.metricLabel}>Total Customers</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>4.5</Text>
                  <Text style={styles.metricLabel}>Avg Rating</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Buttons */}
          {canEdit && (
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.editCleanerButton}
                onPress={() => {
                  onEdit(currentCleanerData);
                  onClose();
                }}
              >
                <Text style={styles.editCleanerButtonText}>Edit All Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* All Edit Modals - Only show if user can edit */}
      {canEdit && (
        <>
          {/* Service Edit Modal */}
          <ServiceEditModal
            visible={serviceEditModal}
            service={selectedService}
            onClose={() => setServiceEditModal(false)}
            onSave={handleSaveService}
            loading={loading}
          />

          {/* Hours Edit Modal */}
          <HoursEditModal
            visible={hoursEditModal}
            hours={currentCleanerData.hoursOfOperation}
            onClose={() => setHoursEditModal(false)}
            onSave={handleSaveHours}
            loading={loading}
          />

          {/* Profile Edit Modal */}
          <ProfileEditModal
            visible={profileEditModal}
            cleaner={currentCleanerData}
            onClose={() => setProfileEditModal(false)}
            onSave={handleSaveProfile}
            loading={loading}
          />

          {/* Address Edit Modal */}
          <AddressEditModal
            visible={addressEditModal}
            cleaner={currentCleanerData}
            onClose={() => setAddressEditModal(false)}
            onSave={handleSaveAddress}
            loading={loading}
          />

          {/* Shop Image Edit Modal */}
          <ShopImageEditModal
            visible={shopImageEditModal}
            cleaner={currentCleanerData}
            onClose={() => setShopImageEditModal(false)}
            onSave={handleSaveShopImages}
            loading={loading}
          />
        </>
      )}
    </>
  );
};

const MyDryCleaners = () => {
  const router = useRouter();
  const [dryCleaners, setDryCleaners] = useState<DryCleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCleaner, setModalCleaner] = useState<DryCleaner | null>(null);

  // Get auth token and user info from Redux store
  const authToken = useSelector((state: RootState) => state.auth.token);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // Function to verify user permissions
  const verifyUserPermissions = () => {
    if (!authToken) {
      Alert.alert('Authentication Error', 'Please login again.');
      router.replace('/login');
      return false;
    }

    if (!currentUser) {
      Alert.alert('User Error', 'User information not found. Please login again.');
      router.replace('/login');
      return false;
    }

    if (currentUser.userType !== 'merchant') {
      Alert.alert('Access Denied', 'Only merchants can manage dry cleaners.');
      return false;
    }

    return true;
  };

  // Function to fetch merchant's own dry cleaners from backend
  const fetchMyDryCleaners = async () => {
    try {
      setLoading(true);

      if (!verifyUserPermissions()) {
        return;
      }

      const response = await axios.get(
        'https://vervoer-backend2.onrender.com/api/users/get-own-drycleaner',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success) {
        const cleaners = response.data.data?.dryCleaners || [];
        
        const transformedCleaners = cleaners.map((cleaner: any) => ({
          ...cleaner,
          ownerId: cleaner.owner || cleaner.ownerId
        }));
        
        setDryCleaners(transformedCleaners);

        // Update modal cleaner if it's currently open
        if (modalCleaner && modalVisible) {
          const updatedModalCleaner = transformedCleaners.find((c: DryCleaner) => c._id === modalCleaner._id);
          if (updatedModalCleaner) {
            setModalCleaner(updatedModalCleaner);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching dry cleaners:', error);
      
      if (error.response?.status === 401) {
        Alert.alert('Unauthorized', 'Your session has expired. Please login again.');
        router.replace('/login');
      } else if (error.response?.status === 403) {
        Alert.alert('Access Denied', 'You don\'t have permission to view dry cleaners.');
      } else {
        Alert.alert('Error', 'Failed to load dry cleaners. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchMyDryCleaners();
  }, [authToken]);

  // Handle view details
  const handleViewDetails = (cleaner: DryCleaner) => {
    setModalCleaner(cleaner);
    setModalVisible(true);
  };

  // Handle edit cleaner
  const handleEditCleaner = (cleaner: DryCleaner) => {
    if (!isOwner(cleaner, currentUser?._id || '')) {
      Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.');
      return;
    }
    // Navigate to edit screen with cleaner data
    router.push({
      pathname: '/dryCleanerMerchant/editDryCleaner',
      params: { cleaner: JSON.stringify(cleaner) }
    });
  };

  // Handle delete cleaner
  const handleDeleteCleaner = (cleaner: DryCleaner) => {
    if (!isOwner(cleaner, currentUser?._id || '')) {
      Alert.alert('Access Denied', 'You can only delete dry cleaners that you own.');
      return;
    }

    Alert.alert(
      'Delete Dry Cleaner',
      `Are you sure you want to delete "${cleaner.shopname}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDryCleaner(cleaner._id),
        },
      ]
    );
  };

  // Delete dry cleaner function
  const deleteDryCleaner = async (cleanerId: string) => {
    try {
      if (!authToken) {
        Alert.alert('Authentication Error', 'Please login again.');
        router.replace('/login');
        return;
      }

      const response = await axios.delete(
        `https://vervoer-backend2.onrender.com/api/users/delete-own-drycleaner/${cleanerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Dry cleaner deleted successfully.');
        fetchMyDryCleaners(); // Refresh the list
      }
    } catch (error: any) {
      console.error('Error deleting dry cleaner:', error);
      
      if (error.response?.status === 401) {
        Alert.alert('Unauthorized', 'Your session has expired. Please login again.');
        router.replace('/login');
      } else if (error.response?.status === 403) {
        Alert.alert('Access Denied', 'You can only delete dry cleaners that you own.');
      } else {
        Alert.alert('Error', 'Failed to delete dry cleaner. Please try again.');
      }
    }
  };

  // Handle add new dry cleaner
  const handleAddNewCleaner = () => {
    router.push('/dryCleanerMerchant/merchantAddDryCleaner');
  };

  // Handle modal close
  const handleModalClose = () => {
    setModalVisible(false);
    setModalCleaner(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading your dry cleaners...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Dry Cleaners</Text>
        <TouchableOpacity onPress={handleAddNewCleaner}>
          <Ionicons name="add" size={35} color={colors.brandColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.popularSection}>
          <Text style={styles.popularTitle}>My Dry Cleaners ({dryCleaners.length})</Text>
          <TouchableOpacity onPress={fetchMyDryCleaners}>
            <Text style={styles.seeAll}>REFRESH</Text>
          </TouchableOpacity>
        </View>

        {dryCleaners.map((cleaner) => (
          <MerchantCleanerCard 
            key={cleaner._id}
            cleaner={cleaner} 
            onViewDetails={handleViewDetails}
            onEdit={handleEditCleaner}
            onDelete={handleDeleteCleaner}
            currentUserId={currentUser?._id || ''}
          />
        ))}

        {/* Empty State */}
        {dryCleaners.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="store" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No dry cleaners found</Text>
            <Text style={styles.emptySubText}>Get started by adding your first dry cleaner</Text>
            <TouchableOpacity onPress={handleAddNewCleaner} style={styles.addButton}>
              <Text style={styles.addButtonText}>Add Dry Cleaner</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Details Modal */}
      <CleanerDetailsModal
        cleaner={modalCleaner}
        visible={modalVisible}
        onClose={handleModalClose}
        onEdit={handleEditCleaner}
        onRefresh={fetchMyDryCleaners}
        currentUserId={currentUser?._id || ''}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ============================================
  // MAIN CONTAINER & LAYOUT
  // ============================================
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  
  headerTitle: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '700',
  },
  
  scrollView: {
    flex: 1,
    paddingTop: 16,
  },
  
  // ============================================
  // SECTION HEADERS
  // ============================================
  popularSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  
  popularTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  
  seeAll: {
    fontSize: 14,
    color: colors.brandColor,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // ============================================
  // LOADING STATE
  // ============================================
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.brandColor,
    fontWeight: '600',
  },
  
  // ============================================
  // DRY CLEANER CARD (MATCHING YOUR DESIGN)
  // ============================================
  cleanerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  
  cardContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  
  washingIcon: {
    width: 60,
    height: 60,
  },
  
  cleanerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  
  nameRating: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  
  cleanerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  
  starIcon: {
    color: '#FF9500',
    fontSize: 16,
    marginRight: 4,
  },
  
  rating: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '700',
  },
  
  address: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  phoneIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  
  phoneText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  clockIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  
  time: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  
  // ============================================
  // OWNERSHIP INDICATOR
  // ============================================
  ownershipIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  
  ownershipText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 6,
    fontWeight: '600',
  },
  
  // ============================================
  // ACTION BUTTONS (MATCHING YOUR DESIGN)
  // ============================================
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 10,
  },
  
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    flex: 1,
  },
  
  editButtonText: {
    fontSize: 15,
    color: '#2E7D32',
    fontWeight: '700',
    marginLeft: 6,
  },
  
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    flex: 1,
  },
  
  viewDetailsText: {
    fontSize: 15,
    color: '#1976D2',
    fontWeight: '700',
    marginRight: 4,
  },
  
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 16,
    flex: 1,
  },
  
  deleteButtonText: {
    fontSize: 15,
    color: '#D32F2F',
    fontWeight: '700',
    marginLeft: 6,
  },
  
  disabledActionButton: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  
  disabledActionText: {
    color: '#999999',
  },
  
  // ============================================
  // EMPTY STATE
  // ============================================
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  
  emptySubText: {
    fontSize: 15,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  
  addButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // ============================================
  // MODAL STYLES (MATCHING DETAIL VIEW)
  // ============================================
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  
  saveButton: {
    fontSize: 16,
    color: colors.brandColor,
    fontWeight: '700',
  },
  
  disabledButton: {
    opacity: 0.4,
  },
  
  modalContent: {
    flex: 1,
    paddingTop: 16,
  },
  
  // ============================================
  // FORM INPUTS
  // ============================================
  inputGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  
  inputLabel: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 10,
    fontWeight: '600',
  },
  
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  // ============================================
  // HOURS EDITING
  // ============================================
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  dayLabel: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
    width: 100,
  },
  
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  timeInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#F5F5F5',
    fontWeight: '500',
  },
  
  timeSeparator: {
    fontSize: 14,
    color: '#999999',
    marginHorizontal: 8,
    fontWeight: '600',
  },
  
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  
  // ============================================
  // IMAGE MANAGEMENT (MATCHING YOUR DESIGN)
  // ============================================
  imageSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  
  imageContainer: {
    alignItems: 'center',
  },
  
  imagePickerButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#BBDEFB',
  },
  
  contactPersonImageLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  
  placeholderImage: {
    alignItems: 'center',
  },
  
  placeholderText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontWeight: '500',
  },
  
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  editImageIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.brandColor,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  
  imageHint: {
    fontSize: 13,
    color: '#999999',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  imageSelectedText: {
    fontSize: 13,
    color: '#2E7D32',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  // ============================================
  // SHOP IMAGES (MATCHING YOUR DESIGN)
  // ============================================
  imageCountSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  imageCountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  
  imageCountSubText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  
  changesText: {
    fontSize: 13,
    color: colors.brandColor,
    marginTop: 8,
    fontWeight: '600',
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  
  imagesRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  
  shopImageEdit: {
    width: 180,
    height: 120,
    borderRadius: 16,
    marginRight: 12,
  },
  
  deletedImage: {
    opacity: 0.4,
  },
  
  restoreImageButton: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: '#2E7D32',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: '#D32F2F',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  imageLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  
  deletedImageLabel: {
    backgroundColor: 'rgba(211, 47, 47, 0.85)',
  },
  
  newImageLabel: {
    backgroundColor: 'rgba(46, 125, 50, 0.85)',
  },
  
  imageLabelText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  
  deletedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  addImageSection: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  
  addImageButton: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    borderWidth: 2,
    borderColor: colors.brandColor,
    borderStyle: 'dashed',
  },
  
  addImageText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brandColor,
    marginTop: 8,
  },
  
  addImageSubText: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  
  slotText: {
    fontSize: 13,
    color: colors.brandColor,
    marginTop: 6,
    fontWeight: '700',
  },
  
  limitReachedContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    marginHorizontal: 20,
  },
  
  limitReachedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 8,
  },
  
  limitReachedSubText: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  
  tipsSection: {
    padding: 16,
    backgroundColor: '#FFFBF0',
    borderRadius: 16,
    marginBottom: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  
  tipsText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },
  
  // ============================================
  // DETAIL SECTIONS (MATCHING YOUR DESIGN)
  // ============================================
  detailSection: {
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  sectionTitleWithImage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  contactPersonImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 12,
    borderWidth: 2,
    borderColor: '#E8F4FD',
  },
  
  imageActionButtons: {
    alignItems: 'flex-end',
  },
  
  editImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFE8CC',
    borderRadius: 16,
  },
  
  editImagesButtonText: {
    fontSize: 14,
    color: colors.brandColor,
    marginLeft: 6,
    fontWeight: '700',
  },
  
  subText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  
  imageScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  
  shopImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  
  shopImage: {
    width: 180,
    height: 120,
    borderRadius: 16,
  },
  
  deleteImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  addImageQuickButton: {
    width: 180,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.brandColor,
    borderStyle: 'dashed',
  },
  
  addImageQuickText: {
    fontSize: 13,
    color: colors.brandColor,
    marginTop: 6,
    fontWeight: '700',
  },
  
  noImagesContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  
  noImagesText: {
    fontSize: 15,
    color: '#999999',
    marginTop: 12,
    marginBottom: 16,
    fontWeight: '500',
  },
  
  addFirstImageButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFE8CC',
    borderRadius: 16,
  },
  
  addFirstImageText: {
    fontSize: 16,
    color: colors.brandColor,
    fontWeight: '700',
    marginTop: 8,
  },
  
  addFirstImageSubText: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  contactText: {
    fontSize: 15,
    color: '#666666',
    marginLeft: 12,
    flex: 1,
  },
  
  // ============================================
  // SERVICES
  // ============================================
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  
  disabledServiceTag: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    opacity: 0.7,
  },
  
  serviceText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
  
  servicePriceText: {
    fontSize: 15,
    color: colors.brandColor,
    fontWeight: '700',
    marginLeft: 8,
  },
  
  serviceCategoryText: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 8,
  },
  
  serviceEditIcon: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.brandColor,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  descriptionText: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
  },
  
  // ============================================
  // METRICS
  // ============================================
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  
  metricItem: {
    alignItems: 'center',
  },
  
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  
  metricLabel: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
    fontWeight: '500',
  },
  
  // ============================================
  // OWNERSHIP & ACTIONS
  // ============================================
  ownershipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  
  ownershipBannerText: {
    fontSize: 14,
    color: '#E65100',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },
  
  modalActions: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  
  editCleanerButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.brandColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  
  editCleanerButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default MyDryCleaners;