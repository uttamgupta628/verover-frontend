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

const CustomBackButton = ({ onPress, color = colors.primary }: { onPress: () => void; color?: string }) => (
  <TouchableOpacity onPress={onPress} style={styles.backButton}>
    <Text style={[styles.backButtonText, { color }]}>←</Text>
  </TouchableOpacity>
);

const FindParking: React.FC = () => {
  const router = useRouter();
  const [currLoc, setCurrLoc] = useState<LocationCoords | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null); 
  const [qLocation, setQLocation] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false); 
  const mapRef = useRef<MapView>(null);

  const getCurrentLocation = useCallback(async () => {
    setLoading(true);
    
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please enable location permission in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrLoc(newLocation);
      setSelectedLocation(newLocation);
      setError(null);

      try {
        const [address] = await Location.reverseGeocodeAsync(newLocation);
        if (address) {
          const addressString = [
            address.street,
            address.city,
            address.region,
            address.postalCode
          ].filter(Boolean).join(', ') || 'Current Location';
          setQLocation(addressString);
        }
      } catch (geocodeError) {
        console.log('Reverse geocode error:', geocodeError);
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
      setError('Unable to get current location');
      Alert.alert('Location Error', 'Unable to get your current location. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initLocation = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        
        if (status === 'granted') {
          getCurrentLocation();
        } else {
          const defaultLocation = {
            latitude: 20.5937, // India coordinates
            longitude: 78.9629,
          };
          setSelectedLocation(defaultLocation);
          setQLocation('India');
          
          // Animate to default location
          setTimeout(() => {
            if (mapRef.current) {
              const region: Region = {
                ...defaultLocation,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              };
              mapRef.current.animateToRegion(region, 1000);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Permission check error:', err);
      }
    };

    initLocation();
  }, [getCurrentLocation]);

  // FIXED: Search location function
  const searchLocation = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.length > 0) {
        const firstResult = data[0];
        const newLocation = {
          latitude: parseFloat(firstResult.lat),
          longitude: parseFloat(firstResult.lon),
        };

        setSelectedLocation(newLocation);
        setQLocation(firstResult.display_name);
        setError(null);

        // FIXED: Proper region animation
        if (mapRef.current) {
          const region: Region = {
            ...newLocation,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          mapRef.current.animateToRegion(region, 1000);
        }
      } else {
        Alert.alert('Location not found', 'Try another search term');
      }
    } catch (err) {
      console.error('Search error:', err);
      Alert.alert('Error', 'Failed to search location');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Map press handler
  const handleMapPress = useCallback(async (event: any) => {
    if (event?.nativeEvent?.coordinate) {
      const newLocation = event.nativeEvent.coordinate;
      setSelectedLocation(newLocation);
      
      setLoading(true);
      try {
        const [address] = await Location.reverseGeocodeAsync(newLocation);
        if (address) {
          const addressString = [
            address.street,
            address.city,
            address.region,
            address.postalCode
          ].filter(Boolean).join(', ') || 'Selected Location';
          setQLocation(addressString);
        } else {
          setQLocation('Selected Location');
        }
      } catch (err) {
        console.error('Reverse geocode error:', err);
        setQLocation('Selected Location');
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // FIXED: Map ready handler
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const handleContinue = () => {
    if (selectedLocation) {
      router.push({
        pathname: '/ParkingSlot',
        params: { 
          latitude: selectedLocation.latitude.toString(),
          longitude: selectedLocation.longitude.toString(),
          address: qLocation,
        }
      });
    } else {
      Alert.alert('No Location Selected', 'Please select a location first');
    }
  };

  const renderMap = () => {
    // For web, show placeholder
    if (Platform.OS === 'web') {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>
            Google Maps not available on web
          </Text>
          <Text style={styles.placeholderSubtext}>
            Select a location to continue
          </Text>
        </View>
      );
    }

    // FIXED: Proper initial region handling
    const initialRegion = selectedLocation || currLoc || {
      latitude: 20.5937,
      longitude: 78.9629,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onMapReady={handleMapReady} // Added onMapReady
        showsUserLocation={!!currLoc}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        zoomControlEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title={qLocation || 'Selected Location'}
            description="This location will be used to find parking"
            pinColor={colors.primary}
          />
        )}
      </MapView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <CustomBackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Find Parking</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.mapContainer}>
          {renderMap()}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Finding location...</Text>
            </View>
          )}
        </View>

        <View style={styles.locationSection}>
          <Text style={styles.locationTitle}>Location</Text>
          
          <View style={styles.locationInputContainer}>
            <Image source={images.location} style={styles.locationIcon} />
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
              onPress={getCurrentLocation} 
              disabled={loading}
              style={styles.currentLocationButton}
            >
              <Image
                source={images.gps}
                style={{ 
                  width: 24, 
                  height: 24, 
                  opacity: loading ? 0.5 : 1 
                }}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={getCurrentLocation} 
            disabled={loading}
            style={styles.useCurrentLocationButton}
          >
            <Text style={[styles.useCurrentLocation, loading && styles.disabledText]}>
              Use Current Location
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.applyButton,
                (!qLocation.trim() || loading) && styles.disabledButton
              ]}
              onPress={() => searchLocation(qLocation)}
              disabled={!qLocation.trim() || loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Searching...' : 'Search'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.continueButton,
                (!selectedLocation || loading) && styles.disabledButton
              ]}
              onPress={handleContinue}
              disabled={!selectedLocation || loading}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.4,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  locationSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  locationIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    tintColor: colors.primary,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primary,
    padding: 0,
  },
  currentLocationButton: {
    padding: 4,
  },
  useCurrentLocationButton: {
    marginBottom: 16,
  },
  useCurrentLocation: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  disabledText: {
    opacity: 0.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButton: {
    backgroundColor: colors.black,
  },
  continueButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default FindParking;