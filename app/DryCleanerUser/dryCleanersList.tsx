import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import colors from "../../assets/color";
import { images } from "../../assets/images/images";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setSelectedCleaner } from "../../components/redux/userSlice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type RootStackParamList = {
  NumberofItems: { selectedCleaner: DryCleaner };
  App: undefined;
  Login: undefined;
};

interface DryCleaner {
  _id: string;
  shopname: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  rating: number;
  about: string;
  contactPerson: string;
  phoneNumber: string;
  contactPersonImg: string;
  shopimage: string[];
  hoursOfOperation: Array<{
    day: string;
    open: string;
    close: string;
    _id: string;
  }>;
  services: Array<{
    name: string;
    category: string;
    strachLevel: number;
    washOnly: boolean;
    additionalservice?: string;
    price: number;
    _id: string;
  }>;
  distance?: number;
}

const CleanerCard = ({
  cleaner,
  onSelect,
  onViewDetails,
  isSelected,
}: {
  cleaner: DryCleaner;
  onSelect: (cleaner: DryCleaner) => void;
  onViewDetails: (cleaner: DryCleaner) => void;
  isSelected: boolean;
}) => (
  <TouchableOpacity
    style={[styles.cleanerCard, isSelected && styles.selectedCardBorder]}
    onPress={() => onViewDetails(cleaner)}
  >
    <View style={styles.cardContent}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>D</Text>
      </View>
      <View style={styles.cleanerInfo}>
        <View style={styles.nameRating}>
          <Text style={styles.cleanerName}>{cleaner.shopname}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.starIcon}>★</Text>
            <Text style={styles.rating}>{cleaner.rating || "4.2"}</Text>
          </View>
        </View>
        <Text style={styles.address}>
          {cleaner.address
            ? `${cleaner.address.street}, ${cleaner.address.city}`
            : "123, Lincoln Street, New York"}
        </Text>
        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text style={styles.detailText}>
              {cleaner.distance ? `${cleaner.distance} miles` : "1.24274 miles"}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={12} color="#666" />
            <Text style={styles.detailText}>
              {cleaner.hoursOfOperation && cleaner.hoursOfOperation.length > 0
                ? `${cleaner.hoursOfOperation[0].open} - ${cleaner.hoursOfOperation[0].close}`
                : "12:00 PM - 08:00 PM"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

const AvailabilitySlider = ({ schedule }: { schedule: any[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(schedule.length / itemsPerPage);

  const [startX, setStartX] = useState(0);

  const handleTouchStart = (evt: any) => {
    setStartX(evt.nativeEvent.locationX);
  };

  const handleTouchEnd = (evt: any) => {
    const endX = evt.nativeEvent.locationX;
    const deltaX = endX - startX;
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous page
        setCurrentIndex(currentIndex - 1);
      } else if (deltaX < 0 && currentIndex < totalPages - 1) {
        // Swipe left - go to next page
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  // If all items fit on one page, show all without pagination
  if (schedule.length <= itemsPerPage) {
    return (
      <View style={styles.availabilityContainer}>
        <View style={styles.availabilityDaysRow}>
          {schedule.map((daySchedule, index) => (
            <View key={index} style={styles.availabilityDayHeader}>
              <Text style={styles.dayHeaderText}>{daySchedule.day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.availabilityTimesRow}>
          {schedule.map((daySchedule, index) => (
            <View key={index} style={styles.availabilityTimeCell}>
              <Text style={styles.timeText}>{daySchedule.open}</Text>
            </View>
          ))}
        </View>

        <View style={styles.availabilitySeparator}>
          {schedule.map((_, index) => (
            <View key={index} style={styles.separatorCell}>
              <View style={styles.verticalLine} />
            </View>
          ))}
        </View>

        <View style={styles.availabilityTimesRow}>
          {schedule.map((daySchedule, index) => (
            <View key={index} style={styles.availabilityTimeCell}>
              <Text style={styles.timeTextWithBullet}>
                <Text style={styles.bullet}>• </Text>
                {daySchedule.close}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const currentItems = schedule.slice(
    currentIndex * itemsPerPage,
    currentIndex * itemsPerPage + itemsPerPage
  );

  return (
    <View style={styles.availabilityContainer}>
      {/* Add swipe hint text for better UX */}
      {totalPages > 1 && (
        <View style={styles.swipeHintContainer}>
          <Text style={styles.swipeHintText}>← Swipe to see more days →</Text>
        </View>
      )}

      {/* Swipeable area - now using touch events */}
      <View
        style={styles.swipeArea}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <View style={styles.availabilityDaysRow}>
          {currentItems.map((daySchedule, index) => (
            <View key={index} style={styles.availabilityDayHeader}>
              <Text style={styles.dayHeaderText}>{daySchedule.day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.availabilityTimesRow}>
          {currentItems.map((daySchedule, index) => (
            <View key={index} style={styles.availabilityTimeCell}>
              <Text style={styles.timeText}>{daySchedule.open}</Text>
            </View>
          ))}
        </View>

        <View style={styles.availabilitySeparator}>
          {currentItems.map((_, index) => (
            <View key={index} style={styles.separatorCell}>
              <View style={styles.verticalLine} />
            </View>
          ))}
        </View>

        <View style={styles.availabilityTimesRow}>
          {currentItems.map((daySchedule, index) => (
            <View key={index} style={styles.availabilityTimeCell}>
              <Text style={styles.timeTextWithBullet}>
                <Text style={styles.bullet}>• </Text>
                {daySchedule.close}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pagination indicators */}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          {Array.from({ length: totalPages }).map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setCurrentIndex(index)}
              style={styles.paginationDotContainer}
            >
              <View
                style={[
                  styles.paginationDot,
                  currentIndex === index && styles.paginationDotActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const CleanerDetailsModal = ({
  cleaner,
  visible,
  onClose,
  onSelect,
}: {
  cleaner: DryCleaner | null;
  visible: boolean;
  onClose: () => void;
  onSelect: (cleaner: DryCleaner) => void;
}) => {
  const router = useRouter();
  const dispatch = useDispatch();

  if (!cleaner) return null;

  // Function to convert time number to formatted time string
  const formatTime = (timeNumber: string | number) => {
    const time =
      typeof timeNumber === "string" ? parseInt(timeNumber) : timeNumber;
    if (time === 0) return "12:00 AM";
    if (time < 12) return `${time}:00 AM`;
    if (time === 12) return "12:00 PM";
    return `${time - 12}:00 PM`;
  };

  // Get day abbreviations for availability section
  const getDayAbbr = (day: string) => {
    const days: { [key: string]: string } = {
      Monday: "MON",
      Tuesday: "TUE",
      Wednesday: "WED",
      Thursday: "THU",
      Friday: "FRI",
      Saturday: "SAT",
      Sunday: "SUN",
    };
    return days[day] || day.substr(0, 3).toUpperCase();
  };

  const handleContinue = () => {
    if (cleaner) {
      onSelect(cleaner);
      onClose();
      dispatch(setSelectedCleaner(cleaner));
      router.push({
        pathname: "/dryCleanerUser/noOfItem",
        params: {
          selectedCleaner: JSON.stringify(cleaner),
          cleanerId: cleaner._id,
          cleanerName: cleaner.shopname,
        },
      });
    }
  };

  // Process the hours of operation from backend
  const processSchedule = () => {
    if (!cleaner?.hoursOfOperation || cleaner.hoursOfOperation.length === 0) {
      // Default schedule if no hours are available
      return [
        { day: "MON", open: "12:00 PM", close: "08:00 PM" },
        { day: "TUE", open: "12:00 PM", close: "08:00 PM" },
        { day: "WED", open: "12:00 PM", close: "08:00 PM" },
        { day: "THU", open: "12:00 PM", close: "08:00 PM" },
        { day: "FRI", open: "12:00 PM", close: "08:00 PM" },
      ];
    }

    // Convert backend format to display format
    return cleaner.hoursOfOperation
      .map((item) => ({
        day: getDayAbbr(item.day),
        open: formatTime(item.open),
        close: formatTime(item.close),
        originalDay: item.day, // Keep for sorting
      }))
      .sort((a, b) => {
        // Sort by day of week
        const daysOrder = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        return daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
      });
  };

  const schedule = processSchedule();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FF8C00" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Dry Cleaners Detail Page</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Shop Image at the top */}
          <View style={styles.shopImageContainer}>
            {cleaner.shopimage && cleaner.shopimage.length > 0 ? (
              <Image
                source={{ uri: cleaner.shopimage[0] }}
                style={styles.shopImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.shopImagePlaceholder}>
                <MaterialIcons name="store" size={40} color="#ccc" />
                <Text style={styles.shopImagePlaceholderText}>
                  No Shop Image
                </Text>
              </View>
            )}
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailCardHeader}>
              <View style={styles.detailIconContainer}>
                <Text style={styles.detailIconText}>D</Text>
              </View>
              <View style={styles.detailInfo}>
                <View style={styles.detailNameRating}>
                  <Text style={styles.detailName}>{cleaner.shopname}</Text>
                  <View style={styles.detailRatingContainer}>
                    <Text style={styles.detailStarIcon}>★</Text>
                    <Text style={styles.detailRating}>
                      {cleaner.rating || "4.2"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.detailAddress}>
                  {cleaner.address
                    ? `${cleaner.address.street}, ${cleaner.address.city}`
                    : "123, Lincoln Street, New York"}
                </Text>
                <View style={styles.detailMetrics}>
                  <View style={styles.detailMetricItem}>
                    <Ionicons name="location-outline" size={14} color="#666" />
                    <Text style={styles.detailMetricText}>
                      {cleaner.distance
                        ? `${cleaner.distance} miles`
                        : "1.24274 miles"}
                    </Text>
                  </View>
                  <View style={styles.detailMetricItem}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.detailMetricText}>
                      {schedule.length > 0
                        ? `${schedule[0].open} - ${schedule[0].close}`
                        : "12:00 PM - 08:00 PM"}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.qrCodeContainer}>
                <View style={styles.qrCode}>
                  <View style={styles.qrPattern}>
                    <View style={styles.qrDot} />
                    <View style={styles.qrDot} />
                    <View style={styles.qrDot} />
                    <View style={styles.qrDot} />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>About :</Text>
            <Text style={styles.aboutText}>
              {cleaner.about ||
                "Lorem Ipsum Is Simply Dummy Text Of The Printing And Typesetting Industry. Lorem Ipsum Has Been The Industry's Standard Dummy Text Ever Since The 1500s. When An Unknown Printer Took A Galley Of Type."}
            </Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Contact Info</Text>
            <View style={styles.contactInfoCard}>
              <View style={styles.contactPersonContainer}>
                <View style={styles.contactPersonAvatar}>
                  {cleaner.contactPersonImg ? (
                    <Image
                      source={{ uri: cleaner.contactPersonImg }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <MaterialIcons name="person" size={24} color="#666" />
                  )}
                </View>
                <View style={styles.contactPersonInfo}>
                  <Text style={styles.contactPersonName}>
                    {cleaner.contactPerson || "Jason Anderson"}
                  </Text>
                  <View style={styles.phoneContainer}>
                    <Ionicons name="call-outline" size={14} color="#666" />
                    <Text style={styles.phoneNumber}>
                      {cleaner.phoneNumber || "+1 7025825215"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Enhanced Availability Section using backend data */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <AvailabilitySlider schedule={schedule} />
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const DryCleanersList = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();

  const [dryCleaners, setDryCleaners] = useState<DryCleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCleaner, setSelectedCleaner] = useState<DryCleaner | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCleaner, setModalCleaner] = useState<DryCleaner | null>(null);

  const fetchDryCleaners = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        "https://vervoer-backend2.onrender.com/api/users/dry-cleaner",
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success && response.data.data.dryCleaners) {
        setDryCleaners(response.data.data.dryCleaners);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error("Error fetching dry cleaners:", error);

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || "Something went wrong.";

        if (status === 401) {
          Alert.alert("Unauthorized", "Unable to access this resource.");
        } else if (status === 403) {
          Alert.alert(
            "Access Denied",
            "You do not have permission to access this resource."
          );
        } else if (status === 500) {
          Alert.alert(
            "Server Error",
            "Internal server error. Please try again later."
          );
        } else {
          Alert.alert("Error", message);
        }
      } else if (error.request) {
        Alert.alert(
          "Network Error",
          "Unable to connect to the server. Please check your internet connection.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", "Failed to load dry cleaners. Please try again.", [
          { text: "OK" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDryCleaners();
  }, []);

  const handleCleanerSelect = (cleaner: DryCleaner) => {
    setSelectedCleaner(cleaner);
  };

  const handleViewDetails = (cleaner: DryCleaner) => {
    setModalCleaner(cleaner);
    setModalVisible(true);
  };

  const handleSelectDryCleaner = () => {
    if (!selectedCleaner) {
      Alert.alert(
        "Please select a dry cleaner",
        "You need to select a dry cleaner before continuing."
      );
      return;
    }

    handleViewDetails(selectedCleaner);
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/userHome");
    }
  };
  const handleOrderHistory = () => {
    dispatch(setSelectedCleaner(selectedCleaner));
    router.push("/DryCleanerUser/myOrder");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandColor} />
          <Text style={styles.loadingText}>Loading dry cleaners...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FF8C00" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List of Dry Cleaners</Text>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleOrderHistory}
        >
          <Text style={styles.orderHistoryText}>ORDER HISTORY</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular Cleaners Nearby</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>SEE ALL</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchDryCleaners}
            colors={[colors.brandColor]}
          />
        }
      >
        {dryCleaners.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image
              source={images.washing}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No Dry Cleaners Found</Text>
            <Text style={styles.emptyText}>
              We couldn't find any dry cleaners in your area. Please try again
              later.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchDryCleaners}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {dryCleaners.map((cleaner, index) => (
              <CleanerCard
                key={cleaner._id || index}
                cleaner={cleaner}
                onSelect={handleCleanerSelect}
                onViewDetails={handleViewDetails}
                isSelected={selectedCleaner?._id === cleaner._id}
              />
            ))}
          </>
        )}
      </ScrollView>

      {selectedCleaner && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={handleSelectDryCleaner}
          >
            <Text style={styles.selectButtonText}>Select Dry Cleaner</Text>
          </TouchableOpacity>
        </View>
      )}

      <CleanerDetailsModal
        cleaner={modalCleaner}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setModalCleaner(null);
        }}
        onSelect={handleCleanerSelect}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  headerAction: {
    padding: 4,
  },
  orderHistoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF8C00",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF8C00",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cleanerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedCardBorder: {
    borderWidth: 2,
    borderColor: "#FF8C00",
  },
  cardContent: {
    flexDirection: "row",
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF8C00",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  cleanerInfo: {
    flex: 1,
  },
  nameRating: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starIcon: {
    color: "#FF8C00",
    fontSize: 14,
    marginRight: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  address: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
    lineHeight: 18,
  },
  detailsContainer: {
    flexDirection: "row",
    gap: 20,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  selectButton: {
    backgroundColor: "#FF8C00",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#FF8C00",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalContent: {
    flex: 1,
  },
  modalActions: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  shopImageContainer: {
    height: 200,
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  shopImage: {
    width: "100%",
    height: "100%",
  },
  shopImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  shopImagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
  },
  detailIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF8C00",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  detailIconText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  detailInfo: {
    flex: 1,
  },
  detailNameRating: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  detailRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailStarIcon: {
    color: "#FF8C00",
    fontSize: 16,
    marginRight: 4,
  },
  detailRating: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  detailAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    lineHeight: 20,
  },
  detailMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  detailMetricItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailMetricText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 1,
  },
  qrCodeContainer: {
    marginLeft: 20,
    alignSelf: "flex-start",
  },
  qrCode: {
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  qrPattern: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 20,
    height: 20,
  },
  qrDot: {
    width: 8,
    height: 8,
    backgroundColor: "#333",
    margin: 1,
  },
  detailSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },
  contactInfoCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  contactPersonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactPersonAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
  },
  contactPersonInfo: {
    flex: 1,
  },
  contactPersonName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneNumber: {
    fontSize: 15,
    color: "#666",
    marginLeft: 8,
  },
  availabilityContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  availabilityDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  availabilityDayHeader: {
    flex: 1,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  availabilityTimesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  availabilityTimeCell: {
    flex: 1,
    alignItems: "center",
  },
  timeText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  timeTextWithBullet: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  bullet: {
    color: "#FF8C00",
    fontSize: 16,
  },
  availabilitySeparator: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  separatorCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 10,
  },
  verticalLine: {
    width: 1,
    height: "100%",
    backgroundColor: "#ddd",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#FF8C00",
    width: 12,
    height: 8,
    borderRadius: 4,
  },
  continueButton: {
    backgroundColor: "#FF8C00",
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#FF8C00",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  swipeHintContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  swipeHintText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  swipeArea: {
    width: "100%",
  },
  paginationDotContainer: {
    padding: 4,
  },
});

export default DryCleanersList;
