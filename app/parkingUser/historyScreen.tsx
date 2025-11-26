// app/History.tsx
import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, Text } from "react-native";
import { useRouter } from "expo-router";
import { AxiosError } from "axios";

import History from "../../components/History";
import { BookingData } from "../../types";
import axiosInstance from "../../api/axios";
import { useAppSelector } from "../../components/redux/hooks"

const HistoryScreen: React.FC = () => {
  const router = useRouter();

  const [bookingHistory, setBookingHistory] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const authToken = useAppSelector((state) => state.auth.token);

  useEffect(() => {
    if (!authToken) return;

    setLoading(true);

    axiosInstance
      .get("/merchants/garage/booking", {
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        setBookingHistory(res.data?.data?.bookings || []);
      })
      .catch((err) => {
        if (err instanceof AxiosError) {
          Alert.alert("Server Error", err.message);

          if (err.response) {
            console.log(err.response.data);
          } else {
            console.log(err);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [authToken]);

  return (
    <View style={styles.container}>
      {loading ? (
        <Text>Loading…</Text>
      ) : (
        <History onBack={() => router.back()} bookingList={bookingHistory} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});

export default HistoryScreen;
