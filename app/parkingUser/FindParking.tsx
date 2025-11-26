import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { images } from '../../assets/images/images';
import colors from '../../assets/color';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_MARGIN_TOP = Platform.OS === 'ios' ? 50 : 70;

interface LocationCoords {
  longitude: number;
  latitude: number;
}

const CustomBackButton = ({ onPress, color = colors.brandColor }: { onPress: () => void; color?: string }) => (
  <TouchableOpacity onPress={onPress} style={styles.backButton}>
    <Text style={[styles.backButtonText, { color }]}>←</Text>
  </TouchableOpacity>
);

const LocateDryCleaners: React.FC = () => {
  const router = useRouter();
  const [currLoc, setCurrLoc] = useState<LocationCoords | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qLocation, setQLocation] = useState<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSearchTime, setLastSearchTime] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  // Search location using Nominatim API
  const searchLocation = async (query: string) => {
    if (!query.trim()) return;

    const now = Date.now();
    if (lastSearchTime && now - lastSearchTime < 1000) {
      Alert.alert('Please wait', 'Searching too quickly. Wait a moment and try again.');
      return;
    }

    setLastSearchTime(now);
    setLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`
      );
      
      const data = await response.json();

      if (data && data.length > 0) {
        const firstResult = data[0];
        const newLocation = {
          latitude: parseFloat(firstResult.lat),
          longitude: parseFloat(firstResult.lon),
        };

        setSelectedLocation(newLocation);
        setQLocation(firstResult.display_name);

        if (mapRef.current) {
          const region: Region = {
            ...newLocation,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          mapRef.current.animateToRegion(region, 1000);
        }
      } else {
        Alert.alert('Location not found', 'Please try a different search term');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      Alert.alert('Error', 'Failed to search location');
    } finally {
      setLoading(false);
    }
  };

  // Get current location using Expo Location
  const getCurrentLocation = useCallback(async () => {
    setLoading(true);
    
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please enable location permission in settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrLoc(newLocation);
      setSelectedLocation(newLocation);

      const [address] = await Location.reverseGeocodeAsync(newLocation);
      if (address) {
        const addressString = `${address.street || ''} ${address.city || ''} ${address.region || ''} ${address.postalCode || ''}`.trim();
        setQLocation(addressString || 'Current Location');
      } else {
        setQLocation('Current Location');
      }

      if (mapRef.current) {
        const region: Region = {
          ...newLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        mapRef.current.animateToRegion(region, 1000);
      }
    } catch (err: any) {
      console.error('Location error:', err);
      Alert.alert('Location Error', 'Unable to get your current location. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize location on component mount
  useEffect(() => {
    const initLocation = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        
        if (status === 'granted') {
          getCurrentLocation();
        } else {
          // Set a default location if permission not granted
          const defaultLocation = {
            latitude: 40.7128,
            longitude: -74.0060,
          };
          setSelectedLocation(defaultLocation);
          setQLocation('New York, USA');
        }
      } catch (err) {
        console.error('Permission check error:', err);
      }
    };

    initLocation();
  }, [getCurrentLocation]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const handleMapPress = useCallback(async (event: any) => {
    if (event?.nativeEvent?.coordinate) {
      const newLocation = event.nativeEvent.coordinate;
      setSelectedLocation(newLocation);
      setQLocation('Selected Location');

      setLoading(true);
      try {
        const [address] = await Location.reverseGeocodeAsync(newLocation);
        if (address) {
          const addressString = `${address.street || ''} ${address.city || ''} ${address.region || ''} ${address.postalCode || ''}`.trim();
          setQLocation(addressString || 'Selected Location');
        }
      } catch (err) {
        console.error('Reverse geocode error:', err);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const handleApply = () => {
    if (qLocation.trim()) {
      searchLocation(qLocation);
    }
  };

  const handleContinue = () => {
    if (selectedLocation) {
      router.push({
        pathname: '/dryCleanerUser/dryCleanersList',
        params: { 
          latitude: selectedLocation.latitude.toString(),
          longitude: selectedLocation.longitude.toString(),
        }
      });
    } else {
      Alert.alert('No Location Selected', 'Please select or search for a location first');
    }
  };

  const handleOrderHistory = () => {
    router.push('/dryCleanerUser/myOrder');
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/userHome');
    }
  };

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.mapPlaceholder}>
          <Image
            source={images.BookingConfirmationMap}
            style={styles.mapImage}
            resizeMode="cover"
          />
          <View style={styles.placeholderOverlay}>
            <Text style={styles.placeholderText}>
              Interactive Google Maps not available on web
            </Text>
            <Text style={styles.placeholderSubtext}>
              Select a location to continue
            </Text>
          </View>
        </View>
      );
    }

    const initialRegion = currLoc || selectedLocation || {
      latitude: 40.7128,
      longitude: -74.0060,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onMapReady={handleMapReady}
        showsUserLocation={!!currLoc}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        zoomControlEnabled={true}
      >
        {/* Only show selected location marker */}
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title={qLocation || 'Selected Location'}
            description="This location will be used to find dry cleaners"
            pinColor={colors.brandColor}
          />
        )}
        
        {/* REMOVED: All random dry cleaner markers */}
      </MapView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <CustomBackButton onPress={handleGoBack} />
          <Text style={styles.headerTitle}>Locate Dry Cleaners</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Map Section */}
        <View style={styles.mapContainer}>
          {renderMap()}
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandColor} />
              <Text style={styles.loadingText}>Finding location...</Text>
            </View>
          )}
        </View>

        {/* Location Input Section */}
        <View style={styles.locationSection}>
          <Text style={styles.locationTitle}>Location</Text>
          
          <View style={styles.locationInputContainer}>
            <Image
              source={images.location}
              style={styles.locationIcon}
              resizeMode="contain"
            />
            <TextInput
              placeholder="Search location..."
              placeholderTextColor="#707070"
              value={qLocation}
              onChangeText={setQLocation}
              style={styles.locationInput}
              onSubmitEditing={() => searchLocation(qLocation)}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={getCurrentLocation}
              disabled={loading}
            >
              <Image
                source={images.gps}
                style={{ 
                  width: 24, 
                  height: 24,
                  opacity: loading ? 0.5 : 1 
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={getCurrentLocation} disabled={loading}>
            <Text style={[styles.useCurrentLocation, loading && styles.disabledText]}>
              Use Current Location
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.applyButton, (!qLocation.trim() || loading) && styles.disabledButton]}
              onPress={handleApply}
              disabled={!qLocation.trim() || loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Searching...' : 'Apply'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.continueButton, (!selectedLocation || loading) && styles.disabledButton]}
              onPress={handleContinue}
              disabled={!selectedLocation || loading}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            Select your location to find nearby dry cleaners. You'll see available dry cleaners on the next screen.
          </Text>

          <TouchableOpacity 
            style={styles.orderHistoryButton}
            onPress={handleOrderHistory}
          >
            <Text style={styles.orderHistoryText}>VIEW ORDER HISTORY</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: HEADER_MARGIN_TOP,
    height: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40, // Same as back button for balance
  },
  backButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  mapContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.45,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  placeholderText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  placeholderSubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  locationSection: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  locationTitle: {
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 20,
    color: '#000000',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 10,
    marginBottom: 15,
  },
  locationIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8,
  },
  currentLocationButton: {
    padding: 8,
  },
  useCurrentLocation: {
    color: colors.brandColor,
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '500',
  },
  disabledText: {
    opacity: 0.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  applyButton: {
    backgroundColor: colors.black,
    marginRight: 10,
  },
  continueButton: {
    backgroundColor: colors.brandColor,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  disclaimer: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  orderHistoryButton: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
  },
  orderHistoryText: {
    color: colors.brandColor,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocateDryCleaners;