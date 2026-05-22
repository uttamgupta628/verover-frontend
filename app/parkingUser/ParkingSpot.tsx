import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

const isSmallScreen = height < 700;
const MAP_HEIGHT = isSmallScreen ? 250 : 300;
const HEADER_HEIGHT = Platform.OS === "ios" ? 60 : 60;
const BOTTOM_BUTTON_HEIGHT = 80;
const BOTTOM_BUTTON_MARGIN = 25;

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

interface DailySlotMeta {
  id: string;
  label: string;
  fromTime: string;
  toTime: string;
}

// ── Daily rate enablement map: venueId → boolean ──────────────────────────────
// true  = venue has daily rates enabled
// false = venue has daily rates disabled / fetch failed
type DailyEnabledMap = Record<string, boolean>;

function venueTypeStr(type: "G" | "L" | "R") {
  if (type === "G") return "garage";
  if (type === "L") return "parking";
  return "residence";
}

const ParkingSpot = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ── Parse location ────────────────────────────────────────────────────────
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

  const endTime   = params.endTime  as string;
  const startTime = params.startTime as string | undefined;

  // ── FIX: stable bookingFrom (now) captured once at mount ─────────────────
  const bookingFromISO = useMemo(() => new Date().toISOString(), []);

  // ── Daily params ──────────────────────────────────────────────────────────
  const isDaily         = params.isDaily === "true";
  const dailyDate       = Array.isArray(params.dailyDate)       ? params.dailyDate[0]       : params.dailyDate       as string | undefined;
  const selectedSlotIds = Array.isArray(params.selectedSlotIds) ? params.selectedSlotIds[0] : params.selectedSlotIds as string | undefined;
  const dailySlotsMeta  = Array.isArray(params.dailySlotsMeta)  ? params.dailySlotsMeta[0]  : params.dailySlotsMeta  as string | undefined;

  // ── Parse dailySlotsMeta into typed array ─────────────────────────────────
  const parsedDailySlots: DailySlotMeta[] = useMemo(() => {
    if (!dailySlotsMeta) return [];
    try {
      return JSON.parse(dailySlotsMeta) as DailySlotMeta[];
    } catch {
      return [];
    }
  }, [dailySlotsMeta]);

  // ── Monthly params ────────────────────────────────────────────────────────
  const isMonthly = params.isMonthly as string | undefined;
  const months    = params.months    as string | undefined;

  const [selectedVehicle, setSelectedVehicle] = useState<"car" | "bike">("car");
  const [selectedSpot,    setSelectedSpot]    = useState<string | null>(null);
  const [selectedLot,     setSelectedLot]     = useState<
    | { lot: ParkingLot;            type: "L" }
    | { lot: GarageMerchantDetails; type: "G" }
    | { lot: Residence;             type: "R" }
    | null
  >(null);

  const [parkingResult,   setParkingResult]   = useState<ParkingLot[]>([]);
  const [garageResult,    setGarageResult]    = useState<GarageMerchantDetails[]>([]);
  const [residenceResult, setResidenceResult] = useState<Residence[]>([]);

  // ── Daily rate enablement map ─────────────────────────────────────────────
  const [dailyEnabledMap,     setDailyEnabledMap]     = useState<DailyEnabledMap>({});
  const [dailyEnabledLoading, setDailyEnabledLoading] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [loading,         setLoading]         = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [hasFetchedData,  setHasFetchedData]  = useState(false);

  const [expandedSection, setExpandedSection] = useState<
    "garage" | "lot" | "residence" | null
  >("garage");

  const mapRef          = useRef<MapView>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef   = useRef<ScrollView>(null);

  // ── Get current location (once) ───────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const getCurrentLocation = async () => {
      if (!location) return;
      try {
        setLocationLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (isMounted) { setCurrentLocation(location); setLocationLoading(false); }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMounted) {
          setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setLocationLoading(false);
        }
      } catch {
        if (isMounted) { setCurrentLocation(location); setLocationLoading(false); }
      }
    };
    getCurrentLocation();
    return () => { isMounted = false; };
  }, []);

  // ── Fetch parking data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!location || hasFetchedData || loading) return;

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    fetchTimeoutRef.current = setTimeout(() => {
      const fetchData = async () => {
        let isMounted = true;
        try {
          setLoading(true);
          const paramsReq = {
            latitude:  location.latitude,
            longitude: location.longitude,
            startTime: startTime ? startTime : new Date().toISOString(),
            endTime,
          };

          const [garageRes, parkingRes, residenceRes] = await Promise.all([
            axiosInstance.get<AxiosResponse<GarageMerchantDetails[]>>("/merchants/garage/search",    { params: paramsReq, timeout: 10000 }).catch(() => ({ data: { data: [] } })),
            axiosInstance.get<AxiosResponse<ParkingLot[]>>           ("/merchants/parkinglot/search", { params: paramsReq, timeout: 10000 }).catch(() => ({ data: { data: [] } })),
            axiosInstance.get<AxiosResponse<Residence[]>>            ("/merchants/residence/search",  { params: paramsReq, timeout: 10000 }).catch(() => ({ data: { data: [] } })),
          ]);

          if (isMounted) {
            setGarageResult(garageRes.data?.data   || []);
            setParkingResult(parkingRes.data?.data  || []);
            setResidenceResult(residenceRes.data?.data || []);
            setHasFetchedData(true);
          }
        } catch {
          if (isMounted) Alert.alert("Error", "Could not load parking spots. Please try again.");
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      fetchData();
    }, 500);

    return () => { if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); };
  }, [location, endTime, startTime, hasFetchedData, loading]);

  // ── Fetch daily rate enablement for all venues (only in daily mode) ───────
  //
  // Once venue lists are loaded and we're in daily mode, fire one request per
  // venue to /merchants/daily-rate-settings/:type/:id and store the result in
  // dailyEnabledMap.  We use Promise.allSettled so a single failure never
  // blocks the rest of the list from rendering.
  useEffect(() => {
    if (!isDaily || !hasFetchedData) return;

    const allVenues: { id: string; venueType: string }[] = [
      ...garageResult.map((g) => ({ id: g._id, venueType: "garage" })),
      ...parkingResult.map((p) => ({ id: p._id, venueType: "parking" })),
      ...residenceResult.map((r) => ({ id: r._id, venueType: "residence" })),
    ];

    if (allVenues.length === 0) return;

    let cancelled = false;
    setDailyEnabledLoading(true);

    Promise.allSettled(
      allVenues.map(({ id, venueType }) =>
        axiosInstance
          .get(`/merchants/daily-rate-settings/${venueType}/${id}`)
          .then((res) => ({
            id,
            enabled: res.data?.data?.dailyRateEnabled === true,
          }))
          .catch(() => ({ id, enabled: false }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map: DailyEnabledMap = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map[r.value.id] = r.value.enabled;
        }
      });
      setDailyEnabledMap(map);
      setDailyEnabledLoading(false);
    });

    return () => { cancelled = true; };
  }, [isDaily, hasFetchedData, garageResult, parkingResult, residenceResult]);

  // ── Reset on location change ──────────────────────────────────────────────
  useEffect(() => {
    if (location && !hasFetchedData) {
      setGarageResult([]); setParkingResult([]); setResidenceResult([]);
      setSelectedSpot(null); setSelectedLot(null);
      setDailyEnabledMap({});
    }
  }, [location, hasFetchedData]);

  // ── Filter by vehicle type ────────────────────────────────────────────────
  const vehicleFilteredGarages     = useMemo(() => garageResult.filter((g)    => g.vehicleType === selectedVehicle || g.vehicleType === "both"), [garageResult,    selectedVehicle]);
  const vehicleFilteredParkingLots = useMemo(() => parkingResult.filter((p)   => p.vehicleType === selectedVehicle || p.vehicleType === "both"), [parkingResult,   selectedVehicle]);
  const vehicleFilteredResidences  = useMemo(() => residenceResult.filter((r) => r.vehicleType === selectedVehicle || r.vehicleType === "both"), [residenceResult, selectedVehicle]);

  // ── Filter by monthly plan (only when isMonthly) ──────────────────────────
  // ── Filter by daily plan   (only when isDaily)   ──────────────────────────
  const filteredGarages = useMemo(() => {
    if (isMonthly === "true") return vehicleFilteredGarages.filter((g) => g.monthlyRate && g.monthlyRate > 0);
    if (isDaily)              return vehicleFilteredGarages.filter((g) => dailyEnabledMap[g._id] === true);
    return vehicleFilteredGarages;
  }, [vehicleFilteredGarages, isMonthly, isDaily, dailyEnabledMap]);

  const filteredParkingLots = useMemo(() => {
    if (isMonthly === "true") return vehicleFilteredParkingLots.filter((p) => p.monthlyRate && p.monthlyRate > 0);
    if (isDaily)              return vehicleFilteredParkingLots.filter((p) => dailyEnabledMap[p._id] === true);
    return vehicleFilteredParkingLots;
  }, [vehicleFilteredParkingLots, isMonthly, isDaily, dailyEnabledMap]);

  const filteredResidences = useMemo(() => {
    if (isMonthly === "true") return vehicleFilteredResidences.filter((r) => r.monthlyRate && r.monthlyRate > 0);
    if (isDaily)              return vehicleFilteredResidences.filter((r) => dailyEnabledMap[r._id] === true);
    return vehicleFilteredResidences;
  }, [vehicleFilteredResidences, isMonthly, isDaily, dailyEnabledMap]);

  const handleVehicleChange = useCallback((vehicle: "car" | "bike") => {
    setSelectedVehicle(vehicle); setSelectedSpot(null); setSelectedLot(null);
  }, []);

  const handleSpotSelect = useCallback(
    (id: string, lot: ParkingLot | GarageMerchantDetails | Residence, type: "G" | "L" | "R") => {
      setSelectedSpot(id);
      if      (type === "G") setSelectedLot({ lot: lot as GarageMerchantDetails, type: "G" });
      else if (type === "L") setSelectedLot({ lot: lot as ParkingLot,            type: "L" });
      else                   setSelectedLot({ lot: lot as Residence,             type: "R" });
    },
    []
  );

  // ── Common daily params object (forwarded to every route) ─────────────────
  const dailyForwardParams = {
    isDaily: isDaily ? "true" : "false",
    dailyDate,
    selectedSlotIds,
    dailySlotsMeta,
  };

  // ── Map render ────────────────────────────────────────────────────────────
  const renderMap = useCallback(() => {
    if (locationLoading || !location) {
      return (
        <View style={[styles.mapPlaceholder, { height: MAP_HEIGHT }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.primary }}>Loading map...</Text>
        </View>
      );
    }

    const mapCenter = currentLocation || location;
    const allLocations = [
      ...filteredGarages.map((i)     => ({ ...i, pType: "G" as const, name: i.garageName,    gpsLocation: i.location })),
      ...filteredParkingLots.map((i) => ({ ...i, pType: "L" as const, name: i.parkingName,   gpsLocation: i.location })),
      ...filteredResidences.map((i)  => ({ ...i, pType: "R" as const, name: i.residenceName, gpsLocation: i.location })),
    ];

    return (
      <MapView
        ref={mapRef}
        style={[styles.map, { height: MAP_HEIGHT }]}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: mapCenter.latitude, longitude: mapCenter.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation={!!currentLocation}
        showsMyLocationButton
      >
        <Marker coordinate={location} title="Selected Location" pinColor={colors.primary} />
        {allLocations.map((item) => {
          if (!item.gpsLocation?.coordinates) return null;
          const [longitude, latitude] = item.gpsLocation.coordinates;
          return (
            <Marker
              key={`${item.pType}-${item._id}`}
              coordinate={{ latitude, longitude }}
              title={item.name}
              pinColor={selectedSpot === item._id ? "red" : colors.secondary}
              onPress={() => handleSpotSelect(item._id, item as any, item.pType)}
            />
          );
        })}
      </MapView>
    );
  }, [location, currentLocation, locationLoading, filteredGarages, filteredParkingLots, filteredResidences, selectedSpot, handleSpotSelect]);

  const toggleSection = useCallback((section: "garage" | "lot" | "residence") => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);

  const handleRetryFetch = useCallback(() => {
    setHasFetchedData(false);
    setGarageResult([]); setParkingResult([]); setResidenceResult([]);
    setSelectedSpot(null); setSelectedLot(null);
    setDailyEnabledMap({});
  }, []);

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No location selected</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalResults = filteredGarages.length + filteredParkingLots.length + filteredResidences.length;

  // How many venues in each section still exist before daily/monthly filter,
  // used to show "X not available" hints in the section header.
  const rawGarageCount     = vehicleFilteredGarages.length;
  const rawLotCount        = vehicleFilteredParkingLots.length;
  const rawResidenceCount  = vehicleFilteredResidences.length;

  const hiddenGarages    = rawGarageCount    - filteredGarages.length;
  const hiddenLots       = rawLotCount       - filteredParkingLots.length;
  const hiddenResidences = rawResidenceCount - filteredResidences.length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconButton icon="arrow-left" size={30} iconColor={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Parking</Text>
          <TouchableOpacity onPress={handleRetryFetch} disabled={loading}>
            <IconButton icon="refresh" size={24} iconColor={loading ? "#CCC" : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Daily mode info banner ──────────────────────────────────────── */}
        {isDaily && parsedDailySlots.length > 0 && (
          <View style={styles.dailyBanner}>
            <View style={styles.dailyBannerRow}>
              <Text style={styles.dailyBannerTitle}>
                📆 Daily Booking
                {dailyDate
                  ? ` · ${new Date(dailyDate).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}`
                  : ""}
              </Text>
            </View>
            <View style={styles.dailyChipsRow}>
              {parsedDailySlots.map((slot) => (
                <View key={slot.id} style={styles.dailyChip}>
                  <Text style={styles.dailyChipText}>
                    {slot.id === "morning"
                      ? "🌅"
                      : slot.id === "afternoon"
                      ? "☀️"
                      : slot.id === "evening"
                      ? "🌆"
                      : "🌙"}{" "}
                    {slot.label}  {slot.fromTime}–{slot.toTime === "00:00" ? "Midnight" : slot.toTime}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.dailyBannerNote}>
              ⏱ Only venues with daily-rate plans are shown below
            </Text>
          </View>
        )}

        {/* Monthly badge */}
        {isMonthly === "true" && (
          <View style={styles.monthlyBanner}>
            <Text style={styles.monthlyBannerText}>
              📅 Monthly Booking · {months} {parseInt(months || "1") === 1 ? "month" : "months"}
            </Text>
          </View>
        )}

        {/* Map */}
        {renderMap()}

        {/* Daily rate fetch loading overlay */}
        {isDaily && dailyEnabledLoading && (
          <View style={styles.dailyFilterOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.dailyFilterText}>Checking daily rate availability…</Text>
          </View>
        )}

        {/* Main loading overlay */}
        {(loading || locationLoading) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {loading ? "Loading parking spots..." : "Getting your location..."}
            </Text>
          </View>
        )}

        {/* Parking list */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            selectedSpot && { paddingBottom: BOTTOM_BUTTON_HEIGHT + 20 + BOTTOM_BUTTON_MARGIN },
          ]}
          showsVerticalScrollIndicator
        >
          <View style={styles.bottomSheet}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {totalResults} {isDaily ? "daily-rate" : isMonthly === "true" ? "monthly" : ""} spots found
              </Text>
              {hasFetchedData && !loading && (
                <TouchableOpacity onPress={handleRetryFetch}>
                  <Text style={styles.retryText}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>

            <VehicleTypeSelector selectedVehicle={selectedVehicle} onSelectVehicle={handleVehicleChange} />

            {/* ── Garages ─────────────────────────────────────────────────── */}
            {(filteredGarages.length > 0 || (!isDaily && !isMonthly && rawGarageCount > 0)) && (
              <>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("garage")}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>
                      Garages ({filteredGarages.length})
                    </Text>
                    {(isDaily || isMonthly === "true") && hiddenGarages > 0 && (
                      <View style={styles.hiddenBadge}>
                        <Text style={styles.hiddenBadgeText}>
                          {hiddenGarages} no plan
                        </Text>
                      </View>
                    )}
                  </View>
                  <IconButton icon={expandedSection === "garage" ? "chevron-up" : "chevron-down"} size={24} iconColor="#FFF" />
                </TouchableOpacity>

                {expandedSection === "garage" && (
                  <>
                    {filteredGarages.length > 0 ? (
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
                          isMonthly={isMonthly === "true"}
                          monthlyRate={item.monthlyRate}
                          isDaily={isDaily}
                          dailySlotsMeta={parsedDailySlots}
                          bookingFrom={bookingFromISO}
                          bookingTo={endTime}
                        />
                      ))
                    ) : (isDaily || isMonthly === "true") ? (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>
                          {isDaily
                            ? "No garages have daily rate plans enabled"
                            : "No garages offer monthly plans"}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}
              </>
            )}

            {/* ── Parking Lots ─────────────────────────────────────────────── */}
            {(filteredParkingLots.length > 0 || (!isDaily && !isMonthly && rawLotCount > 0)) && (
              <>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("lot")}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>
                      Parking Lots ({filteredParkingLots.length})
                    </Text>
                    {(isDaily || isMonthly === "true") && hiddenLots > 0 && (
                      <View style={styles.hiddenBadge}>
                        <Text style={styles.hiddenBadgeText}>
                          {hiddenLots} no plan
                        </Text>
                      </View>
                    )}
                  </View>
                  <IconButton icon={expandedSection === "lot" ? "chevron-up" : "chevron-down"} size={24} iconColor="#FFF" />
                </TouchableOpacity>

                {expandedSection === "lot" && (
                  <>
                    {filteredParkingLots.length > 0 ? (
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
                          isMonthly={isMonthly === "true"}
                          monthlyRate={item.monthlyRate}
                          isDaily={isDaily}
                          dailySlotsMeta={parsedDailySlots}
                          bookingFrom={bookingFromISO}
                          bookingTo={endTime}
                        />
                      ))
                    ) : (isDaily || isMonthly === "true") ? (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>
                          {isDaily
                            ? "No parking lots have daily rate plans enabled"
                            : "No parking lots offer monthly plans"}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}
              </>
            )}

            {/* ── Residences ───────────────────────────────────────────────── */}
            {(filteredResidences.length > 0 || (!isDaily && !isMonthly && rawResidenceCount > 0)) && (
              <>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("residence")}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>
                      Residences ({filteredResidences.length})
                    </Text>
                    {(isDaily || isMonthly === "true") && hiddenResidences > 0 && (
                      <View style={styles.hiddenBadge}>
                        <Text style={styles.hiddenBadgeText}>
                          {hiddenResidences} no plan
                        </Text>
                      </View>
                    )}
                  </View>
                  <IconButton icon={expandedSection === "residence" ? "chevron-up" : "chevron-down"} size={24} iconColor="#FFF" />
                </TouchableOpacity>

                {expandedSection === "residence" && (
                  <>
                    {filteredResidences.length > 0 ? (
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
                          isMonthly={isMonthly === "true"}
                          monthlyRate={item.monthlyRate}
                          isDaily={isDaily}
                          dailySlotsMeta={parsedDailySlots}
                          bookingFrom={bookingFromISO}
                          bookingTo={endTime}
                        />
                      ))
                    ) : (isDaily || isMonthly === "true") ? (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>
                          {isDaily
                            ? "No residences have daily rate plans enabled"
                            : "No residences offer monthly plans"}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}
              </>
            )}

            {/* No results at all */}
            {hasFetchedData && !loading && !dailyEnabledLoading && totalResults === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsTitle}>
                  {isDaily
                    ? "No daily-rate venues nearby"
                    : isMonthly === "true"
                    ? "No monthly-plan venues nearby"
                    : "No parking spots found"}
                </Text>
                <Text style={styles.noResultsText}>
                  {isDaily
                    ? "None of the nearby venues have enabled daily rate plans. Try another location or switch to Hourly booking."
                    : isMonthly === "true"
                    ? "None of the nearby venues offer a monthly plan. Try another location or switch to Hourly booking."
                    : "Try adjusting your search criteria or select a different location."}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetryFetch}>
                  <Text style={styles.retryButtonText}>Search Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Buttons */}
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
                    isMonthly,
                    months,
                    ...dailyForwardParams,
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
                      isMonthly,
                      months,
                      ...dailyForwardParams,
                    },
                  });
                } else {
                  router.push({
                    pathname: "parkingUser/Confirmation",
                    params: {
                      lot: JSON.stringify(selectedLot.lot),
                      type: "R",
                      endTime,
                      isMonthly,
                      months,
                      ...dailyForwardParams,
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },

  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF", paddingHorizontal: 20 },
  errorText:      { fontSize: 18, color: colors.primary, marginBottom: 20, textAlign: "center" },
  backButton:     { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 8, height: HEADER_HEIGHT,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 20, fontWeight: "500", color: colors.primary },

  // ── Daily banner ────────────────────────────────────────────────────────
  dailyBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#EEF4FF",
    borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: colors.primary + "44",
  },
  dailyBannerRow:   { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dailyBannerTitle: { fontSize: 14, fontWeight: "700", color: colors.primary, flex: 1 },
  dailyChipsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  dailyChip: {
    backgroundColor: "#FFF", borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: colors.primary + "33",
  },
  dailyChipText:   { fontSize: 12, color: "#333", fontWeight: "600" },
  dailyBannerNote: { fontSize: 11, color: colors.primary + "99", fontStyle: "italic" },

  // ── Monthly banner ──────────────────────────────────────────────────────
  monthlyBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.primary,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: "center",
  },
  monthlyBannerText: { color: "#FFF", fontSize: 13, fontWeight: "600" },

  map:            { width: "100%" },
  mapPlaceholder: { width: "100%", backgroundColor: "#F3F3F3", justifyContent: "center", alignItems: "center" },

  scrollView:    { flex: 1 },
  scrollContent: { flexGrow: 1 },

  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20,
    minHeight: height - MAP_HEIGHT - HEADER_HEIGHT - 100,
  },

  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  resultsCount:  { fontSize: 16, fontWeight: "600", color: colors.primary },
  retryText:     { fontSize: 14, color: colors.primary, textDecorationLine: "underline" },

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 15,
    backgroundColor: colors.brandColor, borderRadius: 12, marginTop: 15,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionTitle:      { fontSize: 18, fontWeight: "500", color: "#FFF" },

  // Badge showing how many venues were hidden due to no plan
  hiddenBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  hiddenBadgeText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "600" },

  // Empty state inside an expanded section
  emptySection:     { paddingVertical: 14, paddingHorizontal: 4, alignItems: "center" },
  emptySectionText: { fontSize: 13, color: "#AAA", fontStyle: "italic", textAlign: "center" },

  noResultsContainer: { alignItems: "center", paddingVertical: 40 },
  noResultsTitle:     { fontSize: 18, fontWeight: "600", color: colors.primary, marginBottom: 8, textAlign: "center" },
  noResultsText:      { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20, paddingHorizontal: 20 },
  retryButton:        { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  retryButtonText:    { color: "#FFF", fontSize: 16, fontWeight: "600" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  loadingText: { marginTop: 10, fontSize: 16, color: colors.primary, fontWeight: "500" },

  // Slim non-blocking bar shown while daily-rate checks are in flight
  dailyFilterOverlay: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 6, backgroundColor: colors.primary + "12",
  },
  dailyFilterText: { fontSize: 12, color: colors.primary, fontWeight: "600" },

  bottomButtonContainer: {
    position: "absolute",
    bottom: BOTTOM_BUTTON_MARGIN,
    left: 0, right: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0, elevation: 0, shadowOpacity: 0,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
});

export default ParkingSpot;