import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    FlatList,
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
import { ArrowLeft, Plus, Phone, Video } from 'lucide-react-native';

// Interface for the residence data displayed in the list
interface IResidence {
    _id: string;
    residenceName: string;
    address: string;
    images: string[];
    price: number;
    contactNumber: string;
    is24x7: boolean;
    securityCamera: boolean;
}

const MerchantResidenceList = () => {
    const router = useRouter();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const [residences, setResidences] = useState<IResidence[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch residences owned by the current merchant
    const fetchResidences = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            const response = await axiosInstance.get('/merchants/residence/search', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    owner: user?._id,
                },
            });

            if (response.data && response.data.data) {
                setResidences(response.data.data);
            } else {
                setResidences([]);
            }
        } catch (err: any) {
            console.error('Error fetching residences:', err.response?.data || err.message);
            setError('Failed to load residences. ' + (err.response?.data?.message || ''));
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [token, user?._id]);

    // useFocusEffect ensures data is re-fetched every time the screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchResidences();
        }, [fetchResidences])
    );

    const handleRefresh = () => {
        fetchResidences();
    };

    const handleAddResidence = () => {
        router.push("/parkingMerchent/registerResidence");
    };

    const handleResidencePress = (residence: IResidence) => {
        router.push({
            pathname: "/parkingMerchent/merchantResidenceDetails",
            params: {
                residenceId: residence._id,
                residenceData: JSON.stringify(residence),
            }
        });
        console.log('residenceID', residence._id);
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
            <Text style={styles.headerTitle}>My Residences</Text>
            <TouchableOpacity onPress={handleAddResidence}>
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
                    <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {renderHeader()}
            {residences.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Image
                        source={images.emptyParkingLot}
                        style={styles.emptyImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.emptyText}>You don't have any residences yet</Text>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddResidence}>
                        <Text style={styles.addButtonText}>Add Your First Residence</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={residences}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => handleResidencePress(item)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.imageContainer}>
                                {item.images?.[0] ? (
                                    <Image 
                                        source={{ uri: item.images[0] }} 
                                        style={styles.residenceImage}
                                        onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                                    />
                                ) : (
                                    <View style={styles.placeholderImage}>
                                        <Text style={styles.placeholderText}>🏠</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.infoContainer}>
                                <Text style={styles.residenceName} numberOfLines={1}>
                                    {item.residenceName}
                                </Text>
                                <Text style={styles.address} numberOfLines={2}>
                                    {item.address}
                                </Text>

                                <View style={styles.detailsRow}>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.priceLabel}>From:</Text>
                                        <Text style={styles.priceValue}>
                                            ${item.price.toFixed(2)}/night
                                        </Text>
                                    </View>
                                    {item.securityCamera && (
                                        <View style={styles.featureContainer}>
                                            <Video size={16} color={colors.brandColor} />
                                            <Text style={styles.featureText}>CCTV</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.footerRow}>
                                    <View style={styles.contactContainer}>
                                        <Phone size={16} color={colors.brandColor} />
                                        <Text style={styles.contactText} numberOfLines={1}>
                                            {item.contactNumber}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.statusBadge, 
                                        item.is24x7 ? styles.openBadge : styles.closedBadge
                                    ]}>
                                        <Text style={styles.statusText}>
                                            {item.is24x7 ? '24/7 Check-in' : 'Standard Hours'}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
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
        width: '100%',
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
    residenceImage: {
        height: '100%',
        width: '100%',
        resizeMode: 'cover',
    },
    placeholderImage: {
        height: '100%',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E9ECEF',
    },
    placeholderText: {
        fontSize: 80,
    },
    infoContainer: {
        padding: responsiveWidth(4),
    },
    residenceName: {
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
        alignItems: 'center',
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
    featureContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: responsiveWidth(2),
        paddingVertical: responsiveHeight(0.5),
        borderRadius: 8,
    },
    featureText: {
        fontSize: responsiveFontSize(1.6),
        color: '#2E7D32',
        marginLeft: responsiveWidth(1.5),
        fontWeight: '500',
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

export default MerchantResidenceList;