import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

type BookingType = 'parking' | 'garage' | 'residence';
type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'active';

interface BookingItem {
    _id: string;
    bookingId: string;
    orderNumber: string;
    status: BookingStatus;
    createdAt: string;
    vehicleNumber: string;
    totalAmount: number;
    bookingPeriod?: {
        from: string;
        to: string;
    };
    placeInfo?: {
        name: string;
        address: string;
        phoneNo: string;
    };
    slot?: string;
    type: BookingType;
    lot?: any;
    garage?: any;
    residence?: any;
    paymentMethod?: string;
    paymentStatus?: string;
    user?: {
        firstName: string;
        lastName: string;
        phone: string;
    };
}

interface BookingResponse {
    success: boolean;
    data: BookingItem[] | { bookings?: BookingItem[]; data?: BookingItem[] };
    message?: string;
}

const MerchantParkingOrderHistory = () => {
    const router = useRouter();
    const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [allBookings, setAllBookings] = useState<BookingItem[]>([]);
    const [filteredBookings, setFilteredBookings] = useState<BookingItem[]>([]);
    const [activeFilter, setActiveFilter] = useState<BookingType | 'all'>('all');
    const [activeStatusFilter, setActiveStatusFilter] = useState<BookingStatus | 'all'>('all');
    const [filterApplied, setFilterApplied] = useState(false);
    const [stats, setStats] = useState({
        parking: 0,
        garage: 0,
        residence: 0,
        pending: 0,
        active: 0,
        completed: 0,
        total: 0
    });

    useEffect(() => {
        if (isAuthenticated && token) {
            fetchAllBookings();
        }
    }, [isAuthenticated, token]);

    useEffect(() => {
        filterBookings();
        updateStats();
    }, [allBookings, activeFilter, activeStatusFilter]);

    const fetchAllBookings = async () => {
        try {
            setLoading(true);
            
            // Fetch bookings from all three endpoints in parallel
            const [parkingResponse, garageResponse, residenceResponse] = await Promise.allSettled([
                fetchParkingBookings(),
                fetchGarageBookings(),
                fetchResidenceBookings()
            ]);

            const allBookings: BookingItem[] = [];

            // Process parking bookings
            if (parkingResponse.status === 'fulfilled' && parkingResponse.value) {
                allBookings.push(...parkingResponse.value);
            }

            // Process garage bookings
            if (garageResponse.status === 'fulfilled' && garageResponse.value) {
                allBookings.push(...garageResponse.value);
            }

            // Process residence bookings
            if (residenceResponse.status === 'fulfilled' && residenceResponse.value) {
                allBookings.push(...residenceResponse.value);
            }

            // Sort by date (newest first)
            allBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            setAllBookings(allBookings);
            console.log('Total bookings fetched:', allBookings.length);

        } catch (error: any) {
            console.error('Error fetching bookings:', error);
            Alert.alert('Error', 'Failed to fetch bookings. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

   const fetchParkingBookings = async (): Promise<BookingItem[]> => {
    try {
        const response = await axiosInstance.get<BookingResponse>('/merchants/parkinglot/booking', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            params: {
                page: 1,
                limit: 100,
            }
        });

        console.log('Parking bookings response:', response.data);

        if (!response.data.success) return [];

        const data = response.data.data;
        const bookings = data?.bookings || [];

        return bookings.map((b: any) => {
            const bookingId = b._id;

            return {
                _id: bookingId,
                bookingId,
                orderNumber: `PARK${String(bookingId).slice(-6).toUpperCase()}`,

                status: b.paymentDetails?.status || 'PENDING',
                createdAt: b.createdAt,

                vehicleNumber: b.vehicleNumber || "N/A",

                totalAmount: b.paymentDetails?.totalAmount || 0,

                bookingPeriod: b.bookingPeriod,

                placeInfo: {
                    name: b.lot?.name || b.lot?.parkingName || "Parking Lot",
                    address: b.lot?.address || "N/A",
                    phoneNo: b.lot?.contactNumber || "N/A",
                },

                slot: b.bookedSlot || null,

                type: "parking",

                lot: b.lot,

                paymentMethod: b.paymentDetails?.method || "N/A",
                paymentStatus: b.paymentDetails?.status || "N/A",

                user: b.customer || null
            };
        });

    } catch (error) {
        console.error('Error fetching parking bookings:', error);
        return [];
    }
};

    const fetchGarageBookings = async (): Promise<BookingItem[]> => {
    try {
        const response = await axiosInstance.get<BookingResponse>('/merchants/garage/booking', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            params: {
                page: 1,
                limit: 100,
            }
        });

        console.log('Garage bookings response:', response.data);

        if (!response.data.success) return [];

        const data = response.data.data;
        const bookings = data?.bookings || [];

        return bookings.map((b: any) => {
            const bookingId = b._id;

            return {
                _id: bookingId,
                bookingId,
                orderNumber: `GAR${String(bookingId).slice(-6).toUpperCase()}`,

                status: b.paymentDetails?.status || 'PENDING',
                createdAt: b.createdAt,

                vehicleNumber: b.vehicleNumber || "N/A",

                totalAmount: b.paymentDetails?.totalAmount || 0,

                bookingPeriod: b.bookingPeriod,

                placeInfo: {
                    name: b.garage?.name || b.garage?.garageName || "Garage",
                    address: b.garage?.address || "N/A",
                    phoneNo: b.garage?.contactNumber || "N/A",
                },

                slot: b.bookedSlot || null,

                type: "garage",

                garage: b.garage,

                paymentMethod: b.paymentDetails?.method || "N/A",
                paymentStatus: b.paymentDetails?.status || "N/A",

                user: b.customer || null
            };
        });

    } catch (error) {
        console.error('Error fetching garage bookings:', error);
        return [];
    }
};

   const fetchResidenceBookings = async (): Promise<BookingItem[]> => {
    try {
        const response = await axiosInstance.get<BookingResponse>('/merchants/residence/booking', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            params: {
                page: 1,
                limit: 100,
            }
        });

        console.log('Residence bookings response:', response.data);

        if (response.data.success) {
            const data = response.data.data as any;
            const bookings = data?.bookings || data || [];

            return bookings.map((booking: any) => ({
                _id: booking._id || booking.bookingId,
                bookingId: booking.bookingId || booking._id,
                orderNumber: booking.bookingNumber || `RES${(booking._id || '').slice(-6).toUpperCase()}`,
                status: booking.status || 'pending',
                createdAt: booking.createdAt || new Date().toISOString(),
                vehicleNumber: booking.vehicleNumber || 'N/A',
                totalAmount: booking.totalAmount || booking.totalPrice || 0,
                bookingPeriod: booking.bookingPeriod,
                placeInfo: booking.placeInfo || {
                    name: booking.residence?.residenceName || 'Residence',
                    address: booking.residence?.address || 'N/A',
                    phoneNo: booking.residence?.contactNumber || 'N/A'
                },
                type: 'residence' as BookingType,
                residence: booking.residence,
                paymentMethod: booking.paymentMethod,
                paymentStatus: booking.paymentStatus,
                user: booking.user
            }));
        }

        return [];
    } catch (error: any) {
        console.error('Error fetching residence bookings:', error);
        return [];
    }
};

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllBookings();
    };

    const filterBookings = () => {
        let filtered = allBookings;
        
        // Filter by type
        if (activeFilter !== 'all') {
            filtered = filtered.filter(booking => booking.type === activeFilter);
        }
        
        // Filter by status
        if (activeStatusFilter !== 'all') {
            filtered = filtered.filter(booking => booking.status === activeStatusFilter);
        }
        
        setFilteredBookings(filtered);
    };

    const updateStats = () => {
        const stats = {
            parking: allBookings.filter(b => b.type === 'parking').length,
            garage: allBookings.filter(b => b.type === 'garage').length,
            residence: allBookings.filter(b => b.type === 'residence').length,
            pending: allBookings.filter(b => b.status === 'pending').length,
            active: allBookings.filter(b => 
                b.status === 'confirmed' || 
                b.status === 'active' || 
                b.status === 'in_progress'
            ).length,
            completed: allBookings.filter(b => 
                b.status === 'completed' || 
                b.status === 'delivered'
            ).length,
            total: allBookings.length
        };
        setStats(stats);
    };

    const getStatusColor = (status: BookingStatus) => {
        switch (status) {
            case 'pending':
                return '#FFA500';
            case 'confirmed':
            case 'active':
                return '#4CAF50';
            case 'in_progress':
                return '#2196F3';
            case 'completed':
                return '#666666';
            case 'cancelled':
                return '#FF0000';
            default:
                return colors.gray;
        }
    };

    const getStatusText = (status: BookingStatus) => {
        switch (status) {
            case 'pending':
                return 'Pending';
            case 'confirmed':
                return 'Confirmed';
            case 'active':
                return 'Active';
            case 'in_progress':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status;
        }
    };

    const getTypeIcon = (type: BookingType) => {
        switch (type) {
            case 'parking':
                return 'car-sport';
            case 'garage':
                return 'construct';
            case 'residence':
                return 'home';
            default:
                return 'car';
        }
    };

    const getTypeColor = (type: BookingType) => {
        switch (type) {
            case 'parking':
                return '#2196F3';
            case 'garage':
                return '#FF9800';
            case 'residence':
                return '#4CAF50';
            default:
                return colors.gray;
        }
    };

    const getTypeText = (type: BookingType) => {
        switch (type) {
            case 'parking':
                return 'Parking';
            case 'garage':
                return 'Garage';
            case 'residence':
                return 'Residence';
            default:
                return type;
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    const formatTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid time';
        }
    };

    const formatBookingPeriod = (bookingPeriod?: { from: string; to: string }) => {
        if (!bookingPeriod?.from || !bookingPeriod?.to) return 'N/A';
        
        try {
            const fromDate = new Date(bookingPeriod.from);
            const toDate = new Date(bookingPeriod.to);
            
            const fromTime = fromDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const toTime = toDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `${fromTime} - ${toTime}`;
        } catch (error) {
            return 'N/A';
        }
    };

    const handleBookingPress = (booking: BookingItem) => {
        // Navigate to booking details screen based on type
        let screenPath = '';
        
        switch (booking.type) {
            case 'parking':
                screenPath = '/merchant/parking/bookingDetail';
                break;
            case 'garage':
                screenPath = '/merchant/garage/bookingDetail';
                break;
            case 'residence':
                screenPath = '/merchant/residence/bookingDetail';
                break;
        }
        
        router.push({
            pathname: "/parkingMerchent/BookingDetailScreen",
            params: {
                bookingId: booking.bookingId,
                bookingType: booking.type,
                bookingData: JSON.stringify(booking)
            }
        });
    };

    const handleFilterPress = () => {
        setFilterApplied(!filterApplied);
    };

    const applyTypeFilter = (filter: BookingType | 'all') => {
        setActiveFilter(filter);
    };

    const applyStatusFilter = (filter: BookingStatus | 'all') => {
        setActiveStatusFilter(filter);
    };

    const calculateDuration = (from: string, to: string): string => {
        try {
            const start = new Date(from);
            const end = new Date(to);
            const diffMs = end.getTime() - start.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (diffHours > 0) {
                return `${diffHours}h ${diffMinutes}m`;
            }
            return `${diffMinutes}m`;
        } catch (error) {
            return 'N/A';
        }
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading bookings...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={35} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Parking Bookings</Text>
                <TouchableOpacity 
                    style={[styles.filterButton, filterApplied && styles.filterButtonActive]} 
                    onPress={handleFilterPress}
                >
                    <Ionicons name="filter" size={22} color="#FFF" />
                    <Text style={styles.filterText}>FILTERS</Text>
                </TouchableOpacity>
            </View>


            {/* Filter Options */}
            {filterApplied && (
                <View style={styles.filterOptions}>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.typeFilterScroll}
                    >
                        <TouchableOpacity 
                            style={[styles.filterOption, activeFilter === 'all' && styles.filterOptionActive]}
                            onPress={() => applyTypeFilter('all')}
                        >
                            <Text style={[styles.filterOptionText, activeFilter === 'all' && styles.filterOptionTextActive]}>
                                All Types
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeFilter === 'parking' && styles.filterOptionActive]}
                            onPress={() => applyTypeFilter('parking')}
                        >
                            <Ionicons name="car-sport" size={16} color={activeFilter === 'parking' ? '#FFF' : '#2196F3'} />
                            <Text style={[styles.filterOptionText, activeFilter === 'parking' && styles.filterOptionTextActive]}>
                                Parking
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeFilter === 'garage' && styles.filterOptionActive]}
                            onPress={() => applyTypeFilter('garage')}
                        >
                            <Ionicons name="construct" size={16} color={activeFilter === 'garage' ? '#FFF' : '#FF9800'} />
                            <Text style={[styles.filterOptionText, activeFilter === 'garage' && styles.filterOptionTextActive]}>
                                Garage
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeFilter === 'residence' && styles.filterOptionActive]}
                            onPress={() => applyTypeFilter('residence')}
                        >
                            <Ionicons name="home" size={16} color={activeFilter === 'residence' ? '#FFF' : '#4CAF50'} />
                            <Text style={[styles.filterOptionText, activeFilter === 'residence' && styles.filterOptionTextActive]}>
                                Residence
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>

                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.statusFilterScroll}
                    >
                        <TouchableOpacity 
                            style={[styles.filterOption, activeStatusFilter === 'all' && styles.filterOptionActive]}
                            onPress={() => applyStatusFilter('all')}
                        >
                            <Text style={[styles.filterOptionText, activeStatusFilter === 'all' && styles.filterOptionTextActive]}>
                                All Status
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeStatusFilter === 'pending' && styles.filterOptionActive]}
                            onPress={() => applyStatusFilter('pending')}
                        >
                            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor('pending') }]} />
                            <Text style={[styles.filterOptionText, activeStatusFilter === 'pending' && styles.filterOptionTextActive]}>
                                Pending
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeStatusFilter === 'active' && styles.filterOptionActive]}
                            onPress={() => applyStatusFilter('active')}
                        >
                            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor('active') }]} />
                            <Text style={[styles.filterOptionText, activeStatusFilter === 'active' && styles.filterOptionTextActive]}>
                                Active
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeStatusFilter === 'in_progress' && styles.filterOptionActive]}
                            onPress={() => applyStatusFilter('in_progress')}
                        >
                            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor('in_progress') }]} />
                            <Text style={[styles.filterOptionText, activeStatusFilter === 'in_progress' && styles.filterOptionTextActive]}>
                                In Progress
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeStatusFilter === 'completed' && styles.filterOptionActive]}
                            onPress={() => applyStatusFilter('completed')}
                        >
                            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor('completed') }]} />
                            <Text style={[styles.filterOptionText, activeStatusFilter === 'completed' && styles.filterOptionTextActive]}>
                                Completed
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterOption, activeStatusFilter === 'cancelled' && styles.filterOptionActive]}
                            onPress={() => applyStatusFilter('cancelled')}
                        >
                            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor('cancelled') }]} />
                            <Text style={[styles.filterOptionText, activeStatusFilter === 'cancelled' && styles.filterOptionTextActive]}>
                                Cancelled
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}

            {/* Booking List */}
            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Booking Count */}
                <View style={styles.orderCountContainer}>
                    <Text style={styles.orderCountText}>
                        {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'} found
                    </Text>
                </View>

                {/* Booking Cards */}
                {filteredBookings.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={80} color={colors.gray} />
                        <Text style={styles.emptyText}>No bookings found</Text>
                        <Text style={styles.emptySubText}>
                            {activeFilter === 'all' 
                                ? 'No bookings have been made yet' 
                                : `No ${activeFilter} bookings found`}
                        </Text>
                    </View>
                ) : (
                    filteredBookings.map((booking) => (
                        <TouchableOpacity 
                            key={booking._id} 
                            style={styles.bookingCard}
                            onPress={() => handleBookingPress(booking)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.bookingCardHeader}>
                                <View style={styles.typeBadge}>
                                    <Ionicons 
                                        name={getTypeIcon(booking.type)} 
                                        size={16} 
                                        color={getTypeColor(booking.type)} 
                                    />
                                    <Text style={[styles.typeText, { color: getTypeColor(booking.type) }]}>
                                        {getTypeText(booking.type)}
                                    </Text>
                                </View>
                                <View style={styles.statusContainer}>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
                                    <Text style={[styles.bookingStatus, { color: getStatusColor(booking.status) }]}>
                                        {getStatusText(booking.status)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.bookingInfo}>
                                <Text style={styles.bookingNumber}>{booking.orderNumber}</Text>
                                <Text style={styles.bookingPlace}>
                                    {booking.placeInfo?.name || 'N/A'}
                                </Text>
                            </View>

                            <View style={styles.bookingDetails}>
                                <View style={styles.detailRow}>
                                    <Ionicons name="calendar-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        {formatDate(booking.createdAt)}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="time-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        {formatTime(booking.createdAt)}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="car-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        {booking.vehicleNumber || 'N/A'}
                                    </Text>
                                </View>
                                {booking.bookingPeriod && (
                                    <View style={styles.detailRow}>
                                        <Ionicons name="time" size={16} color={colors.gray} />
                                        <Text style={styles.detailText}>
                                            {formatBookingPeriod(booking.bookingPeriod)}
                                            {booking.bookingPeriod.from && booking.bookingPeriod.to && 
                                                ` (${calculateDuration(booking.bookingPeriod.from, booking.bookingPeriod.to)})`
                                            }
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.detailRow}>
                                    <Ionicons name="cash-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        ₹{booking.totalAmount.toFixed(2)}
                                    </Text>
                                </View>
                            </View>

                            {/* Customer Info */}
                            {booking.user && (
                                <View style={styles.customerInfo}>
                                    <Ionicons name="person-outline" size={16} color={colors.gray} />
                                    <Text style={styles.customerText}>
                                        {booking.user.firstName} {booking.user.lastName}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.bookingCardFooter}>
                                <Text style={styles.viewDetailsText}>View Details</Text>
                                <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        color: colors.gray,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
    },
    headerTitle: {
        fontSize: 20,
        color: colors.black,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    filterButton: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: colors.darkPrimary || '#1976D2',
    },
    filterText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 5,
    },
    statsScroll: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    statBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginRight: 10,
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        minWidth: 100,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    statLabel: {
        fontSize: 12,
        color: colors.gray,
        marginTop: 5,
    },
    filterOptions: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    typeFilterScroll: {
        marginBottom: 10,
    },
    statusFilterScroll: {
        marginBottom: 5,
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F8F8F8',
        marginRight: 10,
    },
    filterOptionActive: {
        backgroundColor: colors.primary,
    },
    filterOptionText: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
        marginLeft: 5,
    },
    filterOptionTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    statusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 5,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 20,
    },
    orderCountContainer: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        marginBottom: 10,
    },
    orderCountText: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    bookingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 15,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    bookingCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F8FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 5,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 5,
    },
    bookingStatus: {
        fontSize: 14,
        fontWeight: '600',
    },
    bookingInfo: {
        marginBottom: 10,
    },
    bookingNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 5,
    },
    bookingPlace: {
        fontSize: 14,
        color: colors.gray,
    },
    bookingDetails: {
        marginBottom: 10,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailText: {
        fontSize: 14,
        color: colors.gray,
        marginLeft: 10,
        flex: 1,
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    customerText: {
        fontSize: 14,
        color: colors.black,
        fontWeight: '500',
        marginLeft: 10,
    },
    bookingCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    viewDetailsText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        color: colors.black,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: colors.gray,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});

export default MerchantParkingOrderHistory;