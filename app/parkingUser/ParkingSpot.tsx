import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { IconButton } from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import VehicleTypeSelector from "../../components/Parking/VehicleTypeSelector";
import ParkingSpotCard from "../../components/Parking/ParkingSpotCard";
import BottomButtons from "../../components/Parking/BottomButtons";
import colors from "../../assets/color";

import {
  ParkingLot,
  GarageMerchantDetails,
  Residence,
  AxiosResponse,
} from "../../types";

import axiosInstance from "../../api/axios";
import * as Location from "expo-location";

import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const ParkingSpot = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const location = params.location
    ? JSON.parse(params.location as string)
    : null;

  const endTime = params.endTime as string;
  const startTime = params.startTime as string | undefined;

  const [selectedVehicle, setSelectedVehicle] =
    useState<"car" | "bike">("car");

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
  const [routeLoading, setRouteLoading] = useState(false);

  const [showAllGarages, setShowAllGarages] = useState(false);
  const [showAllLots, setShowAllLots] = useState(false);
  const [showAllResidences, setShowAllResidences] = useState(false);

  const mapRef = useRef<MapView>(null);

  const [expandedSection, setExpandedSection] = useState<
    "garage" | "lot" | "residence" | null
  >("garage");

  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        setCurrentLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch (err) {
        console.log("Location error:", err);
      }
    })();
  }, []);

  /* ------------------------------------------------
      FETCH PARKING LIST
  ------------------------------------------------ */
  useEffect(() => {
    if (!location) return;

    setLoading(true);

    const fetchData = async () => {
      try {
        const paramsReq = {
          latitude: location.latitude,
          longitude: location.longitude,
          startTime: startTime ? startTime : new Date().toISOString(),
          endTime: endTime,
        };

        const [garageRes, parkingRes, residenceRes] = await Promise.all([
          axiosInstance.get<AxiosResponse<GarageMerchantDetails[]>>(
            "/merchants/garage/search",
            { params: paramsReq }
          ),
          axiosInstance.get<AxiosResponse<ParkingLot[]>>(
            "/merchants/parkinglot/search",
            { params: paramsReq }
          ),
          axiosInstance.get<AxiosResponse<Residence[]>>(
            "/merchants/residence/search",
            { params: paramsReq }
          ),
        ]);

        if (Array.isArray(garageRes.data?.data))
          setGarageResult(garageRes.data.data);

        if (Array.isArray(parkingRes.data?.data))
          setParkingResult(parkingRes.data.data);

        if (Array.isArray(residenceRes.data?.data))
          setResidenceResult(residenceRes.data.data);
      } catch (error) {
        console.log("Parking fetch failed:", error);
        Alert.alert("Error", "Could not load parking spots.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location, endTime, startTime]);

  /* ------------------------------------------------
      FILTER BASED ON VEHICLE TYPE
  ------------------------------------------------ */
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

  /* ------------------------------------------------
      MAP RENDER
  ------------------------------------------------ */
  const renderMap = () => {
    if (!location || !currentLocation) {
      return (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10 }}>Loading map...</Text>
        </View>
      );
    }

    const allLocations = [
      ...filteredGarages.map((i) => ({
        ...i,
        pType: "G",
        name: i.garageName,
        gpsLocation: i.location,
      })),
      ...filteredParkingLots.map((i) => ({
        ...i,
        pType: "L",
        name: i.parkingName,
      })),
      ...filteredResidences.map((i) => ({
        ...i,
        pType: "R",
        name: i.residenceName,
      })),
    ];

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.09,
          longitudeDelta: 0.04,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Selected location marker */}
        <Marker
          coordinate={location}
          title="Selected Location"
          pinColor={colors.primary}
        />

        {/* All parking markers */}
        {allLocations.map((item) => {
          const coords = item?.gpsLocation?.coordinates;
          if (!coords) return null;

          return (
            <Marker
              key={`${item.pType}-${item._id}`}
              coordinate={{ latitude: coords[1], longitude: coords[0] }}
              title={item.name}
              pinColor={selectedSpot === item._id ? "red" : colors.secondary}
              onPress={() => {
                setSelectedSpot(item._id);
                setSelectedLot({ lot: item as any, type: item.pType as any });
              }}
            />
          );
        })}
      </MapView>
    );
  };

  /* ------------------------------------------------
      SECTION TOGGLE
  ------------------------------------------------ */
  const toggleSection = (section: "garage" | "lot" | "residence") => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconButton icon="arrow-left" size={30} iconColor={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Parking</Text>
      </View>

      {/* MAP */}
      {renderMap()}

      {(loading || routeLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* LIST */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.bottomSheet}>
          <VehicleTypeSelector
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
          />

          {/* Garage Section */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("garage")}
          >
            <Text style={styles.sectionTitle}>
              Garages ({filteredGarages.length})
            </Text>
            <IconButton
              icon={expandedSection === "garage" ? "chevron-up" : "chevron-down"}
              size={24}
              iconColor="#FFF"
            />
          </TouchableOpacity>

          {expandedSection === "garage" &&
            filteredGarages
              .slice(0, showAllGarages ? filteredGarages.length : 2)
              .map((item) => (
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
                  onSelect={() => {
                    setSelectedSpot(item._id);
                    setSelectedLot({ lot: item, type: "G" });
                  }}
                />
              ))}

          {/* Parking Lot Section */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("lot")}
          >
            <Text style={styles.sectionTitle}>
              Parking Lots ({filteredParkingLots.length})
            </Text>
            <IconButton
              icon={expandedSection === "lot" ? "chevron-up" : "chevron-down"}
              size={24}
              iconColor="#FFF"
            />
          </TouchableOpacity>

          {expandedSection === "lot" &&
            filteredParkingLots
              .slice(0, showAllLots ? filteredParkingLots.length : 2)
              .map((item) => (
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
                  onSelect={() => {
                    setSelectedSpot(item._id);
                    setSelectedLot({ lot: item, type: "L" });
                  }}
                />
              ))}

          {/* Residence Section */}
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
            filteredResidences
              .slice(0, showAllResidences ? filteredResidences.length : 2)
              .map((item) => (
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
                  onSelect={() => {
                    setSelectedSpot(item._id);
                    setSelectedLot({ lot: item, type: "R" });
                  }}
                />
              ))}
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      {selectedSpot && (
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
                pathname: "/ParkingSpace",
                params: {
                  lot: JSON.stringify(selectedLot.lot),
                  type: selectedLot.type,
                  endTime,
                },
              });
            } else {
              router.push({
                pathname: "/Confirmation",
                params: {
                  lot: JSON.stringify(selectedLot.lot),
                  type: "R",
                  endTime,
                },
              });
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },

  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.5)",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: "#000",
    marginLeft: 10,
  },

  map: {
    width: "100%",
    height: 300,
  },

  mapPlaceholder: {
    width: "100%",
    height: 300,
    backgroundColor: "#F3F3F3",
    justifyContent: "center",
    alignItems: "center",
  },

  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: Dimensions.get("window").height * 0.4,
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

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});

export default ParkingSpot;
