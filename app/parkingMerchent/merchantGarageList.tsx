import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from 'react-native-responsive-dimensions';
import colors from '../../assets/color';
import { images } from '../../assets/images/images';
import { useSelector } from 'react-redux';
import { RootState } from '../../components/redux/store';
import axiosInstance from '../../api/axios';
import { ArrowLeft, Plus, Phone } from 'lucide-react-native';


interface Garage {
  _id: string;
  garageName: string;
  address: string;
  images: string[];
  price?: number;
  spacesList: Record<string, { count: number; price: number }>;
  contactNumber: string;
  is24x7: boolean;
}

const MerchantGarageList = () => {
  const router = useRouter();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGarages = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await axiosInstance.get('/merchants/garage/search', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          owner: user?._id,
        },
      });

      if (response.data && response.data.data) {
        const formattedGarages = response.data.data.map((garage: any) => ({
          ...garage,
          spacesList: garage.spacesList 
            ? Object.fromEntries(
                Object.entries(garage.spacesList).map(([key, value]: [string, any]) => [
                  key, 
                  { count: value.count, price: value.price }
                ])
              ) 
            : {},
        }));
        setGarages(formattedGarages);
      } else {
        setGarages([]);
      }
    } catch (err: any) {
      console.error('Error fetching garages:', err.response?.data || err.message);
      setError('Failed to load garages. ' + (err.response?.data?.message || ''));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [token, user?._id]);

  useFocusEffect(
    useCallback(() => {
      fetchGarages();
    }, [fetchGarages])
  );

  const handleRefresh = () => {
    fetchGarages();
  };

  const handleAddGarage = () => {
    console.log("Navigating to registerGarage");
  router.push('/parkingMerchent/registerGarage');
};

  const handleGaragePress = (garage: Garage) => {
    router.push({
  pathname: '/parkingMerchent/merchantGarageDetails',
  params: {
    garageId: garage._id,
    garageData: JSON.stringify(garage),
  }
});
    console.log('garageID', garage._id);
  };

  const calculateTotalSlots = (spacesList: Garage['spacesList']) => {
    if (!spacesList) {
      return 0;
    }
    let total = 0;
    for (const zone in spacesList) {
      if (spacesList.hasOwnProperty(zone) && spacesList[zone] && typeof spacesList[zone].count === 'number') {
        total += spacesList[zone].count;
      }
    }
    return total;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandColor} />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={30} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Garages</Text>
          <TouchableOpacity onPress={handleAddGarage}>
            <Plus size={30} color={colors.brandColor} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={30} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Garages</Text>
        <TouchableOpacity onPress={handleAddGarage}>
          <Plus size={30} color={colors.brandColor} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {garages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image
            source={images.emptyGarage}
            style={styles.emptyImage}
            resizeMode="contain"
          />
          <Text style={styles.emptyText}>You don't have any garages yet</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddGarage}
          >
            <Text style={styles.addButtonText}>Add Your First Garage</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={garages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleGaragePress(item)}
              activeOpacity={0.8}
            >
              {/* Garage Image */}
              <View style={styles.imageContainer}>
                {item.images?.[0] ? (
                  <Image
                    source={{ uri: item.images[0] }}
                    style={styles.garageImage}
                    resizeMode="cover"
                    onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                  />
                ) : (
                  <Image
                    source={images.defaultGarage}
                    style={styles.garageImage}
                    resizeMode="cover"
                  />
                )}
              </View>

              {/* Garage Info */}
              <View style={styles.infoContainer}>
                <Text style={styles.garageName} numberOfLines={1}>
                  {item.garageName}
                </Text>
                <Text style={styles.address} numberOfLines={2}>
                  {item.address}
                </Text>

                {/* Price and Availability */}
                <View style={styles.detailsRow}>
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Price:</Text>
                    <Text style={styles.priceValue}>
                      ${item.price?.toFixed(2) || '0.00'}/hr
                    </Text>
                  </View>

                  <View style={styles.slotsContainer}>
                    <Text style={styles.slotsLabel}>Total Slots:</Text>
                    <Text style={styles.slotsValue}>
                      {calculateTotalSlots(item.spacesList)}
                    </Text>
                  </View>
                </View>

                {/* Contact and Status */}
                <View style={styles.footerRow}>
                  <View style={styles.contactContainer}>
                    <Phone size={16} color={colors.brandColor} />
                    <Text style={styles.contactText} numberOfLines={1}>
                      {item.contactNumber}
                    </Text>
                  </View>

                  <View style={[
                    styles.statusBadge,
                    item.is24x7 ? styles.openBadge : styles.closedBadge,
                  ]}>
                    <Text style={styles.statusText}>
                      {item.is24x7 ? '24/7 Open' : 'Limited Hours'}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListFooterComponent={<View style={{ height: responsiveHeight(5) }} />}
        />
      )}
    </SafeAreaView>
  );
};

const cardWidth = Dimensions.get('window').width - responsiveWidth(10);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(2),
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: 'bold',
    color: colors.black,
    marginLeft: responsiveWidth(2),
  },
  listContent: {
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(2),
  },
  card: {
    width: cardWidth,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: responsiveHeight(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    height: responsiveHeight(20),
    width: '100%',
    backgroundColor: colors.lightGray,
  },
  garageImage: {
    height: '100%',
    width: '100%',
  },
  infoContainer: {
    padding: responsiveWidth(4),
  },
  garageName: {
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: responsiveHeight(0.5),
  },
  address: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
    marginBottom: responsiveHeight(1),
    lineHeight: responsiveHeight(2),
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1),
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
    marginRight: responsiveWidth(1),
  },
  priceValue: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
    color: colors.brandColor,
  },
  slotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotsLabel: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
    marginRight: responsiveWidth(1),
  },
  slotsValue: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
    color: colors.black,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsiveHeight(1),
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: responsiveWidth(2),
  },
  contactText: {
    fontSize: responsiveFontSize(1.6),
    color: colors.gray,
    marginLeft: responsiveWidth(1),
  },
  statusBadge: {
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(0.8),
    borderRadius: 12,
  },
  openBadge: {
    backgroundColor: '#4CAF50',
  },
  closedBadge: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: responsiveFontSize(1.4),
    fontWeight: 'bold',
    color: colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsiveWidth(10),
  },
  emptyImage: {
    width: responsiveWidth(60),
    height: responsiveWidth(60),
    marginBottom: responsiveHeight(3),
  },
  emptyText: {
    fontSize: responsiveFontSize(2),
    color: colors.gray,
    textAlign: 'center',
    marginBottom: responsiveHeight(2),
  },
  addButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(8),
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsiveWidth(10),
  },
  errorText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.error,
    textAlign: 'center',
    marginBottom: responsiveHeight(2),
  },
  retryButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(8),
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: responsiveFontSize(1.8),
    fontWeight: 'bold',
  },
});

export default MerchantGarageList;