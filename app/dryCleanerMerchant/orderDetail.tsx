import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

const OrderDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { token, user } = useSelector((state: any) => state.auth);
    
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<any>(null);
    const [cancelling, setCancelling] = useState(false);
    
    // Determine user type
    const isMerchant = user?.userType === 'merchant' || user?.role === 'merchant';
    const hasFetched = React.useRef(false);

   useEffect(() => {
    if (hasFetched.current) return;  // prevents duplicate calls

    if (params.orderId) {
        hasFetched.current = true;
        fetchOrderDetails(params.orderId as string);
    } else if (params.orderData) {
        try {
            const orderData = JSON.parse(params.orderData as string);
            setOrder(orderData);
        } catch (error) {
            Alert.alert('Error', 'Failed to load order details');
            router.back();
        }
    } else {
        Alert.alert('Error', 'No order information provided');
        router.back();
    }
}, []);  // <-- EMPTY dependency (runs only once)


    const fetchOrderDetails = async (orderId: string) => {
        try {
            setLoading(true);
            
            // Use correct endpoint based on user type
            // Since merchant routes are in users router as /merchant-bookings
            const endpoint = isMerchant 
                ? `/users/merchant-bookings/${orderId}`
                : `/users/bookings/${orderId}`;
            
            console.log('Fetching order from:', endpoint);
            
            const response = await axiosInstance.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            console.log('Order details response:', response.data);

            if (response.data.success && response.data.data) {
                const booking = response.data.data;
                
                // Transform backend data to match frontend structure
                const transformedOrder = {
                    _id: booking._id,
                    orderNumber: booking.bookingNumber || `#DRYCL${booking._id.slice(-6)}`,
                    status: booking.status,
                    createdAt: booking.createdAt,
                    items: booking.items || [],
                    totalAmount: booking.totalPrice || booking.totalAmount || 0,
                    pickupAddress: booking.pickupLocation?.address || 'N/A',
                    deliveryAddress: booking.deliveryLocation?.address || 'N/A',
                    pickupTime: booking.pickupTimeSlot || 'N/A',
                    deliveryTime: booking.deliveryTimeSlot || 'N/A',
                    dryCleaner: booking.dryCleaner,
                    driver: booking.driver,
                    user: booking.user,
                    acceptedAt: booking.acceptedAt,
                    inProgressAt: booking.inProgressAt,
                    completedAt: booking.completedAt,
                    deliveredAt: booking.deliveredAt,
                    paymentMethod: booking.paymentMethod || 'Cash on Delivery',
                    paymentStatus: booking.paymentStatus || 'pending',
                    specialInstructions: booking.specialInstructions || booking.notes
                };

                setOrder(transformedOrder);
            } else {
                Alert.alert('Error', 'Order not found');
                // Don't go back if there's no navigation stack
                if (router.canGoBack()) {
                    router.back();
                }
            }
        } catch (error: any) {
            console.error('Error fetching order details:', error);
            console.error('Error response:', error.response?.data);
            
            Alert.alert(
                'Error', 
                error.response?.data?.message || 'Failed to fetch order details'
            );
            
            // Don't go back if there's no navigation stack
            if (router.canGoBack()) {
                router.back();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancelOrder = () => {
        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order?',
            [
                {
                    text: 'No',
                    style: 'cancel'
                },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: confirmCancelOrder
                }
            ]
        );
    };

    const confirmCancelOrder = async () => {
        try {
            setCancelling(true);
            const response = await axiosInstance.patch(
                `/users/bookings/${order._id || order.id}/cancel`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (response.data.success) {
                Alert.alert('Success', 'Order cancelled successfully', [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]);
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            Alert.alert('Error', 'Failed to cancel order. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    const handleContactSupport = () => {
        Alert.alert(
            'Contact Support',
            'Choose how you want to contact support:',
            [
                {
                    text: 'Call',
                    onPress: () => console.log('Call support')
                },
                {
                    text: 'Email',
                    onPress: () => console.log('Email support')
                },
                {
                    text: 'Cancel',
                    style: 'cancel'
                }
            ]
        );
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

    const getStatusDescription = (status: string) => {
        switch (status) {
            case 'pending':
                return 'Your order is waiting to be accepted by the dry cleaner';
            case 'accepted':
                return 'Your order has been accepted and pickup will be scheduled';
            case 'in_progress':
                return 'Your items are being cleaned';
            case 'completed':
                return 'Your order is ready for delivery';
            case 'delivered':
                return 'Your order has been delivered';
            case 'cancelled':
                return 'This order has been cancelled';
            default:
                return '';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
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

    const canCancelOrder = () => {
        return order && (order.status === 'pending' || order.status === 'accepted');
    };

    if (loading || !order) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
                <Text style={styles.loadingText}>Loading order details...</Text>
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
                <Text style={styles.headerTitle}>Order Details</Text>
                <TouchableOpacity 
                    style={styles.supportButton}
                    onPress={handleContactSupport}
                >
                    <Ionicons name="headset-outline" size={24} color={colors.brandColor} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Order Number & Status */}
                <View style={styles.orderHeaderCard}>
                    <View style={styles.orderNumberSection}>
                        <Text style={styles.orderNumberLabel}>Order Number</Text>
                        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                        <Text style={styles.orderDate}>
                            Placed on {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
                        </Text>
                    </View>
                    
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                            {getStatusText(order.status)}
                        </Text>
                    </View>
                    
                    <Text style={styles.statusDescription}>
                        {getStatusDescription(order.status)}
                    </Text>
                </View>

                {/* Order Timeline */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Order Timeline</Text>
                    <View style={styles.timeline}>
                        <View style={styles.timelineItem}>
                            <View style={[styles.timelineCircle, styles.timelineCircleActive]}>
                                <Ionicons name="checkmark" size={16} color="#FFF" />
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>Order Placed</Text>
                                <Text style={styles.timelineDate}>
                                    {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timelineLine} />

                        <View style={styles.timelineItem}>
                            <View style={[
                                styles.timelineCircle, 
                                (order.status === 'accepted' || order.status === 'in_progress' || 
                                 order.status === 'completed' || order.status === 'delivered') && 
                                styles.timelineCircleActive
                            ]}>
                                {(order.status === 'accepted' || order.status === 'in_progress' || 
                                  order.status === 'completed' || order.status === 'delivered') && (
                                    <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>Order Accepted</Text>
                                <Text style={styles.timelineDate}>
                                    {order.acceptedAt ? formatDate(order.acceptedAt) : 'Pending'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timelineLine} />

                        <View style={styles.timelineItem}>
                            <View style={[
                                styles.timelineCircle, 
                                (order.status === 'in_progress' || order.status === 'completed' || 
                                 order.status === 'delivered') && styles.timelineCircleActive
                            ]}>
                                {(order.status === 'in_progress' || order.status === 'completed' || 
                                  order.status === 'delivered') && (
                                    <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>In Progress</Text>
                                <Text style={styles.timelineDate}>
                                    {order.inProgressAt ? formatDate(order.inProgressAt) : 'Pending'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timelineLine} />

                        <View style={styles.timelineItem}>
                            <View style={[
                                styles.timelineCircle, 
                                (order.status === 'completed' || order.status === 'delivered') && 
                                styles.timelineCircleActive
                            ]}>
                                {(order.status === 'completed' || order.status === 'delivered') && (
                                    <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>Completed</Text>
                                <Text style={styles.timelineDate}>
                                    {order.completedAt ? formatDate(order.completedAt) : 'Pending'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timelineLine} />

                        <View style={styles.timelineItem}>
                            <View style={[
                                styles.timelineCircle, 
                                order.status === 'delivered' && styles.timelineCircleActive
                            ]}>
                                {order.status === 'delivered' && (
                                    <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>Delivered</Text>
                                <Text style={styles.timelineDate}>
                                    {order.deliveredAt ? formatDate(order.deliveredAt) : 'Pending'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Items Details */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Items ({order.items.length})</Text>
                    {order.items.map((item: any, index: number) => (
                        <View key={index} style={styles.itemRow}>
                            <View style={styles.itemIconContainer}>
                                <Ionicons name="shirt-outline" size={24} color={colors.brandColor} />
                            </View>
                            <View style={styles.itemDetails}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                            </View>
                            <Text style={styles.itemPrice}>₹{item.price}</Text>
                        </View>
                    ))}
                    
                    <View style={styles.divider} />
                    
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalAmount}>₹{order.totalAmount}</Text>
                    </View>
                </View>

                {/* Pickup Details */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="location-outline" size={24} color={colors.brandColor} />
                        <Text style={styles.sectionTitle}>Pickup Details</Text>
                    </View>
                    <Text style={styles.addressText}>{order.pickupAddress}</Text>
                    <View style={styles.timeSlot}>
                        <Ionicons name="time-outline" size={18} color={colors.gray} />
                        <Text style={styles.timeSlotText}>{order.pickupTime}</Text>
                    </View>
                </View>

                {/* Delivery Details */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="home-outline" size={24} color={colors.brandColor} />
                        <Text style={styles.sectionTitle}>Delivery Details</Text>
                    </View>
                    <Text style={styles.addressText}>{order.deliveryAddress}</Text>
                    <View style={styles.timeSlot}>
                        <Ionicons name="time-outline" size={18} color={colors.gray} />
                        <Text style={styles.timeSlotText}>{order.deliveryTime}</Text>
                    </View>
                </View>

                {/* Additional Information */}
                {order.specialInstructions && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="information-circle-outline" size={24} color={colors.brandColor} />
                            <Text style={styles.sectionTitle}>Special Instructions</Text>
                        </View>
                        <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
                    </View>
                )}

                {/* Payment Information */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="card-outline" size={24} color={colors.brandColor} />
                        <Text style={styles.sectionTitle}>Payment Information</Text>
                    </View>
                    <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Payment Method</Text>
                        <Text style={styles.paymentValue}>
                            {order.paymentMethod || 'Cash on Delivery'}
                        </Text>
                    </View>
                    <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Payment Status</Text>
                        <Text style={[
                            styles.paymentValue,
                            { color: order.paymentStatus === 'paid' ? '#4CAF50' : '#FFA500' }
                        ]}>
                            {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                        </Text>
                    </View>
                </View>

                {/* Spacer for buttons */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                {canCancelOrder() && (
                    <TouchableOpacity 
                        style={styles.cancelButton}
                        onPress={handleCancelOrder}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="close-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.cancelButtonText}>Cancel Order</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                    style={[styles.supportButtonBottom, !canCancelOrder() && { flex: 1 }]}
                    onPress={handleContactSupport}
                >
                    <Ionicons name="headset-outline" size={20} color="#FFF" />
                    <Text style={styles.supportButtonText}>Contact Support</Text>
                </TouchableOpacity>
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
    supportButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    orderHeaderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    orderNumberSection: {
        marginBottom: 15,
    },
    orderNumberLabel: {
        fontSize: 12,
        color: colors.gray,
        marginBottom: 5,
    },
    orderNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 5,
    },
    orderDate: {
        fontSize: 13,
        color: colors.gray,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 10,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statusDescription: {
        fontSize: 14,
        color: colors.gray,
        lineHeight: 20,
    },
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.black,
        marginLeft: 10,
    },
    timeline: {
        marginTop: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    timelineCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    timelineCircleActive: {
        backgroundColor: colors.brandColor,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 5,
    },
    timelineTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.black,
        marginBottom: 3,
    },
    timelineDate: {
        fontSize: 13,
        color: colors.gray,
    },
    timelineLine: {
        width: 2,
        height: 30,
        backgroundColor: '#E0E0E0',
        marginLeft: 15,
        marginVertical: 5,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    itemIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.brandColor + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemDetails: {
        flex: 1,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.black,
        marginBottom: 3,
    },
    itemQuantity: {
        fontSize: 13,
        color: colors.gray,
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.black,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 15,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.black,
    },
    totalAmount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.brandColor,
    },
    addressText: {
        fontSize: 15,
        color: colors.black,
        lineHeight: 22,
        marginBottom: 10,
    },
    timeSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    timeSlotText: {
        fontSize: 14,
        color: colors.gray,
        marginLeft: 8,
        fontWeight: '500',
    },
    instructionsText: {
        fontSize: 14,
        color: colors.gray,
        lineHeight: 20,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    paymentLabel: {
        fontSize: 14,
        color: colors.gray,
    },
    paymentValue: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.black,
    },
    actionButtons: {
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
        gap: 10,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#FF5252',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#FF5252',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    cancelButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    supportButtonBottom: {
        flex: 1,
        backgroundColor: colors.brandColor,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: colors.brandColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    supportButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default OrderDetails;