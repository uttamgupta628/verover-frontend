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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

type BookingType = 'drycleaner' | 'garage' | 'parkinglot' | 'residence';

interface UnifiedBooking {
    _id: string;
    type: BookingType;
    bookingNumber: string;
    status: string;
    createdAt: string;
    totalAmount: number;
    customerName: string;
    customerPhone?: string;
    // Parking specific
    vehicleNumber?: string;
    bookedSlot?: string;
    garageName?: string;
    parkingName?: string;
    residenceName?: string;
    bookingPeriod?: {
        from?: string;
        to?: string;
        startTime?: string;
        endTime?: string;
    };
    // Dry cleaner specific
    items?: any[];
    pickupAddress?: string;
    deliveryAddress?: string;
    pickupTime?: string;
    deliveryTime?: string;
}

const MerchantAllBookings = () => {
    const router = useRouter();
    const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [allBookings, setAllBookings] = useState<UnifiedBooking[]>([]);
    const [filteredBookings, setFilteredBookings] = useState<UnifiedBooking[]>([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [activeTypeFilter, setActiveTypeFilter] = useState<BookingType | 'all'>('all');
    const [filterApplied, setFilterApplied] = useState(false);

    useEffect(() => {
        if (isAuthenticated && token) {
            fetchAllBookings();
        }
    }, [isAuthenticated, token]);

    useEffect(() => {
        filterBookings();
    }, [allBookings, activeFilter, activeTypeFilter]);



const fetchAllBookings = async () => {
    try {
        setLoading(true);
        
        const [garageRes, lotRes, residenceRes, dryCleanerRes] = await Promise.allSettled([
            axiosInstance.get('/merchants/garage/booking', {
                headers: { 'Authorization': token }
            }),
            axiosInstance.get('/merchants/parkinglot/booking', {
                headers: { 'Authorization': token }
            }),
            axiosInstance.get('/merchants/residence/booking', {
                headers: { 'Authorization': token }
            }),
            axiosInstance.get('/users/merchants/bookings', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        const unified: UnifiedBooking[] = [];

        const safeArray = (data: any): any[] => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (Array.isArray(data.data)) return data.data;
            if (Array.isArray(data.bookings)) return data.bookings;
            return [];
        };

        if (garageRes.status === 'fulfilled' && garageRes.value.data?.success) {
            const garageBookings = safeArray(garageRes.value.data.data);
            console.log('Garage bookings count:', garageBookings.length);
            
            garageBookings.forEach((booking: any) => {
                unified.push({
                    _id: booking._id,
                    type: 'garage',
                    bookingNumber: `#GRG${booking._id.slice(-6)}`,
                    status: booking.paymentDetails?.status || 'pending',
                    createdAt: booking.createdAt,
                    totalAmount: booking.totalAmount || 0,
                    customerName: `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim() || 'N/A',
                    customerPhone: booking.customerId?.phoneNumber,
                    vehicleNumber: booking.vehicleNumber,
                    bookedSlot: `Zone ${booking.bookedSlot?.zone || 'A'} - Slot ${booking.bookedSlot?.slot || '1'}`,
                    garageName: booking.garageId?.garageName || 'N/A',
                    bookingPeriod: {
                        from: booking.bookingPeriod?.startTime,
                        to: booking.bookingPeriod?.endTime,
                    }
                });
            });
        } else if (garageRes.status === 'rejected') {
            console.warn('Garage bookings fetch failed:', garageRes.reason);
        }

        if (lotRes.status === 'fulfilled' && lotRes.value.data?.success) {
            const lotBookings = safeArray(lotRes.value.data.data);
            console.log('Parking lot bookings count:', lotBookings.length);
            
            lotBookings.forEach((booking: any) => {
                unified.push({
                    _id: booking._id,
                    type: 'parkinglot',
                    bookingNumber: `#LOT${booking._id.slice(-6)}`,
                    status: booking.paymentDetails?.status || 'pending',
                    createdAt: booking.createdAt,
                    totalAmount: booking.totalAmount || 0,
                    customerName: `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim() || 'N/A',
                    customerPhone: booking.customerId?.phoneNumber,
                    vehicleNumber: booking.vehicleNumber,
                    bookedSlot: `Zone ${booking.bookedSlot?.zone || 'A'} - Slot ${booking.bookedSlot?.slot || '1'}`,
                    parkingName: booking.lotId?.parkingName || 'N/A',
                    bookingPeriod: {
                        from: booking.bookingPeriod?.startTime,
                        to: booking.bookingPeriod?.endTime,
                    }
                });
            });
        } else if (lotRes.status === 'rejected') {
            console.warn('Parking lot bookings fetch failed:', lotRes.reason);
        }

        if (residenceRes.status === 'fulfilled' && residenceRes.value.data?.success) {
            const residenceBookings = safeArray(residenceRes.value.data.data);
            console.log('Residence bookings count:', residenceBookings.length);
            
            residenceBookings.forEach((booking: any) => {
                unified.push({
                    _id: booking._id,
                    type: 'residence',
                    bookingNumber: `#RES${booking._id.slice(-6)}`,
                    status: booking.paymentDetails?.status || 'pending',
                    createdAt: booking.createdAt,
                    totalAmount: booking.totalAmount || 0,
                    customerName: `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim() || 'N/A',
                    customerPhone: booking.customerId?.phoneNumber,
                    vehicleNumber: booking.vehicleNumber,
                    residenceName: booking.residenceId?.residenceName || 'N/A',
                    bookingPeriod: {
                        from: booking.bookingPeriod?.startTime,
                        to: booking.bookingPeriod?.endTime,
                    }
                });
            });
        } else if (residenceRes.status === 'rejected') {
            console.warn('Residence bookings fetch failed:', residenceRes.reason);
        }

        if (dryCleanerRes.status === 'fulfilled' && dryCleanerRes.value.data?.success) {
            const dryCleanerBookings = safeArray(dryCleanerRes.value.data.data);
            console.log('Dry cleaner bookings count:', dryCleanerBookings.length);
            
            dryCleanerBookings.forEach((booking: any) => {
                unified.push({
                    _id: booking._id,
                    type: 'drycleaner',
                    bookingNumber: booking.bookingNumber || `#DRY${booking._id.slice(-6)}`,
                    status: booking.status,
                    createdAt: booking.createdAt,
                    totalAmount: booking.totalPrice || booking.totalAmount || 0,
                    customerName: booking.user ? `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() : 'N/A',
                    customerPhone: booking.user?.phoneNumber,
                    items: booking.items || [],
                    pickupAddress: booking.pickupLocation?.address || 'N/A',
                    deliveryAddress: booking.deliveryLocation?.address || 'N/A',
                    pickupTime: booking.pickupTimeSlot || 'N/A',
                    deliveryTime: booking.deliveryTimeSlot || 'N/A',
                });
            });
        } else if (dryCleanerRes.status === 'rejected') {
            console.warn('Dry cleaner bookings fetch failed:', dryCleanerRes.reason);
        }

        // Sort by date (newest first)
        unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setAllBookings(unified);
        console.log('✅ Total unified bookings:', unified.length);
    } catch (error: any) {
        console.error('❌ Error fetching bookings:', error);
        setAllBookings([]);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
};

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllBookings();
    };

    const filterBookings = () => {
        let filtered = allBookings;
        
        // Filter by type
        if (activeTypeFilter !== 'all') {
            filtered = filtered.filter(booking => booking.type === activeTypeFilter);
        }

        // Filter by status
        switch (activeFilter) {
            case 'active':
                filtered = filtered.filter(booking => 
                    booking.status === 'pending' || 
                    booking.status === 'accepted' || 
                    booking.status === 'in_progress' ||
                    booking.status === 'confirmed'
                );
                break;
            case 'completed':
                filtered = filtered.filter(booking => 
                    booking.status === 'completed' || 
                    booking.status === 'delivered'
                );
                break;
            default:
                break;
        }
        
        setFilteredBookings(filtered);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return '#FFA500';
            case 'accepted':
            case 'confirmed':
                return '#4CAF50';
            case 'in_progress':
                return '#2196F3';
            case 'completed':
                return '#666666';
            case 'delivered':
                return '#4CAF50';
            case 'cancelled':
                return '#FF0000';
            default:
                return colors.gray;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending':
                return 'Pending';
            case 'accepted':
                return 'Accepted';
            case 'confirmed':
                return 'Confirmed';
            case 'in_progress':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'delivered':
                return 'Delivered';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status;
        }
    };

    const getTypeIcon = (type: BookingType) => {
        switch (type) {
            case 'garage':
                return 'car-sport';
            case 'parkinglot':
                return 'car';
            case 'residence':
                return 'home';
            case 'drycleaner':
                return 'shirt';
            default:
                return 'receipt';
        }
    };

    const getTypeLabel = (type: BookingType) => {
        switch (type) {
            case 'garage':
                return 'Garage';
            case 'parkinglot':
                return 'Parking Lot';
            case 'residence':
                return 'Residence';
            case 'drycleaner':
                return 'Dry Cleaner';
            default:
                return type;
        }
    };

    const getTypeColor = (type: BookingType) => {
        switch (type) {
            case 'garage':
                return '#2196F3';
            case 'parkinglot':
                return '#4CAF50';
            case 'residence':
                return '#9C27B0';
            case 'drycleaner':
                return '#FF9800';
            default:
                return colors.gray;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const calculateTotalItems = (items: any[]) => {
        if (!items || items.length === 0) return 0;
        return items.reduce((total, item) => total + (item.quantity || 0), 0);
    };

    const handleBookingPress = (booking: UnifiedBooking) => {
        if (booking.type === 'drycleaner') {
            router.push({
                pathname: '/dryCleanerMerchant/orderDetail',
                params: {
                    orderId: booking._id,
                    orderData: JSON.stringify(booking)
                }
            });
        } else {
            // Navigate to parking booking details
            router.push({
                pathname: '/bookingDetails',
                params: {
                    bookingData: JSON.stringify(booking)
                }
            });
        }
    };

    const handleFilterPress = () => {
        setFilterApplied(!filterApplied);
    };

    const applyStatusFilter = (filter: string) => {
        setActiveFilter(filter);
    };

    const applyTypeFilter = (type: BookingType | 'all') => {
        setActiveTypeFilter(type);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
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
                    <Ionicons name="arrow-back" size={35} color={colors.brandColor} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Bookings</Text>
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
                <View style={styles.filterContainer}>
                    {/* Type Filter */}
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScrollView}
                    >
                        <TouchableOpacity 
                            style={[styles.filterChip, activeTypeFilter === 'all' && styles.filterChipActive]}
                            onPress={() => applyTypeFilter('all')}
                        >
                            <Text style={[styles.filterChipText, activeTypeFilter === 'all' && styles.filterChipTextActive]}>
                                All Types
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterChip, activeTypeFilter === 'garage' && styles.filterChipActive]}
                            onPress={() => applyTypeFilter('garage')}
                        >
                            <Ionicons name="car-sport" size={16} color={activeTypeFilter === 'garage' ? '#FFF' : colors.gray} />
                            <Text style={[styles.filterChipText, activeTypeFilter === 'garage' && styles.filterChipTextActive]}>
                                Garage
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterChip, activeTypeFilter === 'parkinglot' && styles.filterChipActive]}
                            onPress={() => applyTypeFilter('parkinglot')}
                        >
                            <Ionicons name="car" size={16} color={activeTypeFilter === 'parkinglot' ? '#FFF' : colors.gray} />
                            <Text style={[styles.filterChipText, activeTypeFilter === 'parkinglot' && styles.filterChipTextActive]}>
                                Parking Lot
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterChip, activeTypeFilter === 'residence' && styles.filterChipActive]}
                            onPress={() => applyTypeFilter('residence')}
                        >
                            <Ionicons name="home" size={16} color={activeTypeFilter === 'residence' ? '#FFF' : colors.gray} />
                            <Text style={[styles.filterChipText, activeTypeFilter === 'residence' && styles.filterChipTextActive]}>
                                Residence
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterChip, activeTypeFilter === 'drycleaner' && styles.filterChipActive]}
                            onPress={() => applyTypeFilter('drycleaner')}
                        >
                            <Ionicons name="shirt" size={16} color={activeTypeFilter === 'drycleaner' ? '#FFF' : colors.gray} />
                            <Text style={[styles.filterChipText, activeTypeFilter === 'drycleaner' && styles.filterChipTextActive]}>
                                Dry Cleaner
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Status Filter */}
                    <View style={styles.statusFilterRow}>
                        <TouchableOpacity 
                            style={[styles.statusFilterChip, activeFilter === 'all' && styles.statusFilterChipActive]}
                            onPress={() => applyStatusFilter('all')}
                        >
                            <Text style={[styles.statusFilterText, activeFilter === 'all' && styles.statusFilterTextActive]}>
                                All
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.statusFilterChip, activeFilter === 'active' && styles.statusFilterChipActive]}
                            onPress={() => applyStatusFilter('active')}
                        >
                            <Text style={[styles.statusFilterText, activeFilter === 'active' && styles.statusFilterTextActive]}>
                                Active
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.statusFilterChip, activeFilter === 'completed' && styles.statusFilterChipActive]}
                            onPress={() => applyStatusFilter('completed')}
                        >
                            <Text style={[styles.statusFilterText, activeFilter === 'completed' && styles.statusFilterTextActive]}>
                                Completed
                            </Text>
                        </TouchableOpacity>
                    </View>
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
                        colors={[colors.brandColor]}
                        tintColor={colors.brandColor}
                    />
                }
            >
                {/* Booking Count */}
                <View style={styles.bookingCountContainer}>
                    <Text style={styles.bookingCountText}>
                        {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'} found
                    </Text>
                </View>

                {/* Booking Cards */}
                {filteredBookings.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={80} color={colors.gray} />
                        <Text style={styles.emptyText}>No bookings found</Text>
                        <Text style={styles.emptySubText}>
                            {activeTypeFilter !== 'all' 
                                ? `No ${getTypeLabel(activeTypeFilter as BookingType)} bookings found`
                                : 'No bookings have been made yet'}
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
                            {/* Type Badge */}
                            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(booking.type) }]}>
                                <Ionicons name={getTypeIcon(booking.type)} size={16} color="#FFF" />
                                <Text style={styles.typeBadgeText}>{getTypeLabel(booking.type)}</Text>
                            </View>

                            <View style={styles.bookingCardHeader}>
                                <View>
                                    <Text style={styles.bookingLabel}>Booking Number</Text>
                                    <Text style={styles.bookingNumber}>{booking.bookingNumber}</Text>
                                </View>
                                <View style={styles.statusContainer}>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
                                    <Text style={[styles.bookingStatus, { color: getStatusColor(booking.status) }]}>
                                        {getStatusText(booking.status)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.bookingDetails}>
                                {/* Common Details */}
                                <View style={styles.detailRow}>
                                    <Ionicons name="person-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>{booking.customerName}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="calendar-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>{formatDate(booking.createdAt)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="time-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>{formatTime(booking.createdAt)}</Text>
                                </View>

                                {/* Parking Specific */}
                                {(booking.type === 'garage' || booking.type === 'parkinglot' || booking.type === 'residence') && (
                                    <>
                                        {booking.vehicleNumber && (
                                            <View style={styles.detailRow}>
                                                <MaterialCommunityIcons name="car-info" size={16} color={colors.gray} />
                                                <Text style={styles.detailText}>{booking.vehicleNumber}</Text>
                                            </View>
                                        )}
                                        {booking.bookedSlot && (
                                            <View style={styles.detailRow}>
                                                <MaterialCommunityIcons name="parking" size={16} color={colors.gray} />
                                                <Text style={styles.detailText}>{booking.bookedSlot}</Text>
                                            </View>
                                        )}
                                        {(booking.garageName || booking.parkingName || booking.residenceName) && (
                                            <View style={styles.detailRow}>
                                                <Ionicons name="location-outline" size={16} color={colors.gray} />
                                                <Text style={styles.detailText}>
                                                    {booking.garageName || booking.parkingName || booking.residenceName}
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                )}

                                {/* Dry Cleaner Specific */}
                                {booking.type === 'drycleaner' && (
                                    <View style={styles.detailRow}>
                                        <Ionicons name="shirt-outline" size={16} color={colors.gray} />
                                        <Text style={styles.detailText}>
                                            {calculateTotalItems(booking.items || [])} items
                                        </Text>
                                    </View>
                                )}

                                {/* Amount */}
                                <View style={styles.detailRow}>
                                    <Ionicons name="cash-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>₹{booking.totalAmount}</Text>
                                </View>
                            </View>

                            <View style={styles.bookingCardFooter}>
                                <Text style={styles.viewDetailsText}>View Details</Text>
                                <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Stats Summary */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                        {allBookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length}
                    </Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                        {allBookings.filter(b => b.status === 'in_progress' || b.status === 'accepted').length}
                    </Text>
                    <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                        {allBookings.filter(b => b.status === 'completed' || b.status === 'delivered').length}
                    </Text>
                    <Text style={styles.statLabel}>Completed</Text>
                </View>
            </View>
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
        paddingTop: 60,
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
        backgroundColor: colors.brandColor,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: colors.darkBrand || '#E67A00',
    },
    filterText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 5,
    },
    filterContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        elevation: 1,
    },
    filterScrollView: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F8F8F8',
        marginRight: 10,
        gap: 5,
    },
    filterChipActive: {
        backgroundColor: colors.brandColor,
    },
    filterChipText: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    statusFilterRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 10,
    },
    statusFilterChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F8F8F8',
        alignItems: 'center',
    },
    statusFilterChipActive: {
        backgroundColor: colors.brandColor,
    },
    statusFilterText: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    statusFilterTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 100,
    },
    bookingCountContainer: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        marginBottom: 10,
    },
    bookingCountText: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    bookingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 12,
        gap: 5,
    },
    typeBadgeText: {
        fontSize: 12,
        color: '#FFF',
        fontWeight: '600',
    },
    bookingCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bookingLabel: {
        fontSize: 12,
        color: colors.gray,
        marginBottom: 4,
    },
    bookingNumber: {
        fontSize: 16,
        color: colors.black,
        fontWeight: 'bold',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    bookingStatus: {
        fontSize: 12,
        fontWeight: '600',
    },
    bookingDetails: {
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: colors.black,
        flex: 1,
    },
    bookingCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    viewDetailsText: {
        fontSize: 14,
        color: colors.brandColor,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 18,
        color: colors.gray,
        fontWeight: '600',
        marginTop: 15,
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: colors.lightGray,
        textAlign: 'center',
        maxWidth: 250,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 30,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    statNumber: {
        fontSize: 22,
        color: colors.brandColor,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: colors.gray,
        fontWeight: '500',
    },
});

export default MerchantAllBookings;