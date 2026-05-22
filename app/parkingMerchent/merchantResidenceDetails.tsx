import React, { useState, useCallback } from 'react';
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
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import { useSelector } from 'react-redux';
import { RootState } from '../../components/redux/store';
import axiosInstance from '../../api/axios';
import {
  ArrowLeft,
  Clock,
  Plus,
  Repeat,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import TimeWheelPicker from './Timewheelpicker';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkingHours {
  day: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  isOpen?: boolean;
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
  gpsLocation: { type: 'Point'; coordinates: [number, number] };
  isActive: boolean;
  emergencyContact?: { person: string; number: string };
  parking_pass: boolean;
  transportationAvailable: boolean;
  transportationTypes?: string[];
  coveredDrivewayAvailable: boolean;
  coveredDrivewayTypes?: string[];
  securityCamera: boolean;
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
  const [isDailyRateSaving, setIsDailyRateSaving] = useState(false);
  const [localImages, setLocalImages] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ── Time Wheel Picker state ───────────────────────────────────────────────
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    slotIndex: number;
    field: 'fromTime' | 'toTime';
  } | null>(null);
  const [timePickerValue, setTimePickerValue] = useState('06:00');

  const residenceId = params.residenceId as string;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchResidenceDetails = useCallback(
    async (showLoader = true) => {
      if (!residenceId) {
        setError('No residence ID provided.');
        return;
      }
      if (showLoader) setIsLoading(true);
      setError(null);
      try {
        // Fire both requests in parallel — residence details + daily rate settings
        const [residenceResponse, dailyRateResponse] = await Promise.all([
          axiosInstance.get(`/merchants/residence/${residenceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axiosInstance.get(
            `/merchants/daily-rate-settings/residence/${residenceId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => null),
        ]);

        if (residenceResponse.data?.success && residenceResponse.data.data) {
          const fetchedData = residenceResponse.data.data;

          // Merge daily rate fields from the dedicated endpoint
          const dailyRateData = dailyRateResponse?.data?.data;

          const enriched: IResidence = {
            ...fetchedData,
            monthlyChargeEnabled: fetchedData.monthlyChargeEnabled ?? false,
            monthlyRate: fetchedData.monthlyRate ?? 0,
            // Use dedicated daily-rate endpoint values — they are always up to date
            dailyRateEnabled: dailyRateData?.dailyRateEnabled ?? fetchedData.dailyRateEnabled ?? false,
            dailyRates: dailyRateData?.dailyRates ?? fetchedData.dailyRates ?? [],
          };
          setResidenceDetails(enriched);
          setFormData(enriched);
          setLocalImages(
            enriched.images.map((uri: string) => ({
              uri,
              name: uri.split('/').pop() || 'image.jpg',
              type: 'image/jpeg',
            }))
          );
        } else {
          throw new Error(residenceResponse.data?.message || 'Invalid response.');
        }
      } catch (err: any) {
        setError(
          'Failed to load residence details: ' +
            (err.response?.data?.message || err.message)
        );
      } finally {
        if (showLoader) setIsLoading(false);
        setRefreshing(false);
      }
    },
    [residenceId, token]
  );

  useFocusEffect(
    useCallback(() => {
      fetchResidenceDetails();
    }, [fetchResidenceDetails])
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteResidence = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this residence? This is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await axiosInstance.delete(
                `/merchants/residence/delete/${residenceId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Residence deleted successfully.');
              router.back();
            } catch (err: any) {
              Alert.alert(
                'Deletion Failed',
                err.response?.data?.message || 'An error occurred.'
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
    setCurrentImageIndex((prev) => (prev + 1) % localImages.length);
  const handlePrevImage = () =>
    setCurrentImageIndex(
      (prev) => (prev - 1 + localImages.length) % localImages.length
    );

  const handleImagePickerForEdit = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 10 - localImages.length,
    });
    if (result.assets) {
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri || '',
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      }));
      setLocalImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeLocalImage = (index: number) => {
    setLocalImages((prev) => prev.filter((_, i) => i !== index));
    if (currentImageIndex >= localImages.length - 1)
      setCurrentImageIndex(Math.max(0, localImages.length - 2));
  };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof IResidence, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleEmergencyContactChange = (
    field: 'person' | 'number',
    value: string
  ) =>
    setFormData((prev) => ({
      ...prev,
      emergencyContact: {
        ...(prev.emergencyContact || { person: '', number: '' }),
        [field]: value,
      },
    }));

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData(residenceDetails || {});
    setLocalImages(
      residenceDetails?.images.map((uri) => ({
        uri,
        name: uri.split('/').pop() || 'image.jpg',
        type: 'image/jpeg',
      })) || []
    );
    setError(null);
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

  // Open time wheel picker
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
  if (!residenceId) return;
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
        venueType: 'residence',
        venueId: residenceId,
        dailyRateEnabled: formData.dailyRateEnabled ?? false,
        dailyRates: slots.map(({ _id, ...rest }) => rest),
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data?.success) {
      Alert.alert('Success', 'Daily rate settings saved.');
      await fetchResidenceDetails(false);
    } else {
      throw new Error(response.data?.message || 'Save failed');
    }
  } catch (err: any) {
    // Extract Zod issues from multiple possible response shapes
    const responseData = err.response?.data;
    const issues: any[] =
      responseData?.issues ||
      responseData?.data?.issues ||
      responseData?.errors ||
      [];

    let msg: string;

    if (Array.isArray(issues) && issues.length > 0) {
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
                      p !== 'dailyRates' &&
                      p !== 'fromTime' &&
                      p !== 'toTime'
                  )
                  .join(' → ')
              : null;
          return pathStr ? `${pathStr}: ${issue.message}` : issue.message;
        })
        .join('\n');
    } else {
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
  const handleUpdateResidence = async () => {
  if (!residenceId || !formData) return;
  if (formData.monthlyChargeEnabled && (formData.monthlyRate ?? 0) <= 0) {
    Alert.alert(
      'Validation Error',
      'Please enter a valid Monthly/Permit rate greater than 0.'
    );
    return;
  }
  setIsUpdating(true);
  setError(null);
  try {
    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      const formKey = key as keyof IResidence;
      const value = formData[formKey];
      if (value === undefined || value === null) return;
      if (
        [
          'generalAvailable',
          'gpsLocation',
          'emergencyContact',
          'transportationTypes',
          'coveredDrivewayTypes',
        ].includes(formKey)
      ) {
        data.append(formKey, JSON.stringify(value));
      } else if (typeof value === 'boolean') {
        data.append(formKey, String(value));
      } else if (typeof value === 'number') {
        data.append(formKey, value.toString());
      } else if (typeof value === 'string') {
        data.append(formKey, value);
      }
    });

    localImages.forEach((image) => {
      if (!image.uri.startsWith('http')) {
        data.append('images', {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as any);
      }
    });

    const response = await axiosInstance.put(
      `/merchants/residence/update/${residenceId}`,
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
      Alert.alert('Success', 'Residence updated successfully');
      setIsEditing(false);
      await fetchResidenceDetails(false);
    } else {
      throw new Error(response.data?.message || 'Update failed');
    }
  } catch (err: any) {
    // Extract Zod issues from multiple possible response shapes
    const responseData = err.response?.data;
    const issues: any[] =
      responseData?.issues ||
      responseData?.data?.issues ||
      responseData?.errors ||
      [];

    let errorMessage: string;

    if (Array.isArray(issues) && issues.length > 0) {
      errorMessage = issues
        .map((issue: any) => {
          const pathStr =
            Array.isArray(issue.path) && issue.path.length > 0
              ? issue.path
                  .map((p: any) =>
                    typeof p === 'number' ? `Slot ${p + 1}` : p
                  )
                  .filter(
                    (p: any) =>
                      p !== 'dailyRates' &&
                      p !== 'fromTime' &&
                      p !== 'toTime'
                  )
                  .join(' → ')
              : null;
          return pathStr ? `${pathStr}: ${issue.message}` : issue.message;
        })
        .join('\n');
    } else {
      errorMessage =
        responseData?.message ||
        err.message ||
        'Failed to update residence.';
    }

    setError(errorMessage);
    Alert.alert('Update Error', errorMessage);
  } finally {
    setIsUpdating(false);
  }
};

  // ── Loading / error states ────────────────────────────────────────────────
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
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchResidenceDetails()}
        >
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
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
            <Image
              source={images.defaultParkingLot}
              style={styles.mainImagePlaceholder}
            />
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
              onChangeText={(t) => handleInputChange('residenceName', t)}
            />
          ) : (
            <Text style={styles.displayValue}>
              {residenceDetails.residenceName}
            </Text>
          )}

          <Text style={styles.label}>Address</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.address || ''}
              onChangeText={(t) => handleInputChange('address', t)}
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
              onChangeText={(t) =>
                handleInputChange('price', parseFloat(t) || 0)
              }
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
                onValueChange={(v) => handleInputChange('isActive', v)}
                trackColor={{ false: '#767577', true: colors.brandColor }}
              />
            ) : (
              <Text style={styles.displayValue}>
                {residenceDetails.isActive ? 'Yes' : 'No'}
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
            />
          ) : (
            <Text style={styles.aboutText}>
              {residenceDetails.about || 'No description.'}
            </Text>
          )}
        </View>

        {/* Amenities */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Security Camera</Text>
            {isEditing ? (
              <Switch
                value={formData.securityCamera}
                onValueChange={(v) => handleInputChange('securityCamera', v)}
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
                onValueChange={(v) => handleInputChange('parking_pass', v)}
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
                onValueChange={(v) =>
                  handleInputChange('transportationAvailable', v)
                }
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
              onChangeText={(t) =>
                handleInputChange(
                  'transportationTypes',
                  t.split(',').map((s) => s.trim())
                )
              }
              placeholder="e.g., Bus, Metro"
            />
          )}
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Covered Driveway</Text>
            {isEditing ? (
              <Switch
                value={formData.coveredDrivewayAvailable}
                onValueChange={(v) =>
                  handleInputChange('coveredDrivewayAvailable', v)
                }
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
              onChangeText={(t) =>
                handleInputChange(
                  'coveredDrivewayTypes',
                  t.split(',').map((s) => s.trim())
                )
              }
              placeholder="e.g., Garage, Carport"
            />
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
              onChangeText={(t) => handleInputChange('contactNumber', t)}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.displayValue}>
              {residenceDetails.contactNumber}
            </Text>
          )}
          <Text style={styles.label}>Email</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.email || ''}
              onChangeText={(t) => handleInputChange('email', t)}
              keyboardType="email-address"
            />
          ) : (
            <Text style={styles.displayValue}>
              {residenceDetails.email || 'N/A'}
            </Text>
          )}
          <Text style={styles.label}>Emergency Contact Person</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.emergencyContact?.person || ''}
              onChangeText={(t) =>
                handleEmergencyContactChange('person', t)
              }
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
              onChangeText={(t) =>
                handleEmergencyContactChange('number', t)
              }
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.displayValue}>
              {residenceDetails.emergencyContact?.number || 'N/A'}
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
                      residenceDetails.monthlyChargeEnabled
                        ? '#F0FDF4'
                        : '#F5F5F5',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: residenceDetails.monthlyChargeEnabled
                        ? '#22C55E'
                        : colors.gray,
                    },
                  ]}
                >
                  {residenceDetails.monthlyChargeEnabled
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
                    handleInputChange('monthlyRate', parseFloat(t) || 0)
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
                    <Text style={styles.ratePreviewLabel}>Monthly/Permit Rate</Text>
                    <Text style={styles.ratePreviewValue}>
                      ${(formData.monthlyRate ?? 0).toFixed(2)}/mo per slot
                    </Text>
                  </View>
                  <View style={styles.ratePreviewRow}>
                    <Text style={styles.ratePreviewLabel}>Annual per slot</Text>
                    <Text style={styles.ratePreviewValue}>
                      ${((formData.monthlyRate ?? 0) * 12).toFixed(2)}/yr
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {!isEditing && residenceDetails.monthlyChargeEnabled && (
            <View style={styles.planViewRow}>
              <Text style={styles.label}>Monthly/Permit Rate</Text>
              <Text style={styles.planRateDisplay}>
                ${residenceDetails.monthlyRate.toFixed(2)}
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
            <Text style={styles.sectionTitle}>Daily Rate (Time Slots)</Text>
          </View>

          <Text style={styles.dailyRateHint}>
            Define flat-fee time windows. Each window is charged once the
            booking enters it. The last slot repeats beyond midnight.
          </Text>

          {/* ── Enable toggle ── */}
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Enable Daily Rate Slots</Text>
            {isEditing ? (
              <Switch
                value={formData.dailyRateEnabled || false}
                onValueChange={(v) => {
                  // FIX: Only toggle the flag — do NOT clear dailyRates
                  handleInputChange('dailyRateEnabled', v);
                }}
                trackColor={{ false: '#767577', true: colors.brandColor }}
              />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: residenceDetails.dailyRateEnabled
                      ? '#F0FDF4'
                      : '#F5F5F5',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: residenceDetails.dailyRateEnabled
                        ? '#22C55E'
                        : colors.gray,
                    },
                  ]}
                >
                  {residenceDetails.dailyRateEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Edit mode: slot editor always visible when editing ── */}
          {isEditing && (
            <View>
              {/* Hint when disabled */}
              {!formData.dailyRateEnabled && (
                <Text style={styles.disabledHint}>
                  Toggle "Enable Daily Rate Slots" on to activate these slots for bookings. You can still configure them below.
                </Text>
              )}

              {(formData.dailyRates || []).map((slot, index) => (
                <View key={index} style={[
                  styles.slotCard,
                  !formData.dailyRateEnabled && styles.slotCardDisabled,
                ]}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotIndex}>Slot {index + 1}</Text>
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
                        onPress={() => openTimePicker(index, 'fromTime')}
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
                        onPress={() => openTimePicker(index, 'toTime')}
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
                      value={slot.price > 0 ? slot.price.toString() : ''}
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

              {/* Save daily rate button always shown in edit mode */}
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
                  <Text style={styles.saveDailyRateText}>Save Daily Rate</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── View mode ── */}
          {!isEditing && residenceDetails.dailyRateEnabled && (
            <View>
              {residenceDetails.dailyRates.length === 0 ? (
                <Text style={styles.noSlotsText}>
                  No slots configured yet.
                </Text>
              ) : (
                residenceDetails.dailyRates.map((slot, index) => (
                  <View key={index} style={styles.slotViewRow}>
                    <View style={styles.slotViewLeft}>
                      <Text style={styles.slotViewLabel}>{slot.label}</Text>
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

          {/* View mode: disabled but has slots configured */}
          {!isEditing && !residenceDetails.dailyRateEnabled && residenceDetails.dailyRates.length > 0 && (
            <Text style={styles.disabledHint}>
              {residenceDetails.dailyRates.length} slot(s) configured but daily rates are currently disabled.
            </Text>
          )}
        </View>

        <View style={{ height: responsiveHeight(5) }} />
      </ScrollView>

      {/* ── Time Wheel Picker Modal ── */}
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
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsiveWidth(5),
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    marginTop:
      Platform.OS === 'ios' ? responsiveHeight(6) : responsiveHeight(2),
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
  saveButton: { padding: responsiveWidth(1.5) },
  saveButtonDisabled: { opacity: 0.5 },
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
  imageWrapper: { width: '100%', height: '100%', position: 'relative' },
  galleryImage: { width: '100%', height: '100%' },
  deleteGalleryImageButton: {
    position: 'absolute',
    top: responsiveWidth(2.5),
    right: responsiveWidth(2.5),
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: responsiveWidth(5),
    padding: responsiveWidth(1.5),
  },
  mainImagePlaceholder: { width: '100%', height: '100%' },
  addImagesButton: {
    position: 'absolute',
    bottom: responsiveWidth(2.5),
    right: responsiveWidth(2.5),
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(3.5),
    borderRadius: 5,
  },
  addImagesText: { color: 'white', fontSize: responsiveFontSize(1.6) },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -responsiveWidth(5),
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: responsiveWidth(5.5),
    width: responsiveWidth(11),
    height: responsiveWidth(11),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftArrow: { left: responsiveWidth(2) },
  rightArrow: { right: responsiveWidth(2) },
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
  aboutInput: { minHeight: responsiveHeight(10), textAlignVertical: 'top' },
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
  statusPillText: { fontSize: responsiveFontSize(1.5), fontWeight: '700' },
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
  ratePreviewLabel: { fontSize: responsiveFontSize(1.6), color: colors.gray },
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
  // FIX: new style for the "disabled but configurable" hint
  disabledHint: {
    fontSize: responsiveFontSize(1.5),
    color: colors.gray,
    fontStyle: 'italic',
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
  // FIX: dimmed style for slots when daily rate is disabled
  slotCardDisabled: {
    opacity: 0.6,
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
  slotTimeDivider: {
    paddingBottom: responsiveHeight(1.2),
  },
  slotTimeDividerText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    fontWeight: '700',
  },

  // Time picker button (replaces text input for times)
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

export default MerchantResidenceDetails;