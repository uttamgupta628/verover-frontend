import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    Dimensions,
    Platform,
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

interface IParkingLot {
    _id: string;
    parkingName: string;
    address: string;
    images: string[];
    price: number;
    spacesList: Record<string, { count: number; price: number }>;
    contactNumber: string;
    email?: string;
    is24x7: boolean;
}

const MerchantParkinglotList = () => {
    const router = useRouter();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const [parkingLots, setParkingLots] = useState<IParkingLot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchParkingLots = useCallback(async () => {
        try {
            setRefreshing(true);
            setError(null);

            const response = await axiosInstance.get('/merchants/parkinglot/search', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    owner: user?._id,
                },
            });

            if (response.data && response.data.data) {
                setParkingLots(response.data.data);
            } else {
                setParkingLots([]);
            }
        } catch (err: any) {
            console.error('Error fetching parking lots:', err.response?.data || err.message);
            setError('Failed to load parking lots. ' + (err.response?.data?.message || ''));
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [token, user?._id]);

    useFocusEffect(
        useCallback(() => {
            fetchParkingLots();
        }, [fetchParkingLots])
    );

    const handleRefresh = () => {
        fetchParkingLots();
    };

    const handleAddParkingLot = () => {
        router.push("/parkingMerchent/registerParkingLot");
    };

    const handleParkingLotPress = (parkingLot: IParkingLot) => {
        router.push({
            pathname: "/parkingMerchent/merchantParkingDetails",
            params: {
                parkingLotId: parkingLot._id,
                parkingLotData: JSON.stringify(parkingLot),
            }
        });
        console.log('Navigating to merchantParkingDetails for ID:', parkingLot._id);
    };

    const calculateTotalSlots = (spacesList: IParkingLot['spacesList']) => {
        return Object.values(spacesList || {}).reduce((sum, space) => sum + space.count, 0);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
            </View>
        );
    }

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
                <ArrowLeft size={30} color={colors.brandColor} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Parking Lots</Text>
            <TouchableOpacity onPress={handleAddParkingLot}>
                <Plus size={30} color={colors.brandColor} />
            </TouchableOpacity>
        </View>
    );

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                {renderHeader()}
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
            {renderHeader()}

            {/* Content */}
            {parkingLots.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Image
                        source={images.emptyParkingLot}
                        style={styles.emptyImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.emptyText}>You don't have any parking lots yet</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={handleAddParkingLot}
                    >
                        <Text style={styles.addButtonText}>Add Your First Parking Lot</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={parkingLots}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => handleParkingLotPress(item)}
                            activeOpacity={0.8}
                        >
                            {/* Parking Lot Image */}
                            <View style={styles.imageContainer}>
                                {item.images?.[0] ? (
                                    <Image
                                        source={{ uri: item.images[0] }}
                                        style={styles.parkingLotImage}
                                        resizeMode="cover"
                                        onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                                    />
                                ) : (
                                    <Image
                                        source={images.defaultParkingLot}
                                        style={styles.parkingLotImage}
                                        resizeMode="cover"
                                    />
                                )}
                            </View>

                            {/* Parking Lot Info */}
                            <View style={styles.infoContainer}>
                                <Text style={styles.parkingLotName} numberOfLines={1}>
                                    {item.parkingName}
                                </Text>
                                <Text style={styles.address} numberOfLines={2}>
                                    {item.address}
                                </Text>

                                {/* Price and Availability */}
                                <View style={styles.detailsRow}>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.priceLabel}>Price:</Text>
                                        <Text style={styles.priceValue}>
                                            ${item.price.toFixed(2)}/hr
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
        fontSize: responsiveFontSize(2.5),
        fontWeight: 'bold',
        color: colors.black,
    },
    listContent: {
        paddingHorizontal: responsiveWidth(5),
        paddingTop: responsiveHeight(2),
    },
    card: {
        width: cardWidth,
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginBottom: responsiveHeight(2.5),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 4,
        overflow: 'hidden',
    },
    imageContainer: {
        height: responsiveHeight(22),
        width: '100%',
        backgroundColor: colors.lightGray,
    },
    parkingLotImage: {
        height: '100%',
        width: '100%',
    },
    infoContainer: {
        padding: responsiveWidth(4),
    },
    parkingLotName: {
        fontSize: responsiveFontSize(2.2),
        fontWeight: '700',
        color: colors.black,
        marginBottom: responsiveHeight(0.5),
    },
    address: {
        fontSize: responsiveFontSize(1.8),
        color: colors.gray,
        marginBottom: responsiveHeight(1.5),
        lineHeight: responsiveHeight(2.2),
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: responsiveHeight(1.5),
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: responsiveFontSize(1.8),
        color: colors.gray,
        marginRight: responsiveWidth(1),
    },
    priceValue: {
        fontSize: responsiveFontSize(2),
        fontWeight: 'bold',
        color: colors.brandColor,
    },
    slotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slotsLabel: {
        fontSize: responsiveFontSize(1.8),
        color: colors.gray,
        marginRight: responsiveWidth(1),
    },
    slotsValue: {
        fontSize: responsiveFontSize(2),
        fontWeight: 'bold',
        color: colors.black,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: responsiveHeight(1),
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        paddingTop: responsiveHeight(1.5),
    },
    contactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: responsiveWidth(2),
    },
    contactText: {
        fontSize: responsiveFontSize(1.7),
        color: colors.gray,
        marginLeft: responsiveWidth(1.5),
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
        backgroundColor: '#FF9800',
    },
    statusText: {
        fontSize: responsiveFontSize(1.5),
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
        width: responsiveWidth(50),
        height: responsiveWidth(50),
        marginBottom: responsiveHeight(3),
    },
    emptyText: {
        fontSize: responsiveFontSize(2.2),
        color: colors.gray,
        textAlign: 'center',
        marginBottom: responsiveHeight(3),
    },
    addButton: {
        backgroundColor: colors.brandColor,
        paddingVertical: responsiveHeight(1.8),
        paddingHorizontal: responsiveWidth(8),
        borderRadius: 10,
    },
    addButtonText: {
        color: '#FFF',
        fontSize: responsiveFontSize(2),
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

export default MerchantParkinglotList;