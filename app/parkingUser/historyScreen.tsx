// app/History.tsx
import React, { useCallback, useState } from "react";
import { View, StyleSheet, Alert, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { AxiosError } from "axios";
import axiosInstance from "../../api/axios";
import { useAppSelector } from "../../components/redux/hooks";
import BookingHistoryCard from "../../components/BookingHistoryCard"; 
import { BookingData } from "../../types"; 

const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const authToken = useAppSelector((state) => state.auth.token);
  const [bookingHistory, setBookingHistory] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchBookingHistory = useCallback(async () => {
    if (!authToken) {
      Alert.alert("Error", "Authentication required.");
      return;
    }
    try {
      const res = await axiosInstance.get("/merchants/garage/booking", {
        headers: { Authorization: authToken, "Content-Type": "application/json" },
      });
      // Assuming the API returns { success: true, data: { bookings: BookingData[] } }
      setBookingHistory(res.data?.data?.bookings || []);
    } catch (err) {
      const error = err as AxiosError;
      Alert.alert("Fetch Error", error.message || "Failed to load history.");
      console.error("History fetch error:", error.response?.data || error.message);
    }
  }, [authToken]);

  // Initial load
  React.useEffect(() => {
    fetchBookingHistory().finally(() => setLoading(false));
  }, [fetchBookingHistory]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookingHistory();
    setRefreshing(false);
  }, [fetchBookingHistory]);

  const handleBookingPress = (booking: BookingData) => {
    // Navigate to a detail screen, passing the booking data
    router.push({
      pathname: "/parkingUser/booking-detail",
      params: { bookingData: JSON.stringify(booking) }
    });
  };

const renderBookingItem = ({ item }: { item: BookingData }) => {
  console.log("📋 Rendering booking item:", {
    id: item.bookingId || item._id,
    hasOnPress: true
  });
  
  return (
    <BookingHistoryCard 
      booking={item}
      onPress={() => {
        console.log("👆 Card pressed for booking:", item.bookingId || item._id);
        handleBookingPress(item);
      }}
    />
  );
};

  return (
    <View style={styles.container}>
      <FlatList
        data={bookingHistory}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.bookingId || item._id}
        contentContainerStyle={bookingHistory.length === 0 ? styles.centered : styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No booking history found.</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16 },
  emptyText: { textAlign: "center", color: "#666", marginTop: 20 },
});

export default HistoryScreen;