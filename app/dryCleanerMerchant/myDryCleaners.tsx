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
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    
    return cameraStatus === 'granted' && mediaStatus === 'granted';
  };

  // Show image picker options
  const showImagePicker = async () => {
    const hasPermission = await requestPermissions();
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please allow access to camera and photo library.');
      return;
    }

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setSelectedImageData(asset);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Open gallery
  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
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

      // Create FormData for multipart upload
      const formDataUpload = new FormData();
      
      // Add text fields
      formDataUpload.append('contactPerson', formData.contactPerson);
      formDataUpload.append('phoneNumber', formData.phoneNumber);

      // Add image if selected
      if (selectedImageData) {
        formDataUpload.append('contactPersonImg', {
          uri: selectedImageData.uri,
          type: selectedImageData.type || 'image/jpeg',
          name: selectedImageData.fileName || 'contact-person-image.jpg',
        } as any);
      }

      const response = await axios.put(
        `http://localhost:5000/api/users/edit-profile-drycleaner/${cleaner._id}`,
        formDataUpload,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );

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
      
      if (error.response?.status === 403) {
        Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.');
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
    const hasPermission = await requestPermissions();
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please allow access to camera and photo library.');
      return;
    }

    const remainingSlots = 5 - (shopImages.length - deletedImages.length);
    if (newImages.length >= remainingSlots) {
      Alert.alert('Limit Reached', 'You can only have up to 5 shop images total');
      return;
    }

    Alert.alert(
      'Add Shop Image',
      'Choose an option to add shop image',
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  // Open gallery
  const openGallery = async () => {
    try {
      const remainingSlots = 5 - (shopImages.length - deletedImages.length) - newImages.length;
      const availableSlots = remainingSlots > 0 ? remainingSlots : 1;
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
            const deleteResponse = await axios.delete(
              `http://localhost:5000/api/users/delete-drycleaner-shop-image/${cleaner._id}`,
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
                data: { imageUrl }
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
            formData.append('shopimage', {
              uri: image.uri,
              type: image.type || 'image/jpeg',
              name: image.fileName || `shop-image-${index}.jpg`,
            } as any);
          }
        });

        const uploadResponse = await axios.put(
          `http://localhost:5000/api/users/update-drycleaner-shop-images/${cleaner._id}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'multipart/form-data',
            }
          }
        );

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
      
      if (error.response?.status === 403) {
        Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.');
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
        <TouchableOpacity 
          style={[styles.editButton, !canEdit && styles.disabledActionButton]}
          onPress={() => canEdit ? onEdit(cleaner) : Alert.alert('Access Denied', 'You can only edit dry cleaners that you own.')}
          disabled={!canEdit}
        >
          <MaterialCommunityIcons name="pencil" size={16} color={canEdit ? "#4CAF50" : "#ccc"} />
          <Text style={[styles.editButtonText, !canEdit && styles.disabledActionText]}>Edit</Text>
        </TouchableOpacity>
        
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
      
      const response = await axios.put(
        `http://localhost:5000/api/users/edit-service-drycleaner/${currentCleanerData._id}`,
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
      
      const response = await axios.put(
        `http://localhost:5000/api/users/edit-hours-drycleaner/${currentCleanerData._id}`,
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
      
      const response = await axios.put(
        `http://localhost:5000/api/users/edit-profile-drycleaner/${currentCleanerData._id}`,
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
      
      const response = await axios.put(
        `http://localhost:5000/api/users/edit-address-drycleaner/${currentCleanerData._id}`,
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
              const response = await axios.delete(
                `http://localhost:5000/api/users/delete-drycleaner-shop-image/${currentCleanerData._id}`,
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
        'http://localhost:5000/api/users/get-own-drycleaner',
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
        `http://localhost:5000/api/users/delete-own-drycleaner/${cleanerId}`,
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
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  headerTitle: {
    fontSize: 20,
    color: colors.black,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  popularSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  popularTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.black,
  },
  seeAll: {
    fontSize: 14,
    color: colors.brandColor,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.brandColor,
  },
  cleanerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  washingIcon: {
    width: 40,
    height: 40,
  },
  cleanerInfo: {
    flex: 1,
  },
  nameRating: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    color: '#FFD700',
    fontSize: 14,
    marginRight: 2,
  },
  rating: {
    fontSize: 14,
    color: colors.black,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  phoneText: {
    fontSize: 12,
    color: '#666',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  time: {
    fontSize: 12,
    color: '#666',
  },
  ownershipIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  ownershipText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    color: colors.brandColor,
    fontWeight: '600',
    marginRight: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '600',
    marginLeft: 4,
  },
  disabledActionButton: {
    backgroundColor: '#F5F5F5',
  },
  disabledActionText: {
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.black,
  },
  saveButton: {
    fontSize: 16,
    color: colors.brandColor,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.black,
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.black,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayLabel: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '500',
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
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.black,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  timeSeparator: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 16,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageContainer: {
    alignItems: 'center',
  },
  imagePickerButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
    color: '#999',
    marginTop: 4,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.brandColor,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  imageSelectedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    textAlign: 'center',
  },
  imageCountSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  imageCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
  },
  imageCountSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  changesText: {
    fontSize: 12,
    color: colors.brandColor,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 12,
  },
  imagesRow: {
    flexDirection: 'row',
  },
  shopImageEdit: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  deletedImage: {
    opacity: 0.5,
  },
  restoreImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#4CAF50',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#f44336',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deletedImageLabel: {
    backgroundColor: 'rgba(244, 67, 54, 0.7)',
  },
  newImageLabel: {
    backgroundColor: 'rgba(76, 175, 80, 0.7)',
  },
  imageLabelText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  deletedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  addImageButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    width: '100%',
  },
  addImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brandColor,
    marginTop: 8,
  },
  addImageSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  slotText: {
    fontSize: 12,
    color: colors.brandColor,
    marginTop: 4,
    fontWeight: '600',
  },
  limitReachedContainer: {
    alignItems: 'center',
    padding: 20,
  },
  limitReachedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
  },
  limitReachedSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  tipsSection: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  detailSection: {
    marginBottom: 24,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,
  },
  imageActionButtons: {
    alignItems: 'flex-end',
  },
  editImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editImagesButtonText: {
    fontSize: 14,
    color: colors.brandColor,
    marginLeft: 4,
  },
  subText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  imageScrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  shopImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  shopImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  deleteImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageQuickButton: {
    width: 100,
    height: 100,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.brandColor,
    borderStyle: 'dashed',
  },
  addImageQuickText: {
    fontSize: 12,
    color: colors.brandColor,
    marginTop: 4,
  },
  noImagesContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  noImagesText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
  },
  addFirstImageButton: {
    alignItems: 'center',
  },
  addFirstImageText: {
    fontSize: 16,
    color: colors.brandColor,
    fontWeight: '600',
    marginTop: 8,
  },
  addFirstImageSubText: {
    fontSize: 12,
    color: '#666',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    position: 'relative',
  },
  disabledServiceTag: {
    backgroundColor: '#F5F5F5',
  },
  serviceText: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '500',
  },
  servicePriceText: {
    fontSize: 14,
    color: colors.brandColor,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  serviceCategoryText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  serviceEditIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.brandColor,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  ownershipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  ownershipBannerText: {
    fontSize: 14,
    color: colors.black,
    marginLeft: 8,
    flex: 1,
  },
  modalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  editCleanerButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  editCleanerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyDryCleaners;