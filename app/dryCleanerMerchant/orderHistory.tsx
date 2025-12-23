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
import { Ionicons } from '@expo/vector-icons';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

const MerchantOrderHistory = () => {
    const router = useRouter();
    const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [filterApplied, setFilterApplied] = useState(false);

    useEffect(() => {
        if (isAuthenticated && token) {
            fetchOrders();
        }
    }, [isAuthenticated, token]);

    useEffect(() => {
        filterOrders();
    }, [orders, activeFilter]);

    // Helper function to format address
    const formatAddress = (location: any) => {
        if (!location) return 'N/A';
        
        // If address is already a string
        if (typeof location.address === 'string') {
            return location.address;
        }
        
        // If address is an object, format it
        if (typeof location.address === 'object') {
            const addr = location.address;
            const parts = [
                addr.street,
                addr.city,
                addr.state,
                addr.zipCode,
                addr.country
            ].filter(Boolean);
            return parts.length > 0 ? parts.join(', ') : 'N/A';
        }
        
        return 'N/A';
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            
            const response = await axiosInstance.get('/users/merchants/bookings', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                params: {
                    page: 1,
                    limit: 100,
                }
            });

            console.log('Merchant API Response:', response.data);

            if (response.data.success) {
                const bookings = response.data.data?.bookings || response.data.data || [];
                
                // Transform backend data to match frontend structure
                const transformedOrders = bookings.map((booking: any) => {
                    // Handle different field names from backend
                    const orderNumber = booking.orderNumber || booking.bookingNumber || `#DRYCL${booking._id?.slice(-6) || ''}`;
                    const createdDate = booking.createdAt || booking.requestedAt || new Date().toISOString();
                    
                    // Handle items - could be orderItems or items
                    const items = booking.orderItems || booking.items || [];
                    
                    // Handle total amount from different possible fields
                    const totalAmount = 
                        booking.pricing?.totalAmount || 
                        booking.price || 
                        booking.totalPrice || 
                        booking.totalAmount || 
                        0;
                    
                    // Handle addresses - could be string or object
                    const pickupAddress = 
                        (typeof booking.pickupAddress === 'string' ? booking.pickupAddress : null) ||
                        formatAddress(booking.pickupLocation) ||
                        'N/A';
                    
                    const deliveryAddress = 
                        (typeof booking.dropoffAddress === 'string' ? booking.dropoffAddress : null) ||
                        (typeof booking.deliveryAddress === 'string' ? booking.deliveryAddress : null) ||
                        formatAddress(booking.deliveryLocation) ||
                        'N/A';
                    
                    return {
                        _id: booking._id,
                        orderNumber,
                        status: booking.status,
                        createdAt: createdDate,
                        items,
                        totalAmount,
                        pickupAddress,
                        deliveryAddress,
                        pickupTime: booking.scheduledPickupDateTime || booking.pickupTimeSlot || 'N/A',
                        deliveryTime: booking.scheduledDeliveryDateTime || booking.deliveryTimeSlot || 'N/A',
                        user: booking.user,
                        driver: booking.driver,
                        paymentMethod: booking.paymentMethod,
                        paymentStatus: booking.paymentStatus,
                        specialInstructions: booking.specialInstructions,
                        orderSummary: booking.orderSummary,
                        totalItems: booking.totalItems
                    };
                });

                setOrders(transformedOrders);
                console.log('Fetched merchant orders:', transformedOrders.length);
                if (transformedOrders.length > 0) {
                    console.log('Sample order:', transformedOrders[0]);
                }
            } else {
                console.warn('No orders found in response');
                setOrders([]);
            }
        } catch (error: any) {
            console.error('Error fetching orders:', error);
            console.error('Error response:', error.response?.data);
            console.error('Request URL:', error.config?.url);
            console.error('Base URL:', error.config?.baseURL);
            
            if (error.response?.status === 404) {
                console.log('Merchant bookings endpoint not found - check backend routes');
            } else if (error.response?.status === 403) {
                console.log('Authorization error - ensure you are logged in as merchant');
            }
            
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const filterOrders = () => {
        let filtered = orders;
        
        switch (activeFilter) {
            case 'active':
                filtered = orders.filter(order => 
                    order.status === 'pending' || 
                    order.status === 'accepted' || 
                    order.status === 'in_progress'
                );
                break;
            case 'completed':
                filtered = orders.filter(order => 
                    order.status === 'completed' || 
                    order.status === 'delivered'
                );
                break;
            default:
                break;
        }
        
        setFilteredOrders(filtered);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return '#FFA500';
            case 'accepted':
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

    const calculateTotalItems = (order: any) => {
        // If backend provides totalItems, use it directly
        if (order.totalItems && typeof order.totalItems === 'number') {
            return order.totalItems;
        }
        
        // Otherwise calculate from items array
        const items = order.items || [];
        if (items.length === 0) return 0;
        
        return items.reduce((total: number, item: any) => {
            const quantity = item.quantity || item.count || 1;
            return total + quantity;
        }, 0);
    };

    const handleOrderPress = (order: any) => {
        router.push({
            pathname: '/dryCleanerMerchant/orderDetail',
            params: {
                orderId: order._id,
                orderData: JSON.stringify(order)
            }
        });
    };

    const handleFilterPress = () => {
        setFilterApplied(!filterApplied);
    };

    const applyFilter = (filter: string) => {
        setActiveFilter(filter);
        setFilterApplied(false);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
                <Text style={styles.loadingText}>Loading orders...</Text>
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
                <Text style={styles.headerTitle}>Order History</Text>
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
                    <TouchableOpacity 
                        style={[styles.filterOption, activeFilter === 'all' && styles.filterOptionActive]}
                        onPress={() => applyFilter('all')}
                    >
                        <Text style={[styles.filterOptionText, activeFilter === 'all' && styles.filterOptionTextActive]}>
                            All Orders
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterOption, activeFilter === 'active' && styles.filterOptionActive]}
                        onPress={() => applyFilter('active')}
                    >
                        <Text style={[styles.filterOptionText, activeFilter === 'active' && styles.filterOptionTextActive]}>
                            Active Orders
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterOption, activeFilter === 'completed' && styles.filterOptionActive]}
                        onPress={() => applyFilter('completed')}
                    >
                        <Text style={[styles.filterOptionText, activeFilter === 'completed' && styles.filterOptionTextActive]}>
                            Completed
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Order List */}
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
                {/* Order Count */}
                <View style={styles.orderCountContainer}>
                    <Text style={styles.orderCountText}>
                        {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
                    </Text>
                </View>

                {/* Order Cards */}
                {filteredOrders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={80} color={colors.gray} />
                        <Text style={styles.emptyText}>No orders found</Text>
                        <Text style={styles.emptySubText}>
                            {activeFilter === 'all' 
                                ? 'No orders have been placed yet' 
                                : `No ${activeFilter} orders found`}
                        </Text>
                    </View>
                ) : (
                    filteredOrders.map((order) => (
                        <TouchableOpacity 
                            key={order._id} 
                            style={styles.orderCard}
                            onPress={() => handleOrderPress(order)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.orderCardHeader}>
                                <View>
                                    <Text style={styles.orderLabel}>Order Number</Text>
                                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                                </View>
                                <View style={styles.statusContainer}>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                                    <Text style={[styles.orderStatus, { color: getStatusColor(order.status) }]}>
                                        {getStatusText(order.status)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.orderDetails}>
                                <View style={styles.detailRow}>
                                    <Ionicons name="calendar-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        {formatDate(order.createdAt)}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="time-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        {formatTime(order.createdAt)}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="shirt-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        {calculateTotalItems(order)} items
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="cash-outline" size={16} color={colors.gray} />
                                    <Text style={styles.detailText}>
                                        ${order.totalAmount}
                                    </Text>
                                </View>
                            </View>

                            {/* Customer Info for Merchant */}
                            {order.user && (
                                <View style={styles.customerInfo}>
                                    <Ionicons name="person-outline" size={16} color={colors.gray} />
                                    <Text style={styles.customerText}>
                                        {order.user.firstName} {order.user.lastName}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.orderCardFooter}>
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
                    <Text style={styles.statNumber}>{orders.filter(o => o.status === 'pending').length}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{orders.filter(o => o.status === 'in_progress').length}</Text>
                    <Text style={styles.statLabel}>In Progress</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{orders.filter(o => o.status === 'completed').length}</Text>
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
    filterOptions: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    filterOption: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F8F8F8',
        marginRight: 10,
    },
    filterOptionActive: {
        backgroundColor: colors.brandColor,
    },
    filterOptionText: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    filterOptionTextActive: {
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
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    orderCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    orderLabel: {
        fontSize: 12,
        color: colors.gray,
        marginBottom: 2,
    },
    orderNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 5,
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
    orderStatus: {
        fontSize: 14,
        fontWeight: '600',
    },
    orderDetails: {
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
    orderCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    viewDetailsText: {
        fontSize: 14,
        color: colors.brandColor,
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
    statsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statBox: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.brandColor,
    },
    statLabel: {
        fontSize: 12,
        color: colors.gray,
        marginTop: 5,
    },
});

export default MerchantOrderHistory;