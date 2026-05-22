

import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from 'react-native-responsive-dimensions';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import axiosInstance from '../../api/axios';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import { RootState } from '../../components/redux/store';
import TimeWheelPicker from './Timewheelpicker';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpaceInfo {
  count: number;
  price: number;
}

interface WorkingHours {
  day: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  is24Hours: boolean;
}

interface IDailyRateSlot {
  _id?: string;
  label: string;
  fromTime: string;
  toTime: string;
  price: number;
}

interface Garage {
  _id: string;
  garageName: string;
  about: string;
  address: string;
  contactNumber: string;
  email?: string;
  price: number;
  images: string[];
  spacesList: Record<string, SpaceInfo>;
  generalAvailable: WorkingHours[];
  is24x7: boolean;
  location: { type: 'Point'; coordinates: [number, number] };
  emergencyContact?: { person: string; number: string };
  vehicleType: 'bike' | 'car' | 'both';
  monthlyChargeEnabled: boolean;
  monthlyRate: number;
  dailyRateEnabled: boolean;
  dailyRates: IDailyRateSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptySlot = (): IDailyRateSlot => ({
  label: '',
  fromTime: '06:00',
  toTime: '18:00',
  price: 0,
});

// ── Component ─────────────────────────────────────────────────────────────────

const MerchantGarageDetails = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { garageId, garageData: garageDataParam } = params;

  const initialGarageData: Garage | null = garageDataParam
    ? JSON.parse(garageDataParam as string)
    : null;
  const { token } = useSelector((state: RootState) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialGarageData);
  const [refreshing, setRefreshing] = useState(false);
  const [garageDetails, setGarageDetails] = useState<Garage | null>(
    initialGarageData
  );
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Garage>>(
    initialGarageData || {}
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDailyRateSaving, setIsDailyRateSaving] = useState(false);
  const [showWorkingHoursTimePicker, setShowWorkingHoursTimePicker] = useState<{
    day: string;
    field: 'open' | 'close';
  } | null>(null);
  const [localImages, setLocalImages] = useState<
    { uri: string; name: string; type: string }[]
  >(
    initialGarageData?.images?.map((uri: string) => ({
      uri,
      name: uri.split('/').pop() || 'image.jpg',
      type: 'image/jpeg',
    })) || []
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ── Time Wheel Picker state ───────────────────────────────────────────────
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    slotIndex: number;
    field: 'fromTime' | 'toTime';
  } | null>(null);
  const [timePickerValue, setTimePickerValue] = useState('06:00');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchGarageDetails = useCallback(
    async (showLoader = true) => {
      if (!garageId) {
        setError('No garage ID provided');
        return;
      }
      try {
        if (showLoader) setIsLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/merchants/garage/${garageId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data?.data?.garage) {
          const gd = response.data.data.garage;
          const enriched: Garage = {
            ...gd,
            monthlyChargeEnabled: gd.monthlyChargeEnabled ?? false,
            monthlyRate: gd.monthlyRate ?? 0,
            dailyRateEnabled: gd.dailyRateEnabled ?? false,
            dailyRates: gd.dailyRates ?? [],
          };
          setGarageDetails(enriched);
          setFormData(enriched);
          setLocalImages(
            enriched.images.map((uri: string) => ({
              uri,
              name: uri.split('/').pop() || 'image.jpg',
              type: 'image/jpeg',
            }))
          );
        } else {
          throw new Error(
            'Invalid response structure or garage not found.'
          );
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to load garage details'
        );
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [garageId, token]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGarageDetails(false);
  }, [fetchGarageDetails]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteGarage = async () => {
    if (!garageId) {
      Alert.alert('Error', 'Garage ID not found.');
      return;
    }
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this garage? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await axiosInstance.delete(
                `/merchants/garage/delete/${garageId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Garage deleted successfully.');
              router.back();
            } catch (err: any) {
              Alert.alert(
                'Deletion Failed',
                err.response?.data?.message ||
                  'An unexpected error occurred.'
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Image helpers ─────────────────────────────────────────────────────────
  const handleNextImage = () =>
    setCurrentImageIndex((prev) =>
      prev === localImages.length - 1 ? 0 : prev + 1
    );
  const handlePrevImage = () =>
    setCurrentImageIndex((prev) =>
      prev === 0 ? localImages.length - 1 : prev - 1
    );

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof Garage, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleDayChange = (index: number, field: string, value: any) => {
    const updatedDays = [...(formData.generalAvailable || [])];
    updatedDays[index] = { ...updatedDays[index], [field]: value };
    handleInputChange('generalAvailable', updatedDays);
  };

  const handleWorkingHoursTimeChange = (
    event: any,
    selectedTime?: Date
  ) => {
    if (selectedTime && showWorkingHoursTimePicker) {
      const timeString = `${selectedTime
        .getHours()
        .toString()
        .padStart(2, '0')}:${selectedTime
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const dayIndex =
        formData.generalAvailable?.findIndex(
          (d) => d.day === showWorkingHoursTimePicker.day
        ) ?? -1;
      if (dayIndex !== -1 && formData.generalAvailable) {
        const newGA = [...formData.generalAvailable];
        if (showWorkingHoursTimePicker.field === 'open')
          newGA[dayIndex].openTime = timeString;
        else newGA[dayIndex].closeTime = timeString;
        handleInputChange('generalAvailable', newGA);
      }
    }
    setShowWorkingHoursTimePicker(null);
  };

  const handleSpaceChange = (
    zone: string,
    field: keyof SpaceInfo,
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      spacesList: {
        ...prev.spacesList,
        [zone]: {
          ...(prev.spacesList?.[zone] || { count: 0, price: 0 }),
          [field]: numValue,
        },
      },
    }));
  };

  const handleImagePickerForEdit = async () => {
    try {
      const { granted } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Grant permission to access the photo library.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: Math.max(0, 5 - localImages.length),
      });
      if (result.canceled) return;
      if (result.assets?.length) {
        const newImages = result.assets.map((asset) => ({
          uri: asset.uri,
          name:
            asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        }));
        setLocalImages((prev) => [...prev, ...newImages]);
      }
    } catch {
      Alert.alert('Error', 'Failed to select images');
    }
  };

  const removeLocalImage = (index: number) => {
    const newImages = [...localImages];
    newImages.splice(index, 1);
    setLocalImages(newImages);
    if (
      currentImageIndex >= newImages.length &&
      newImages.length > 0
    )
      setCurrentImageIndex(newImages.length - 1);
  };

  // ── Daily Rate helpers ────────────────────────────────────────────────────
  const handleDailyRateSlotChange = (
    index: number,
    field: keyof IDailyRateSlot,
    value: any
  ) => {
    const slots = [...(formData.dailyRates || [])];
    slots[index] = { ...slots[index], [field]: value };
    handleInputChange('dailyRates', slots);
  };

  const addDailyRateSlot = () => {
    handleInputChange('dailyRates', [
      ...(formData.dailyRates || []),
      emptySlot(),
    ]);
  };

  const removeDailyRateSlot = (index: number) => {
    const slots = [...(formData.dailyRates || [])];
    slots.splice(index, 1);
    handleInputChange('dailyRates', slots);
  };

  // Open time wheel picker for daily rate slots
  const openTimePicker = (
    slotIndex: number,
    field: 'fromTime' | 'toTime'
  ) => {
    const slot = formData.dailyRates?.[slotIndex];
    setTimePickerValue(
      (field === 'fromTime' ? slot?.fromTime : slot?.toTime) || '06:00'
    );
    setTimePickerTarget({ slotIndex, field });
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (time: string) => {
    if (timePickerTarget) {
      handleDailyRateSlotChange(
        timePickerTarget.slotIndex,
        timePickerTarget.field,
        time
      );
    }
    setTimePickerVisible(false);
    setTimePickerTarget(null);
  };

  // ── Save daily rate ───────────────────────────────────────────────────────
 const handleSaveDailyRate = async () => {
  if (!garageId) return;
  const slots: IDailyRateSlot[] = formData.dailyRates || [];

  if (formData.dailyRateEnabled) {
    if (slots.length === 0) {
      Alert.alert('Validation Error', 'Add at least one time slot.');
      return;
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.label.trim()) {
        Alert.alert('Validation Error', `Slot ${i + 1}: label is required.`);
        return;
      }
      if (!s.fromTime) {
        Alert.alert('Validation Error', `Slot ${i + 1}: From time is required.`);
        return;
      }
      if (!s.toTime) {
        Alert.alert('Validation Error', `Slot ${i + 1}: To time is required.`);
        return;
      }
      if (s.price < 0) {
        Alert.alert('Validation Error', `Slot ${i + 1}: price must be ≥ 0.`);
        return;
      }
    }
  }

  try {
    setIsDailyRateSaving(true);
    const response = await axiosInstance.patch(
      '/merchants/daily-rate-settings',
      {
        venueType: 'garage',
        venueId: garageId,
        dailyRateEnabled: formData.dailyRateEnabled ?? false,
        dailyRates: slots.map(({ _id, ...rest }) => rest),
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data?.success) {
      Alert.alert('Success', 'Daily rate settings saved.');
      await fetchGarageDetails(false);
    } else {
      throw new Error(response.data?.message || 'Save failed');
    }
  } catch (err: any) {
    // Try to extract Zod issues from the response
    const responseData = err.response?.data;
    const issues: any[] =
      responseData?.issues ||
      responseData?.data?.issues ||
      responseData?.errors ||
      [];

    let msg: string;

    if (Array.isArray(issues) && issues.length > 0) {
      // Format each Zod issue into a readable line
      msg = issues
        .map((issue: any) => {
          const pathStr =
            Array.isArray(issue.path) && issue.path.length > 0
              ? issue.path
                  .map((p: any) =>
                    typeof p === 'number' ? `Slot ${p + 1}` : p
                  )
                  .filter(
                    (p: any) =>
                      p !== 'dailyRates' && p !== 'fromTime' && p !== 'toTime'
                  )
                  .join(' → ')
              : null;
          return pathStr ? `${pathStr}: ${issue.message}` : issue.message;
        })
        .join('\n');
    } else {
      // Fallback to generic message
      msg =
        responseData?.message ||
        err.message ||
        'Failed to save daily rate settings.';
    }

    Alert.alert('Error', msg);
  } finally {
    setIsDailyRateSaving(false);
  }
};

  // ── Update main details ───────────────────────────────────────────────────
  const handleUpdateGarage = async () => {
    if (!garageId || !formData) return;
    if (
      formData.monthlyChargeEnabled &&
      (formData.monthlyRate ?? 0) <= 0
    ) {
      Alert.alert(
        'Validation Error',
        'Please enter a valid Monthly/Permit rate greater than 0.'
      );
      return;
    }
    try {
      setIsUpdating(true);
      setError(null);

      const data = new FormData();
      data.append('garageName', formData.garageName || '');
      data.append('about', formData.about || '');
      data.append('address', formData.address || '');
      data.append('contactNumber', formData.contactNumber || '');
      data.append('email', formData.email || '');
      data.append('is24x7', (formData.is24x7 || false).toString());
      data.append('price', (formData.price || 0).toString());
      data.append('vehicleType', formData.vehicleType || 'both');
      data.append(
        'monthlyChargeEnabled',
        (formData.monthlyChargeEnabled || false).toString()
      );
      data.append(
        'monthlyRate',
        (formData.monthlyRate || 0).toString()
      );
      data.append(
        'generalAvailable',
        JSON.stringify(formData.generalAvailable || [])
      );
      data.append(
        'spacesList',
        JSON.stringify(formData.spacesList || {})
      );
      data.append(
        'location',
        JSON.stringify(
          formData.location || { type: 'Point', coordinates: [0, 0] }
        )
      );
      if (
        formData.emergencyContact?.person &&
        formData.emergencyContact?.number
      ) {
        data.append(
          'emergencyContact',
          JSON.stringify(formData.emergencyContact)
        );
      }

      const existingUrls = localImages
        .filter((img) => img.uri.startsWith('http'))
        .map((img) => img.uri);
      const newFiles = localImages.filter(
        (img) => !img.uri.startsWith('http')
      );
      newFiles.forEach((image) =>
        data.append('images', {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as any)
      );
      data.append('existingImages', JSON.stringify(existingUrls));

      const response = await axiosInstance.put(
        `/merchants/garage/update/${garageId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data?.success) {
        await handleSaveDailyRate();
        Alert.alert('Success', 'Garage updated successfully');
        setIsEditing(false);
        await fetchGarageDetails(false);
      } else {
        throw new Error(response.data?.message || 'Update failed');
      }
    } catch (err: any) {
      let errorMessage = 'Failed to update garage';
      if (err.response?.data?.message)
        errorMessage = err.response.data.message;
      else if (err.response?.data?.errors?.length > 0)
        errorMessage =
          'Validation Errors:\n' +
          err.response.data.errors.map((e: any) => e.message).join('\n');
      else if (err.message) errorMessage = err.message;
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData(garageDetails || {});
    setLocalImages(
      garageDetails?.images.map((uri) => ({
        uri,
        name: uri.split('/').pop() || 'image.jpg',
        type: 'image/jpeg',
      })) || []
    );
    setError(null);
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading && !garageDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
        <Text style={styles.loadingText}>Loading garage details...</Text>
      </View>
    );
  }

  if (error && !garageDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage Details</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={60} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchGarageDetails()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!garageDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Garage Details</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.noGarageContainer}>
          <Text style={styles.noGarageText}>
            No garage information available
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {garageDetails.garageName}
          </Text>
          <View style={styles.headerActions}>
            {isEditing ? (
              <>
                <TouchableOpacity onPress={handleCancelEdit}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpdateGarage}
                  disabled={isUpdating}
                  style={[
                    styles.saveButton,
                    isUpdating && styles.saveButtonDisabled,
                  ]}
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
                <TouchableOpacity onPress={handleDeleteGarage}>
                  <Trash2 size={24} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <X size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Image Gallery */}
        <View style={styles.imageGalleryContainer}>
          {localImages.length > 0 ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: localImages[currentImageIndex].uri }}
                style={styles.galleryImage}
                resizeMode="cover"
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
            <Image
              source={images.defaultGarage}
              style={styles.mainImagePlaceholder}
              resizeMode="cover"
            />
          )}
          {localImages.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.arrowButton, styles.leftArrow]}
                onPress={handlePrevImage}
              >
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, styles.rightArrow]}
                onPress={handleNextImage}
              >
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {localImages.length}
                </Text>
              </View>
            </>
          )}
          {isEditing && (
            <TouchableOpacity
              style={styles.addImagesButton}
              onPress={handleImagePickerForEdit}
            >
              <Text style={styles.addImagesText}>
                Add/Replace Images
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.label}>Garage Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.garageName || ''}
              onChangeText={(t) => handleInputChange('garageName', t)}
              placeholder="Enter garage name"
            />
          ) : (
            <Text style={styles.garageName}>
              {garageDetails.garageName}
            </Text>
          )}

          <Text style={styles.label}>Address</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address || ''}
              onChangeText={(t) => handleInputChange('address', t)}
              placeholder="Enter address"
              multiline
            />
          ) : (
            <Text style={styles.address}>{garageDetails.address}</Text>
          )}

          <Text style={styles.label}>Base Price per Hour</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.price?.toString() || ''}
              onChangeText={(t) =>
                handleInputChange('price', parseFloat(t) || 0)
              }
              keyboardType="numeric"
              placeholder="Enter base price"
            />
          ) : (
            <Text style={styles.price}>
              ${garageDetails.price?.toFixed(2) || '0.00'}/hr
            </Text>
          )}

          <Text style={styles.label}>Vehicle Type</Text>
          {isEditing ? (
            <View style={styles.vehicleTypeContainer}>
              {(['bike', 'car', 'both'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicleType === type &&
                      styles.vehicleTypeButtonActive,
                  ]}
                  onPress={() => handleInputChange('vehicleType', type)}
                >
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      formData.vehicleType === type &&
                        styles.vehicleTypeTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.vehicleTypeDisplay}>
              {garageDetails.vehicleType?.charAt(0).toUpperCase() +
                garageDetails.vehicleType?.slice(1) || 'Both'}
            </Text>
          )}

          <View style={styles.switchContainer}>
            <Text style={styles.label}>24/7 Open</Text>
            {isEditing ? (
              <Switch
                value={formData.is24x7 || false}
                onValueChange={(v) => handleInputChange('is24x7', v)}
                trackColor={{ false: '#767577', true: colors.brandColor }}
              />
            ) : (
              <Text style={styles.switchText}>
                {garageDetails.is24x7 ? 'Yes' : 'No'}
              </Text>
            )}
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.aboutInput]}
              value={formData.about || ''}
              onChangeText={(t) => handleInputChange('about', t)}
              multiline
              placeholder="Describe your garage"
            />
          ) : (
            <Text style={styles.aboutText}>
              {garageDetails.about || 'No description provided'}
            </Text>
          )}
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.label}>Contact Number</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.contactNumber || ''}
              onChangeText={(t) =>
                handleInputChange('contactNumber', t)
              }
              placeholder="Contact number"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.contactText}>
              {garageDetails.contactNumber}
            </Text>
          )}
          <Text style={styles.label}>Email</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.email || ''}
              onChangeText={(t) => handleInputChange('email', t)}
              placeholder="Email"
              keyboardType="email-address"
            />
          ) : (
            <Text style={styles.contactText}>
              {garageDetails.email || 'Not provided'}
            </Text>
          )}
        </View>

        {/* Monthly Plan */}
        <View style={styles.card}>
          <View style={styles.planCardHeader}>
            <View style={styles.planIconWrap}>
              <Repeat size={18} color={colors.brandColor} />
            </View>
            <Text style={styles.sectionTitle}>Monthly/Permit Plan</Text>
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Enable Monthly/Permit Plans</Text>
            {isEditing ? (
              <Switch
                value={formData.monthlyChargeEnabled || false}
                onValueChange={(v) => {
                  handleInputChange('monthlyChargeEnabled', v);
                  if (!v) handleInputChange('monthlyRate', 0);
                }}
                trackColor={{ false: '#767577', true: colors.brandColor }}
              />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      garageDetails.monthlyChargeEnabled
                        ? '#F0FDF4'
                        : '#F5F5F5',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: garageDetails.monthlyChargeEnabled
                        ? '#22C55E'
                        : colors.gray,
                    },
                  ]}
                >
                  {garageDetails.monthlyChargeEnabled
                    ? 'Enabled'
                    : 'Disabled'}
                </Text>
              </View>
            )}
          </View>

          {isEditing && formData.monthlyChargeEnabled && (
            <View style={styles.rateContainer}>
              <Text style={styles.label}>Monthly/Permit Rate per Slot</Text>
              <View style={styles.rateInputRow}>
                <Text style={styles.ratePrefix}>$</Text>
                <TextInput
                  style={styles.rateInput}
                  value={
                    formData.monthlyRate && formData.monthlyRate > 0
                      ? formData.monthlyRate.toString()
                      : ''
                  }
                  onChangeText={(t) =>
                    handleInputChange(
                      'monthlyRate',
                      parseFloat(t) || 0
                    )
                  }
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.gray}
                />
                <Text style={styles.rateSuffix}>/mo</Text>
              </View>
              {(formData.monthlyRate ?? 0) > 0 && (
                <View style={styles.ratePreview}>
                  <View style={styles.ratePreviewRow}>
                    <Text style={styles.ratePreviewLabel}>
                      Monthly/Permit Rate
                    </Text>
                    <Text style={styles.ratePreviewValue}>
                      ${(formData.monthlyRate ?? 0).toFixed(2)}/mo per slot
                    </Text>
                  </View>
                  <View style={styles.ratePreviewRow}>
                    <Text style={styles.ratePreviewLabel}>
                      Annual per slot
                    </Text>
                    <Text style={styles.ratePreviewValue}>
                      ${((formData.monthlyRate ?? 0) * 12).toFixed(2)}/yr
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {!isEditing && garageDetails.monthlyChargeEnabled && (
            <View style={styles.planViewRow}>
              <Text style={styles.label}>Monthly/Permit Rate</Text>
              <Text style={styles.planRateDisplay}>
                ${garageDetails.monthlyRate.toFixed(2)}
                <Text style={styles.planRateSuffix}>/mo per slot</Text>
              </Text>
            </View>
          )}
        </View>

        {/* ── Daily Rate ──────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.planCardHeader}>
            <View style={styles.planIconWrap}>
              <Clock size={18} color={colors.brandColor} />
            </View>
            <Text style={styles.sectionTitle}>
              Daily Rate (Time Slots)
            </Text>
          </View>

          <Text style={styles.dailyRateHint}>
            Define flat-fee time windows. Each window is charged once
            entered. The last slot repeats beyond midnight.
          </Text>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Enable Daily Rate Slots</Text>
            {isEditing ? (
              <Switch
                value={formData.dailyRateEnabled || false}
                onValueChange={(v) => {
                  handleInputChange('dailyRateEnabled', v);
                  if (!v) handleInputChange('dailyRates', []);
                }}
                trackColor={{ false: '#767577', true: colors.brandColor }}
              />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: garageDetails.dailyRateEnabled
                      ? '#F0FDF4'
                      : '#F5F5F5',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: garageDetails.dailyRateEnabled
                        ? '#22C55E'
                        : colors.gray,
                    },
                  ]}
                >
                  {garageDetails.dailyRateEnabled
                    ? 'Enabled'
                    : 'Disabled'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Edit mode ── */}
          {isEditing && formData.dailyRateEnabled && (
            <View>
              {(formData.dailyRates || []).map((slot, index) => (
                <View key={index} style={styles.slotCard}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotIndex}>
                      Slot {index + 1}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeDailyRateSlot(index)}
                    >
                      <X size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Label</Text>
                  <TextInput
                    style={styles.input}
                    value={slot.label}
                    onChangeText={(t) =>
                      handleDailyRateSlotChange(index, 'label', t)
                    }
                    placeholder="e.g. Morning, Peak Hours"
                  />

                  {/* Time row — tappable buttons open the wheel picker */}
                  <View style={styles.slotTimeRow}>
                    <View style={styles.slotTimeGroup}>
                      <Text style={styles.label}>From</Text>
                      <TouchableOpacity
                        style={styles.timePickerButton}
                        onPress={() =>
                          openTimePicker(index, 'fromTime')
                        }
                        activeOpacity={0.7}
                      >
                        <Clock
                          size={15}
                          color={colors.brandColor}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.timePickerButtonText}>
                          {slot.fromTime || 'Set time'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.slotTimeDivider}>
                      <Text style={styles.slotTimeDividerText}>→</Text>
                    </View>
                    <View style={styles.slotTimeGroup}>
                      <Text style={styles.label}>To</Text>
                      <TouchableOpacity
                        style={styles.timePickerButton}
                        onPress={() =>
                          openTimePicker(index, 'toTime')
                        }
                        activeOpacity={0.7}
                      >
                        <Clock
                          size={15}
                          color={colors.brandColor}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.timePickerButtonText}>
                          {slot.toTime || 'Set time'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.label}>Flat Fee ($)</Text>
                  <View style={styles.rateInputRow}>
                    <Text style={styles.ratePrefix}>$</Text>
                    <TextInput
                      style={styles.rateInput}
                      value={
                        slot.price > 0 ? slot.price.toString() : ''
                      }
                      onChangeText={(t) =>
                        handleDailyRateSlotChange(
                          index,
                          'price',
                          parseFloat(t) || 0
                        )
                      }
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.gray}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSlotButton}
                onPress={addDailyRateSlot}
              >
                <Plus size={18} color={colors.brandColor} />
                <Text style={styles.addSlotText}>Add Time Slot</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveDailyRateButton,
                  isDailyRateSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveDailyRate}
                disabled={isDailyRateSaving || isUpdating}
              >
                {isDailyRateSaving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveDailyRateText}>
                    Save Daily Rate
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── View mode ── */}
          {!isEditing && garageDetails.dailyRateEnabled && (
            <View>
              {garageDetails.dailyRates.length === 0 ? (
                <Text style={styles.noSlotsText}>
                  No slots configured yet.
                </Text>
              ) : (
                garageDetails.dailyRates.map((slot, index) => (
                  <View key={index} style={styles.slotViewRow}>
                    <View style={styles.slotViewLeft}>
                      <Text style={styles.slotViewLabel}>
                        {slot.label}
                      </Text>
                      <Text style={styles.slotViewTime}>
                        {slot.fromTime} – {slot.toTime}
                      </Text>
                    </View>
                    <Text style={styles.slotViewPrice}>
                      ${slot.price.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Parking Zones */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parking Zones</Text>
          {Object.entries(
            formData.spacesList || garageDetails.spacesList || {}
          ).map(([zone, spaceInfo]) => (
            <View key={zone} style={styles.zoneContainer}>
              <Text style={styles.zoneLabel}>Zone {zone}</Text>
              {isEditing ? (
                <View style={styles.spaceInputRow}>
                  <View style={styles.spaceInputGroup}>
                    <Text style={styles.label}>Number of Slots</Text>
                    <TextInput
                      style={styles.input}
                      value={spaceInfo?.count?.toString() || '0'}
                      onChangeText={(t) =>
                        handleSpaceChange(zone, 'count', t)
                      }
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.spaceInputGroup}>
                    <Text style={styles.label}>Price per Hour</Text>
                    <TextInput
                      style={styles.input}
                      value={spaceInfo?.price?.toString() || '0'}
                      onChangeText={(t) =>
                        handleSpaceChange(zone, 'price', t)
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.spaceInfoRow}>
                  <View style={styles.spaceInfoItem}>
                    <Text style={styles.spaceInfoLabel}>Slots:</Text>
                    <Text style={styles.spaceInfoValue}>
                      {spaceInfo?.count || 0}
                    </Text>
                  </View>
                  <View style={styles.spaceInfoItem}>
                    <Text style={styles.spaceInfoLabel}>Price:</Text>
                    <Text style={styles.spaceInfoValue}>
                      ${spaceInfo?.price?.toFixed(2) || '0.00'}/hr
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Working Hours */}
        {!formData.is24x7 && !garageDetails.is24x7 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Working Hours</Text>
            {(
              formData.generalAvailable ||
              garageDetails.generalAvailable
            )?.map((day, index) => (
              <View key={day.day} style={styles.dayContainer}>
                <Text style={styles.dayLabel}>{day.day}</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Open</Text>
                  {isEditing ? (
                    <Switch
                      value={day.isOpen}
                      onValueChange={(v) =>
                        handleDayChange(index, 'isOpen', v)
                      }
                      trackColor={{
                        false: '#767577',
                        true: colors.brandColor,
                      }}
                    />
                  ) : (
                    <Text style={styles.switchText}>
                      {day.isOpen ? 'Yes' : 'No'}
                    </Text>
                  )}
                </View>
                {day.isOpen && !day.is24Hours && (
                  <>
                    <Text style={styles.label}>Open Time</Text>
                    {isEditing ? (
                      <TouchableOpacity
                        style={styles.input}
                        onPress={() =>
                          setShowWorkingHoursTimePicker({
                            day: day.day,
                            field: 'open',
                          })
                        }
                      >
                        <Text>
                          {day.openTime || 'Select time'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.timeText}>
                        {day.openTime || 'Not set'}
                      </Text>
                    )}
                    <Text style={styles.label}>Close Time</Text>
                    {isEditing ? (
                      <TouchableOpacity
                        style={styles.input}
                        onPress={() =>
                          setShowWorkingHoursTimePicker({
                            day: day.day,
                            field: 'close',
                          })
                        }
                      >
                        <Text>
                          {day.closeTime || 'Select time'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.timeText}>
                        {day.closeTime || 'Not set'}
                      </Text>
                    )}
                  </>
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>24 Hours</Text>
                  {isEditing ? (
                    <Switch
                      value={day.is24Hours}
                      onValueChange={(v) =>
                        handleDayChange(index, 'is24Hours', v)
                      }
                      trackColor={{
                        false: '#767577',
                        true: colors.brandColor,
                      }}
                    />
                  ) : (
                    <Text style={styles.switchText}>
                      {day.is24Hours ? 'Yes' : 'No'}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location</Text>
          {garageDetails.location?.coordinates ? (
            <>
              <Text style={styles.label}>
                Latitude:{' '}
                {garageDetails.location.coordinates[1].toFixed(6)}
              </Text>
              <Text style={styles.label}>
                Longitude:{' '}
                {garageDetails.location.coordinates[0].toFixed(6)}
              </Text>
            </>
          ) : (
            <Text style={styles.label}>Location not available</Text>
          )}
        </View>

        {/* Submit */}
        {isEditing && (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleUpdateGarage}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Update Garage</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Native working hours time picker (separate from slot picker) */}
        {showWorkingHoursTimePicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="default"
            onChange={handleWorkingHoursTimeChange}
          />
        )}
      </ScrollView>

      {/* ── Time Wheel Picker Modal for Daily Rate Slots ── */}
      <TimeWheelPicker
        visible={timePickerVisible}
        value={timePickerValue}
        title={
          timePickerTarget?.field === 'fromTime'
            ? 'Select Start Time'
            : 'Select End Time'
        }
        accentColor={colors.brandColor}
        onConfirm={handleTimeConfirm}
        onCancel={() => {
          setTimePickerVisible(false);
          setTimePickerTarget(null);
        }}
      />
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollView: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsiveWidth(5),
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
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
    gap: 15,
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
    marginRight: 10,
  },
  saveButton: { padding: 5 },
  saveButtonDisabled: { opacity: 0.5 },
  saveText: {
    color: '#4CAF50',
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee',
    padding: 10,
    marginHorizontal: responsiveWidth(5),
    borderRadius: 5,
    marginTop: 5,
  },
  errorBannerText: {
    flex: 1,
    color: colors.error,
    fontSize: responsiveFontSize(1.6),
    marginLeft: 5,
  },
  imageGalleryContainer: {
    height: responsiveHeight(30),
    width: '90%',
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    alignSelf: 'center',
    borderRadius: 50,
    marginTop: responsiveHeight(2),
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 50,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  deleteGalleryImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 5,
  },
  mainImagePlaceholder: { width: '100%', height: '100%' },
  addImagesButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  addImagesText: { color: 'white', fontSize: responsiveFontSize(1.6) },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftArrow: { left: -10 },
  rightArrow: { right: -10 },
  arrowText: { color: '#FFF', fontSize: 30, fontWeight: 'bold' },
  imageCounter: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: [{ translateX: -30 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  imageCounterText: { color: '#FFF', fontSize: responsiveFontSize(1.4) },
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
  garageName: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  label: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginBottom: responsiveHeight(0.5),
    marginTop: responsiveHeight(0.5),
  },
  address: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
    lineHeight: responsiveHeight(2),
  },
  price: {
    fontSize: responsiveFontSize(2),
    color: colors.brandColor,
    fontWeight: 'bold',
    marginBottom: responsiveHeight(1),
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
  textArea: {
    minHeight: responsiveHeight(8),
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: responsiveHeight(1.5),
  },
  zoneContainer: {
    marginBottom: responsiveHeight(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    paddingBottom: responsiveHeight(1),
  },
  zoneLabel: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  spaceInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spaceInputGroup: { width: '48%' },
  spaceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1),
  },
  spaceInfoItem: { flexDirection: 'row', alignItems: 'center' },
  spaceInfoLabel: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginRight: responsiveWidth(2),
  },
  spaceInfoValue: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    fontWeight: 'bold',
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
  contactText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  dayContainer: { marginBottom: responsiveHeight(2) },
  dayLabel: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1),
  },
  switchText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
  },
  timeText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1),
  },
  vehicleTypeButton: {
    paddingVertical: responsiveHeight(0.5),
    paddingHorizontal: responsiveWidth(3),
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.brandColor,
  },
  vehicleTypeButtonActive: { backgroundColor: colors.brandColor },
  vehicleTypeText: {
    fontSize: responsiveFontSize(1.6),
    color: colors.black,
  },
  vehicleTypeTextActive: { color: '#FFF' },
  vehicleTypeDisplay: {
    fontSize: responsiveFontSize(1.6),
    color: colors.black,
    marginBottom: responsiveHeight(1),
  },
  submitButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    padding: responsiveWidth(4),
    marginHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
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
  noGarageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveWidth(5),
  },
  noGarageText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    textAlign: 'center',
    marginBottom: responsiveHeight(2),
  },

  // Plan shared
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(0.5),
  },
  planIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF3E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: responsiveFontSize(1.5),
    fontWeight: '700',
  },
  rateContainer: { marginTop: responsiveHeight(0.5) },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: responsiveWidth(4),
    height: 52,
    backgroundColor: '#F5F5F5',
    marginBottom: responsiveHeight(1),
  },
  ratePrefix: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: '700',
    color: colors.gray,
    marginRight: 6,
  },
  rateInput: {
    flex: 1,
    fontSize: responsiveFontSize(2.2),
    fontWeight: '700',
    color: colors.black,
  },
  rateSuffix: { fontSize: responsiveFontSize(1.6), color: colors.gray },
  ratePreview: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: responsiveWidth(4),
    marginTop: responsiveHeight(0.5),
    gap: 8,
  },
  ratePreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratePreviewLabel: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
  },
  ratePreviewValue: {
    fontSize: responsiveFontSize(1.6),
    fontWeight: '700',
    color: colors.black,
  },
  planViewRow: { marginTop: responsiveHeight(0.5) },
  planRateDisplay: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: '900',
    color: colors.brandColor,
    marginTop: 2,
  },
  planRateSuffix: {
    fontSize: responsiveFontSize(1.4),
    fontWeight: '400',
    color: colors.gray,
  },

  // Daily rate
  dailyRateHint: {
    fontSize: responsiveFontSize(1.5),
    color: colors.gray,
    marginBottom: responsiveHeight(1.5),
    lineHeight: responsiveHeight(2.2),
  },
  slotCard: {
    backgroundColor: '#F9F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8F0',
    padding: responsiveWidth(3.5),
    marginBottom: responsiveHeight(1.5),
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveHeight(1),
  },
  slotIndex: {
    fontSize: responsiveFontSize(1.7),
    fontWeight: '700',
    color: colors.black,
  },
  slotTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(1),
  },
  slotTimeGroup: { flex: 1 },
  slotTimeDivider: { paddingBottom: responsiveHeight(1.2) },
  slotTimeDividerText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    fontWeight: '700',
  },

  // Time picker button
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.brandColor,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(1.2),
    marginBottom: responsiveHeight(1),
  },
  timePickerButtonText: {
    fontSize: responsiveFontSize(1.9),
    fontWeight: '700',
    color: colors.brandColor,
  },

  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.brandColor,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: responsiveHeight(1.5),
    gap: responsiveWidth(2),
    marginTop: responsiveHeight(0.5),
    marginBottom: responsiveHeight(1.5),
  },
  addSlotText: {
    fontSize: responsiveFontSize(1.7),
    color: colors.brandColor,
    fontWeight: '600',
  },
  saveDailyRateButton: {
    backgroundColor: colors.brandColor,
    borderRadius: 10,
    paddingVertical: responsiveHeight(1.5),
    alignItems: 'center',
    marginTop: responsiveHeight(0.5),
  },
  saveDailyRateText: {
    color: '#FFF',
    fontSize: responsiveFontSize(1.8),
    fontWeight: '700',
  },
  slotViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveHeight(1.2),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  slotViewLeft: { flex: 1 },
  slotViewLabel: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: '600',
    color: colors.black,
  },
  slotViewTime: {
    fontSize: responsiveFontSize(1.5),
    color: colors.gray,
    marginTop: 2,
  },
  slotViewPrice: {
    fontSize: responsiveFontSize(2),
    fontWeight: '800',
    color: colors.brandColor,
  },
  noSlotsText: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    textAlign: 'center',
    paddingVertical: responsiveHeight(1),
  },
});

export default MerchantGarageDetails;