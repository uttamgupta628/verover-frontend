import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import colors from "../../assets/color";
import { images } from "../../assets/images/images";

import MapView, { Marker } from "react-native-maps";

const { height } = Dimensions.get("window");

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

const ParkingSlot = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse location from params
  const parseLocation = (): LocationData | null => {
    try {
      // First try to get location as JSON string
      if (params.location) {
        const locationStr = Array.isArray(params.location)
          ? params.location[0]
          : params.location;
        return JSON.parse(locationStr);
      }

      // Fallback: check for individual params (backward compatibility)
      if (params.latitude && params.longitude) {
        return {
          latitude: parseFloat(
            Array.isArray(params.latitude)
              ? params.latitude[0]
              : params.latitude
          ),
          longitude: parseFloat(
            Array.isArray(params.longitude)
              ? params.longitude[0]
              : params.longitude
          ),
          address: params.address
            ? Array.isArray(params.address)
              ? params.address[0]
              : params.address
            : "Selected Location",
        };
      }

      return null;
    } catch (error) {
      console.error("Error parsing location:", error);
      return null;
    }
  };

  const [location, setLocation] = useState<LocationData | null>(() =>
    parseLocation()
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [duration, setDuration] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
  });

  const [dateTimeText, setDateTimeText] = useState("");

  const getSelectedDate = () => {
    if (selectedDate && selectedTime) {
      const selected = new Date(selectedDate);
      selected.setHours(selectedTime.getHours());
      selected.setMinutes(selectedTime.getMinutes());
      return selected;
    }
    return new Date();
  };

  useEffect(() => {
    if (!location) {
      Alert.alert("No location selected", "Please select a location first", [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => router.replace("/userHome"),
        },
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    }
  }, [location]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      const now = new Date();
      const selected = getSelectedDate();

      if (selected > now) {
        const diffMs = selected.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor(
          (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        setDuration({
          days: diffDays,
          hours: diffHrs,
          minutes: diffMins,
        });

        const formattedDate = selected.toLocaleDateString();
        const formattedTime = selected.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        setDateTimeText(`${formattedDate} ${formattedTime}`);
      }
    }
  }, [selectedDate, selectedTime]);

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === "android") setShowTimePicker(true);
    }
  };

  const onTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) setSelectedTime(time);
  };

  const renderMap = () => {
    if (!location) {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>Loading map...</Text>
        </View>
      );
    }

    return (
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="Selected Location"
          pinColor={colors.primary}
        />
      </MapView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Parking</Text>
      </View>

      {/* Map */}
      {renderMap()}

      {/* Scrollable Bottom Sheet */}
      <ScrollView
        style={styles.bottomSheetScrollView}
        contentContainerStyle={styles.bottomSheetContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.bottomSheet}>
          {/* Location */}
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.textInputContainer}>
            <Image source={images.location} style={styles.icon} />
            <TextInput
              style={styles.textInput}
              placeholder="Your selected location"
              placeholderTextColor="#999"
              value={
                location
                  ? `Lat: ${location.latitude.toFixed(
                      4
                    )}, Lng: ${location.longitude.toFixed(4)}`
                  : ""
              }
              editable={false}
            />
          </View>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.useLocationText}>Change Location</Text>
          </TouchableOpacity>

          {/* When */}
          <Text style={styles.sectionTitle}>When</Text>
          <TouchableOpacity
            style={styles.textInputContainer}
            onPress={() => setShowDatePicker(true)}
          >
            <Image source={images.calender} style={styles.icon} />
            <Text
              style={[styles.textInput, !dateTimeText && styles.placeholder]}
            >
              {dateTimeText || "Select Date & Time"}
            </Text>
          </TouchableOpacity>

          {/* Duration */}
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationContainer}>
            <Image source={images.calender} style={styles.icon} />
            <View style={styles.durationInputs}>
              <View style={styles.durationField}>
                <Text style={styles.durationValue}>{duration.days}</Text>
                <Text style={styles.durationLabel}>Days</Text>
              </View>
              <View style={styles.durationField}>
                <Text style={styles.durationValue}>{duration.hours}</Text>
                <Text style={styles.durationLabel}>Hours</Text>
              </View>
              <View style={styles.durationField}>
                <Text style={styles.durationValue}>{duration.minutes}</Text>
                <Text style={styles.durationLabel}>Minutes</Text>
              </View>
            </View>
          </View>

          {/* Date / Time pickers */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={onDateChange}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={selectedTime || new Date()}
              mode="time"
              is24Hour
              onChange={onTimeChange}
            />
          )}

          {/* Continue - This stays inside the scroll view but will be visible */}
          <TouchableOpacity
            style={[
              styles.pickSlotButton,
              (!selectedDate || !selectedTime) && { opacity: 0.5 },
            ]}
            disabled={!selectedDate || !selectedTime}
            onPress={() =>
              router.push({
                pathname: "/parkingUser/ParkingSpot",
                params: {
                  location: JSON.stringify(location),
                  endTime: getSelectedDate().toISOString(),
                },
              })
            }
          >
            <Text style={styles.pickSlotButtonText}>Pick Parking Slot</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  backArrow: {
    fontSize: 28,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginLeft: 10,
    color: "#000",
  },

  map: {
    width: "100%",
    height: height * 0.35,
  },
  mapPlaceholder: {
    width: "100%",
    height: height * 0.35,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEE",
  },
  placeholderText: {
    color: "#777",
    fontSize: 16,
  },

  bottomSheetScrollView: {
    flex: 1,
  },

  bottomSheetContent: {
    flexGrow: 1,
  },

  bottomSheet: {
    backgroundColor: "#FFF",
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -20,
    paddingBottom: 30, // Extra padding for better scrolling
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
    color: "#000",
  },

  textInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderColor: "#E0E0E0",
    marginBottom: 20,
  },
  icon: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  placeholder: {
    color: "#999",
  },

  useLocationText: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 20,
  },

  durationContainer: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderColor: "#E0E0E0",
    marginBottom: 20,
  },
  durationInputs: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "space-between",
  },
  durationField: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  durationValue: {
    fontSize: 24,
    fontWeight: "600",
    marginRight: 4,
  },
  durationLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },

  pickSlotButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 10,
  },
  pickSlotButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ParkingSlot;
