import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  KeyboardAvoidingView,
} from "react-native";
import { IconButton } from "react-native-paper";
import colors from "../../assets/color";
import BottomButtons from "../../components/Parking/BottomButtons";
import ParkingSpotCard from "../../components/Parking/ParkingSpotCard";
import VehicleTypeSelector from "../../components/Parking/VehicleTypeSelector";

import {
  AxiosResponse,
  GarageMerchantDetails,
  ParkingLot,
  Residence,
} from "../../types";

import * as Location from "expo-location";
import axiosInstance from "../../api/axios";

import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const { height, width } = Dimensions.get("window");

// Responsive dimensions
const isSmallScreen = height < 700;
const MAP_HEIGHT = isSmallScreen ? 250 : 300;
const HEADER_HEIGHT = Platform.OS === "ios" ? 60 : 60;
const BOTTOM_BUTTON_HEIGHT = 80;

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

const ParkingSpot = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse location from params - memoized
  const location = useMemo(() => {
    try {
      if (params.location) {
        const locationStr = Array.isArray(params.location)
          ? params.location[0]
          : params.location;
        return JSON.parse(locationStr) as LocationData;
      }
      return null;
    } catch (error) {
      console.error("Error parsing location:", error);
      return null;
    }
  }, [params.location]);

  const endTime = params.endTime as string;
  const startTime = params.startTime as string | undefined;

  console.log("ParkingSpot - Received params:", {
    location,
    endTime,
    startTime,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<"car" | "bike">("car");
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<
    | { lot: ParkingLot; type: "L" }
    | { lot: GarageMerchantDetails; type: "G" }
    | { lot: Residence; type: "R" }
    | null
  >(null);

  const [parkingResult, setParkingResult] = useState<ParkingLot[]>([]);
  const [garageResult, setGarageResult] = useState<GarageMerchantDetails[]>([]);
  const [residenceResult, setResidenceResult] = useState<Residence[]>([]);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [hasFetchedData, setHasFetchedData] = useState(false);

  const [expandedSection, setExpandedSection] = useState<
    "garage" | "lot" | "residence" | null
  >("garage");

  const mapRef = useRef<MapView>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get current location - only once
  useEffect(() => {
    let isMounted = true;

    const getCurrentLocation = async () => {
      if (!location) return;

      try {
        setLocationLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          console.log("Location permission denied");
          if (isMounted) {
            setCurrentLocation(location);
            setLocationLoading(false);
          }
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          setCurrentLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLocationLoading(false);
        }
      } catch (err) {
        console.log("Location error:", err);
        if (isMounted) {
          setCurrentLocation(location);
          setLocationLoading(false);
        }
      }
    };

    getCurrentLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch parking data - optimized with cleanup and timeout
  useEffect(() => {
    if (!location || hasFetchedData || loading) {
      return;
    }

    console.log("Fetching parking data for location:", location);

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      const fetchData = async () => {
        let isMounted = true;

        try {
          setLoading(true);

          const paramsReq = {
            latitude: location.latitude,
            longitude: location.longitude,
            startTime: startTime ? startTime : new Date().toISOString(),
            endTime: endTime,
          };

          console.log("API request params:", paramsReq);

          const [garageRes, parkingRes, residenceRes] = await Promise.all([
            axiosInstance
              .get<AxiosResponse<GarageMerchantDetails[]>>(
                "/merchants/garage/search",
                {
                  params: paramsReq,
                  timeout: 10000,
                }
              )
              .catch((err) => {
                console.log("Garage API error:", err.message);
                return { data: { data: [] } };
              }),
            axiosInstance
              .get<AxiosResponse<ParkingLot[]>>(
                "/merchants/parkinglot/search",
                {
                  params: paramsReq,
                  timeout: 10000,
                }
              )
              .catch((err) => {
                console.log("Parking lot API error:", err.message);
                return { data: { data: [] } };
              }),
            axiosInstance
              .get<AxiosResponse<Residence[]>>("/merchants/residence/search", {
                params: paramsReq,
                timeout: 10000,
              })
              .catch((err) => {
                console.log("Residence API error:", err.message);
                return { data: { data: [] } };
              }),
          ]);

          if (isMounted) {
            setGarageResult(garageRes.data?.data || []);
            setParkingResult(parkingRes.data?.data || []);
            setResidenceResult(residenceRes.data?.data || []);
            setHasFetchedData(true);

            console.log(
              "Fetched data - Garages:",
              garageRes.data?.data?.length || 0
            );
            console.log(
              "Fetched data - Parking Lots:",
              parkingRes.data?.data?.length || 0
            );
            console.log(
              "Fetched data - Residences:",
              residenceRes.data?.data?.length || 0
            );
          }
        } catch (error: any) {
          console.log("Parking fetch failed:", error);
          if (isMounted) {
            Alert.alert(
              "Error",
              "Could not load parking spots. Please try again."
            );
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchData();
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [location, endTime, startTime, hasFetchedData, loading]);

  // Reset data when location changes
  useEffect(() => {
    if (location && !hasFetchedData) {
      setGarageResult([]);
      setParkingResult([]);
      setResidenceResult([]);
      setSelectedSpot(null);
      setSelectedLot(null);
    }
  }, [location, hasFetchedData]);

  // Filter based on vehicle type - memoized
  const filteredGarages = useMemo(
    () =>
      garageResult.filter(
        (g) => g.vehicleType === selectedVehicle || g.vehicleType === "both"
      ),
    [garageResult, selectedVehicle]
  );

  const filteredParkingLots = useMemo(
    () =>
      parkingResult.filter(
        (p) => p.vehicleType === selectedVehicle || p.vehicleType === "both"
      ),
    [parkingResult, selectedVehicle]
  );

  const filteredResidences = useMemo(
    () =>
      residenceResult.filter(
        (r) => r.vehicleType === selectedVehicle || r.vehicleType === "both"
      ),
    [residenceResult, selectedVehicle]
  );

  // Handle vehicle change
  const handleVehicleChange = useCallback((vehicle: "car" | "bike") => {
    setSelectedVehicle(vehicle);
    setSelectedSpot(null);
    setSelectedLot(null);
  }, []);

  // Handle spot selection
  const handleSpotSelect = useCallback(
    (
      id: string,
      lot: ParkingLot | GarageMerchantDetails | Residence,
      type: "G" | "L" | "R"
    ) => {
      setSelectedSpot(id);
      if (type === "G") {
        setSelectedLot({ lot: lot as GarageMerchantDetails, type: "G" });
      } else if (type === "L") {
        setSelectedLot({ lot: lot as ParkingLot, type: "L" });
      } else {
        setSelectedLot({ lot: lot as Residence, type: "R" });
      }
    },
    []
  );

  // Render map - memoized
  const renderMap = useCallback(() => {
    if (locationLoading || !location) {
      return (
        <View style={[styles.mapPlaceholder, { height: MAP_HEIGHT }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.primary }}>
            Loading map...
          </Text>
        </View>
      );
    }

    const mapCenter = currentLocation || location;
    const allLocations = [
      ...filteredGarages.map((i) => ({
        ...i,
        pType: "G" as const,
        name: i.garageName,
        gpsLocation: i.location,
      })),
      ...filteredParkingLots.map((i) => ({
        ...i,
        pType: "L" as const,
        name: i.parkingName,
        gpsLocation: i.location,
      })),
      ...filteredResidences.map((i) => ({
        ...i,
        pType: "R" as const,
        name: i.residenceName,
        gpsLocation: i.location,
      })),
    ];

    return (
      <MapView
        ref={mapRef}
        style={[styles.map, { height: MAP_HEIGHT }]}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={!!currentLocation}
        showsMyLocationButton={true}
      >
        {/* Selected location marker */}
        <Marker
          coordinate={location}
          title="Selected Location"
          pinColor={colors.primary}
        />

        {/* All parking markers */}
        {allLocations.map((item) => {
          if (!item.gpsLocation?.coordinates) return null;

          const [longitude, latitude] = item.gpsLocation.coordinates;
          return (
            <Marker
              key={`${item.pType}-${item._id}`}
              coordinate={{ latitude, longitude }}
              title={item.name}
              pinColor={selectedSpot === item._id ? "red" : colors.secondary}
              onPress={() => {
                handleSpotSelect(item._id, item as any, item.pType);
              }}
            />
          );
        })}
      </MapView>
    );
  }, [
    location,
    currentLocation,
    locationLoading,
    filteredGarages,
    filteredParkingLots,
    filteredResidences,
    selectedSpot,
    handleSpotSelect,
  ]);

  // Toggle section
  const toggleSection = useCallback(
    (section: "garage" | "lot" | "residence") => {
      setExpandedSection((prev) => (prev === section ? null : section));
    },
    []
  );

  // Handle retry fetch
  const handleRetryFetch = useCallback(() => {
    setHasFetchedData(false);
    setGarageResult([]);
    setParkingResult([]);
    setResidenceResult([]);
    setSelectedSpot(null);
    setSelectedLot(null);
  }, []);

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No location selected</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalResults =
    filteredGarages.length +
    filteredParkingLots.length +
    filteredResidences.length;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconButton icon="arrow-left" size={30} iconColor={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Parking</Text>
          <TouchableOpacity onPress={handleRetryFetch} disabled={loading}>
            <IconButton
              icon="refresh"
              size={24}
              iconColor={loading ? "#CCC" : colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* MAP */}
        {renderMap()}

        {/* LOADING OVERLAY */}
        {(loading || locationLoading) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {loading ? "Loading parking spots..." : "Getting your location..."}
            </Text>
          </View>
        )}

        {/* PARKING LIST */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            selectedSpot && { paddingBottom: BOTTOM_BUTTON_HEIGHT + 20 }
          ]}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {totalResults} parking spots found
              </Text>
              {hasFetchedData && !loading && (
                <TouchableOpacity onPress={handleRetryFetch}>
                  <Text style={styles.retryText}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>

            <VehicleTypeSelector
              selectedVehicle={selectedVehicle}
              onSelectVehicle={handleVehicleChange}
            />

            {/* Garage Section */}
            {filteredGarages.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("garage")}
                >
                  <Text style={styles.sectionTitle}>
                    Garages ({filteredGarages.length})
                  </Text>
                  <IconButton
                    icon={
                      expandedSection === "garage" ? "chevron-up" : "chevron-down"
                    }
                    size={24}
                    iconColor="#FFF"
                  />
                </TouchableOpacity>

                {expandedSection === "garage" &&
                  filteredGarages.map((item) => (
                    <ParkingSpotCard
                      key={item._id}
                      type="G"
                      id={item._id}
                      title={item.garageName}
                      address={item.address}
                      duration="5 min"
                      rating="4.2"
                      price={item.price.toString()}
                      selected={selectedSpot === item._id}
                      onSelect={() => handleSpotSelect(item._id, item, "G")}
                    />
                  ))}
              </>
            )}

            {/* Parking Lot Section */}
            {filteredParkingLots.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("lot")}
                >
                  <Text style={styles.sectionTitle}>
                    Parking Lots ({filteredParkingLots.length})
                  </Text>
                  <IconButton
                    icon={
                      expandedSection === "lot" ? "chevron-up" : "chevron-down"
                    }
                    size={24}
                    iconColor="#FFF"
                  />
                </TouchableOpacity>

                {expandedSection === "lot" &&
                  filteredParkingLots.map((item) => (
                    <ParkingSpotCard
                      key={item._id}
                      type="L"
                      id={item._id}
                      title={item.parkingName}
                      address={item.address}
                      duration="5 min"
                      rating="4.2"
                      price={item.price.toString()}
                      selected={selectedSpot === item._id}
                      onSelect={() => handleSpotSelect(item._id, item, "L")}
                    />
                  ))}
              </>
            )}

            {/* Residence Section */}
            {filteredResidences.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("residence")}
                >
                  <Text style={styles.sectionTitle}>
                    Residences ({filteredResidences.length})
                  </Text>
                  <IconButton
                    icon={
                      expandedSection === "residence"
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={24}
                    iconColor="#FFF"
                  />
                </TouchableOpacity>

                {expandedSection === "residence" &&
                  filteredResidences.map((item) => (
                    <ParkingSpotCard
                      key={item._id}
                      type="R"
                      id={item._id}
                      title={item.residenceName}
                      address={item.address}
                      duration="5 min"
                      rating="4.0"
                      price={item.price.toString()}
                      selected={selectedSpot === item._id}
                      onSelect={() => handleSpotSelect(item._id, item, "R")}
                    />
                  ))}
              </>
            )}

            {/* No Results */}
            {hasFetchedData && !loading && totalResults === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsTitle}>No parking spots found</Text>
                <Text style={styles.noResultsText}>
                  Try adjusting your search criteria or select a different
                  location.
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryFetch}
                >
                  <Text style={styles.retryButtonText}>Search Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Buttons - Fixed at bottom */}
        {selectedSpot && (
          <View style={styles.bottomButtonContainer}>
            <BottomButtons
              onViewDetails={() =>
                selectedLot &&
                router.push({
                  pathname: "/parkingUser/GarageScreen",
                  params: {
                    lot: JSON.stringify(selectedLot.lot),
                    type: selectedLot.type,
                    endTime,
                  },
                })
              }
              onFindParking={() => {
                if (!selectedLot) return;

                if (selectedLot.type !== "R") {
                  router.push({
                    pathname: "/parkingUser/ParkingSpace",
                    params: {
                      lot: JSON.stringify(selectedLot.lot),
                      type: selectedLot.type,
                      endTime,
                    },
                  });
                } else {
                  router.push({
                    pathname: "parkingUser/Confirmation",
                    params: {
                      lot: JSON.stringify(selectedLot.lot),
                      type: "R",
                      endTime,
                    },
                  });
                }
              }}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
  },

  errorText: {
    fontSize: 18,
    color: colors.primary,
    marginBottom: 20,
    textAlign: "center",
  },

  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },

  backButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: HEADER_HEIGHT,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.primary,
  },

  map: {
    width: "100%",
  },

  mapPlaceholder: {
    width: "100%",
    backgroundColor: "#F3F3F3",
    justifyContent: "center",
    alignItems: "center",
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    minHeight: height - MAP_HEIGHT - HEADER_HEIGHT - 100,
  },

  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  resultsCount: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },

  retryText: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: "underline",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: colors.brandColor,
    borderRadius: 12,
    marginTop: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#FFF",
  },

  noResultsContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },

  noResultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 8,
  },

  noResultsText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },

  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.primary,
    fontWeight: "500",
  },

  bottomButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default ParkingSpot;