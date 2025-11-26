import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Text,
  ActivityIndicator,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import LiveSession from "../../components/LiveSession";

import axiosInstance from "../../api/axios";
import { useSelector } from "react-redux";

import { RootState } from "../../components/redux/store";
import { BookingData } from "../../types";

interface FetchBookingData {
  data: BookingData;
  message: string;
  statusCode: number;
  success: boolean;
}

const LiveSessionScreen: React.FC = () => {
  const router = useRouter();
  const { bookingId, type } = useLocalSearchParams();

  const authToken = useSelector((state: RootState) => state.auth.token);

  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = async () => {
    try {
      setLoading(true);

      if (bookingId && type) {
        // Fetch with type & bookingId
        const endpoint = `/merchants/${
          type === "G" ? "garage" : type === "L" ? "parkinglot" : "residence"
        }/booking/${bookingId}`;

        const res = await axiosInstance.get<FetchBookingData>(endpoint, {
          headers: {
            Authorization: authToken,
          },
        });

        setBookingData(res.data.data);
      } else {
        // Fetch current session
        const res = await axiosInstance.get<FetchBookingData>(
          "/users/current-session",
          {
            headers: {
              Authorization: authToken,
            },
          }
        );
        setBookingData(res.data.data);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch booking data";

      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch booking data on mount
  useEffect(() => {
    if (authToken) fetchBooking();
  }, [bookingId, type, authToken]);

  /** Navigation handler for LiveSession component */
  const handleNavigate = (screen: string) => {
    switch (screen) {
      case "qrCode":
        if (bookingData?._id) {
          router.push(`/QRCode?bookingId=${bookingData._id}`);
        }
        break;

      case "history":
        router.push("/History");
        break;

      case "findParking":
        router.push("/FindParking");
        break;

      case "liveSession":
      default:
        break;
    }
  };

  /* ---------------- UI STATES ---------------- */

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error}</Text>

        <Text style={styles.retryText} onPress={() => fetchBooking()}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (!bookingData) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>No booking data available</Text>
      </View>
    );
  }

  /* ---------------- MAIN UI ---------------- */

  return (
    <View style={styles.container}>
      <LiveSession
        onBack={() => router.back()}
        onNavigate={handleNavigate}
        bookingData={bookingData}
        qrCode={bookingData._id}
      />
    </View>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 10,
  },
  retryText: {
    fontSize: 14,
    color: "#0066CC",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});

export default LiveSessionScreen;
