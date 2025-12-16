import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

type BookingType = 'drycleaner' | 'garage' | 'parkinglot' | 'residence';

interface BookingData {
    _id: string;
    type: BookingType;
    bookingNumber: string;
    orderNumber?: string;
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
    priceRate?: number;
    // Dry cleaner specific
    items?: any[];
    pickupAddress?: string;
    deliveryAddress?: string;
    pickupTime?: string;
    deliveryTime?: string;
    dryCleaner?: any;
    driver?: any;
    user?: any;
    acceptedAt?: string;
    inProgressAt?: string;
    completedAt?: string;
    deliveredAt?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    specialInstructions?: string;
}

const OrderDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { token, user } = useSelector((state: any) => state.auth);
    
    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState<BookingData | null>(null);
    const [cancelling, setCancelling] = useState(false);
    
    const hasFetched = useRef(false);
    const isMerchant = user?.userType === 'merchant' || user?.role === 'merchant';

    useEffect(() => {
        if (hasFetched.current) return;

        if (params.bookingData || params.orderData) {
            try {
                const dataStr = (params.bookingData || params.orderData) as string;
                const parsedData = JSON.parse(Array.isArray(dataStr) ? dataStr[0] : dataStr);
                setBooking(parsedData);
                hasFetched.current = true;
            } catch (error) {
                console.error('Error parsing booking data:', error);
                Alert.alert('Error', 'Failed to load booking details');
                router.back();
            }
        } else if (params.orderId || params.bookingId) {
            hasFetched.current = true;
            fetchBookingDetails((params.orderId || params.bookingId) as string);
        } else {
            Alert.alert('Error', 'No booking information provided');
            router.back();
        }
    }, []);

    const fetchBookingDetails = async (id: string) => {
        try {
            setLoading(true);
            
            // Determine endpoint based on booking type
            let endpoint = `/users/bookings/${id}`;
            if (isMerchant) {
                endpoint = `/users/merchant-bookings/${id}`;
            }
            
            console.log('Fetching booking from:', endpoint);
            
            const response = await axiosInstance.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            console.log('Booking details response:', response.data);

            if (response.data.success && response.data.data) {
                setBooking(response.data.data);
            } else {
                Alert.alert('Error', 'Booking not found');
                if (router.canGoBack()) {
                    router.back();
                }
            }
        } catch (error: any) {
            console.error('Error fetching booking details:', error);
            Alert.alert(
                'Error', 
                error.response?.data?.message || 'Failed to fetch booking details'
            );
            if (router.canGoBack()) {
                router.back();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBooking = () => {
        Alert.alert(
            'Cancel Booking',
            'Are you sure you want to cancel this booking?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: confirmCancelBooking
                }
            ]
        );
    };

    const confirmCancelBooking = async () => {
        try {
            setCancelling(true);
            const endpoint = booking?.type === 'drycleaner'
                ? `/users/bookings/${booking._id}/cancel`
                : `/merchants/${booking?.type}/booking/${booking?._id}/cancel`;

            const response = await axiosInstance.patch(
                endpoint,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (response.data.success) {
                Alert.alert('Success', 'Booking cancelled successfully', [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]);
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            Alert.alert('Error', 'Failed to cancel booking. Please try again.');
        } finally {
            setCancelling(false);
        }
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
        const statusMap: { [key: string]: string } = {
            pending: 'Pending',
            accepted: 'Accepted',
            confirmed: 'Confirmed',
            in_progress: 'In Progress',
            completed: 'Completed',
            delivered: 'Delivered',
            cancelled: 'Cancelled',
        };
        return statusMap[status] || status;
    };

    const getTypeLabel = (type: BookingType) => {
        const typeMap = {
            garage: 'Garage Parking',
            parkinglot: 'Parking Lot',
            residence: 'Residence Parking',
            drycleaner: 'Dry Cleaner',
        };
        return typeMap[type] || type;
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

    const formatDateTime = (dateString: string) => {
        return `${formatDate(dateString)} at ${formatTime(dateString)}`;
    };

    const calculateDuration = (from?: string, to?: string) => {
        if (!from || !to) return 'N/A';
        const start = new Date(from);
        const end = new Date(to);
        const diffMs = end.getTime() - start.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    const canCancelBooking = () => {
        return booking && (
            booking.status === 'pending' || 
            booking.status === 'accepted' ||
            booking.status === 'confirmed'
        );
    };

    if (loading || !booking) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brandColor} />
                <Text style={styles.loadingText}>Loading booking details...</Text>
            </View>
        );
    }

    const isParkingBooking = ['garage', 'parkinglot', 'residence'].includes(booking.type);

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
                <Text style={styles.headerTitle}>Booking Details</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Booking Header Card */}
                <View style={styles.headerCard}>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{getTypeLabel(booking.type)}</Text>
                    </View>
                    
                    <Text style={styles.bookingNumberLabel}>Booking Number</Text>
                    <Text style={styles.bookingNumber}>
                        {booking.bookingNumber || booking.orderNumber}
                    </Text>
                    <Text style={styles.bookingDate}>
                        Placed on {formatDateTime(booking.createdAt)}
                    </Text>
                    
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                            {getStatusText(booking.status)}
                        </Text>
                    </View>
                </View>

                {/* Customer Information */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person-outline" size={24} color={colors.brandColor} />
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Name:</Text>
                        <Text style={styles.infoValue}>{booking.customerName}</Text>
                    </View>
                    {booking.customerPhone && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Phone:</Text>
                            <Text style={styles.infoValue}>{booking.customerPhone}</Text>
                        </View>
                    )}
                </View>

                {/* Parking Booking Details */}
                {isParkingBooking && (
                    <>
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeader}>
                                <MaterialCommunityIcons name="parking" size={24} color={colors.brandColor} />
                                <Text style={styles.sectionTitle}>Parking Details</Text>
                            </View>
                            
                            {(booking.garageName || booking.parkingName || booking.residenceName) && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Location:</Text>
                                    <Text style={styles.infoValue}>
                                        {booking.garageName || booking.parkingName || booking.residenceName}
                                    </Text>
                                </View>
                            )}
                            
                            {booking.vehicleNumber && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Vehicle:</Text>
                                    <Text style={styles.infoValue}>{booking.vehicleNumber}</Text>
                                </View>
                            )}
                            
                            {booking.bookedSlot && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Slot:</Text>
                                    <Text style={styles.infoValue}>{booking.bookedSlot}</Text>
                                </View>
                            )}
                            
                            {booking.bookingPeriod && (
                                <>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Check-in:</Text>
                                        <Text style={styles.infoValue}>
                                            {formatDateTime(booking.bookingPeriod.from || booking.bookingPeriod.startTime || '')}
                                        </Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Check-out:</Text>
                                        <Text style={styles.infoValue}>
                                            {formatDateTime(booking.bookingPeriod.to || booking.bookingPeriod.endTime || '')}
                                        </Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Duration:</Text>
                                        <Text style={styles.infoValue}>
                                            {calculateDuration(
                                                booking.bookingPeriod.from || booking.bookingPeriod.startTime,
                                                booking.bookingPeriod.to || booking.bookingPeriod.endTime
                                            )}
                                        </Text>
                                    </View>
                                </>
                            )}
                            
                            {booking.priceRate && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Rate:</Text>
                                    <Text style={styles.infoValue}>₹{booking.priceRate}/hour</Text>
                                </View>
                            )}
                        </View>
                    </>
                )}

                {/* Dry Cleaner Details */}
{booking.type === 'drycleaner' && (
    <>
        {/* Items Section */}
        {booking.items && booking.items.length > 0 && (
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="shirt-outline" size={24} color={colors.brandColor} />
                    <Text style={styles.sectionTitle}>Order Items</Text>
                </View>
                <View style={styles.itemsCountBadge}>
                    <Text style={styles.itemsCountText}>
                        {booking.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)} Total Items
                    </Text>
                </View>
                {booking.items.map((item: any, index: number) => (
                    <View key={index} style={styles.itemRow}>
                        <View style={styles.itemIconContainer}>
                            <Ionicons name="shirt" size={20} color={colors.brandColor} />
                        </View>
                        <View style={styles.itemDetails}>
                            <Text style={styles.itemName}>{item.name || item.itemName}</Text>
                            <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                            {item.service && (
                                <Text style={styles.itemService}>Service: {item.service}</Text>
                            )}
                        </View>
                        <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                    </View>
                ))}
            </View>
        )}

        {/* Pickup Details - Enhanced */}
        {booking.pickupAddress && (
            <View style={styles.sectionCard}>
                <View style={styles.locationHeaderRow}>
                    <View style={styles.locationIconContainer}>
                        <MaterialCommunityIcons name="map-marker-up" size={28} color="#4CAF50" />
                    </View>
                    <View style={styles.locationTitleContainer}>
                        <Text style={styles.locationTitle}>Pickup Location</Text>
                        <Text style={styles.locationSubtitle}>Where we'll collect your items</Text>
                    </View>
                </View>
                
                <View style={styles.addressContainer}>
                    <Ionicons name="location" size={18} color={colors.gray} />
                    <Text style={styles.addressText}>{booking.pickupAddress}</Text>
                </View>
                
                {booking.pickupTime && booking.pickupTime !== 'N/A' && (
                    <View style={styles.timeSlotContainer}>
                        <Ionicons name="time" size={18} color="#4CAF50" />
                        <View style={styles.timeSlotInfo}>
                            <Text style={styles.timeSlotLabel}>Scheduled Pickup</Text>
                            <Text style={styles.timeSlotValue}>{booking.pickupTime}</Text>
                        </View>
                    </View>
                )}
                
                {booking.acceptedAt && (
                    <View style={styles.timestampRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.timestampText}>
                            Accepted: {formatDateTime(booking.acceptedAt)}
                        </Text>
                    </View>
                )}
            </View>
        )}

        {/* Delivery Details - Enhanced */}
        {booking.deliveryAddress && (
            <View style={styles.sectionCard}>
                <View style={styles.locationHeaderRow}>
                    <View style={styles.locationIconContainer}>
                        <MaterialCommunityIcons name="map-marker-down" size={28} color="#FF5722" />
                    </View>
                    <View style={styles.locationTitleContainer}>
                        <Text style={styles.locationTitle}>Delivery Location</Text>
                        <Text style={styles.locationSubtitle}>Where we'll return your items</Text>
                    </View>
                </View>
                
                <View style={styles.addressContainer}>
                    <Ionicons name="location" size={18} color={colors.gray} />
                    <Text style={styles.addressText}>{booking.deliveryAddress}</Text>
                </View>
                
                {booking.deliveryTime && booking.deliveryTime !== 'N/A' && (
                    <View style={styles.timeSlotContainer}>
                        <Ionicons name="time" size={18} color="#FF5722" />
                        <View style={styles.timeSlotInfo}>
                            <Text style={styles.timeSlotLabel}>Scheduled Delivery</Text>
                            <Text style={styles.timeSlotValue}>{booking.deliveryTime}</Text>
                        </View>
                    </View>
                )}
                
                {booking.deliveredAt && (
                    <View style={styles.timestampRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.timestampText}>
                            Delivered: {formatDateTime(booking.deliveredAt)}
                        </Text>
                    </View>
                )}
            </View>
        )}

        {/* Order Timeline */}
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={24} color={colors.brandColor} />
                <Text style={styles.sectionTitle}>Order Timeline</Text>
            </View>
            
            <View style={styles.timelineContainer}>
                <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, styles.timelineDotActive]} />
                    <View style={styles.timelineContent}>
                        <Text style={styles.timelineTitle}>Order Placed</Text>
                        <Text style={styles.timelineTime}>{formatDateTime(booking.createdAt)}</Text>
                    </View>
                </View>
                
                {booking.acceptedAt && (
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, styles.timelineDotActive]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>Order Accepted</Text>
                            <Text style={styles.timelineTime}>{formatDateTime(booking.acceptedAt)}</Text>
                        </View>
                    </View>
                )}
                
                {booking.inProgressAt && (
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, styles.timelineDotActive]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>In Progress</Text>
                            <Text style={styles.timelineTime}>{formatDateTime(booking.inProgressAt)}</Text>
                        </View>
                    </View>
                )}
                
                {booking.completedAt && (
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, styles.timelineDotActive]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>Completed</Text>
                            <Text style={styles.timelineTime}>{formatDateTime(booking.completedAt)}</Text>
                        </View>
                    </View>
                )}
                
                {booking.deliveredAt && (
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, styles.timelineDotActive]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>Delivered</Text>
                            <Text style={styles.timelineTime}>{formatDateTime(booking.deliveredAt)}</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>

        {/* Driver Information */}
        {booking.driver && (
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="car" size={24} color={colors.brandColor} />
                    <Text style={styles.sectionTitle}>Driver Information</Text>
                </View>
                <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                        <Ionicons name="person" size={24} color="#FFF" />
                    </View>
                    <View style={styles.driverDetails}>
                        <Text style={styles.driverName}>
                            {booking.driver.firstName} {booking.driver.lastName}
                        </Text>
                        {booking.driver.phoneNumber && (
                            <Text style={styles.driverPhone}>{booking.driver.phoneNumber}</Text>
                        )}
                    </View>
                </View>
            </View>
        )}

        {/* Special Instructions */}
        {booking.specialInstructions && (
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="document-text-outline" size={24} color={colors.brandColor} />
                    <Text style={styles.sectionTitle}>Special Instructions</Text>
                </View>
                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsText}>{booking.specialInstructions}</Text>
                </View>
            </View>
        )}
    </>
)}

{/* Payment Information - Enhanced */}
<View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
        <Ionicons name="wallet-outline" size={24} color={colors.brandColor} />
        <Text style={styles.sectionTitle}>Payment Details</Text>
    </View>
    
    <View style={styles.paymentBreakdown}>
        {booking.type === 'drycleaner' && booking.items && (
            <>
                <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Subtotal</Text>
                    <Text style={styles.paymentValue}>
                        ₹{booking.items.reduce((sum: number, item: any) => 
                            sum + ((item.price || 0) * (item.quantity || 0)), 0
                        )}
                    </Text>
                </View>
                <View style={styles.paymentDivider} />
            </>
        )}
        
        <View style={styles.paymentRow}>
            <Text style={styles.paymentTotalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{booking.totalAmount}</Text>
        </View>
    </View>
    
    {/* Payment Status Badge */}
    <View style={styles.paymentStatusContainer}>
        {booking.status === 'completed' || booking.status === 'delivered' ? (
            <View style={styles.paidBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.paidText}>Payment Completed</Text>
            </View>
        ) : (
            <View style={styles.pendingPaymentBadge}>
                <Ionicons name="time-outline" size={20} color="#FFA500" />
                <Text style={styles.pendingPaymentText}>
                    Payment {booking.paymentStatus || 'Pending'}
                </Text>
            </View>
        )}
    </View>
    
    {booking.paymentMethod && (
        <View style={styles.paymentMethodRow}>
            <Ionicons name="card-outline" size={18} color={colors.gray} />
            <Text style={styles.paymentMethodText}>
                Payment Method: {booking.paymentMethod}
            </Text>
        </View>
    )}
</View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Action Buttons */}
            {canCancelBooking() && (
                <View style={styles.actionButtons}>
                    <TouchableOpacity 
                        style={styles.cancelButton}
                        onPress={handleCancelBooking}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="close-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const additionalStyles = {
    itemsCountBadge: {
        backgroundColor: colors.brandColor + '15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 15,
    },
    itemsCountText: {
        fontSize: 13,
        color: colors.brandColor,
        fontWeight: '600',
    },
    itemService: {
        fontSize: 12,
        color: colors.gray,
        marginTop: 2,
    },
    locationHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    locationIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F8F8F8',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    locationTitleContainer: {
        flex: 1,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 2,
    },
    locationSubtitle: {
        fontSize: 12,
        color: colors.gray,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F8F8F8',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    timeSlotContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.brandColor,
    },
    timeSlotInfo: {
        marginLeft: 10,
        flex: 1,
    },
    timeSlotLabel: {
        fontSize: 12,
        color: colors.gray,
        marginBottom: 2,
    },
    timeSlotValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.black,
    },
    timestampRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    timestampText: {
        fontSize: 12,
        color: colors.gray,
        marginLeft: 8,
    },
    timelineContainer: {
        paddingLeft: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        position: 'relative',
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E0E0E0',
        marginRight: 15,
        marginTop: 4,
    },
    timelineDotActive: {
        backgroundColor: colors.brandColor,
    },
    timelineContent: {
        flex: 1,
    },
    timelineTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.black,
        marginBottom: 3,
    },
    timelineTime: {
        fontSize: 13,
        color: colors.gray,
    },
    driverInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        padding: 15,
        borderRadius: 10,
    },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.brandColor,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    driverDetails: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.black,
        marginBottom: 4,
    },
    driverPhone: {
        fontSize: 14,
        color: colors.gray,
    },
    instructionsContainer: {
        backgroundColor: '#F8F8F8',
        padding: 15,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.brandColor,
    },
    paymentBreakdown: {
        marginTop: 10,
    },
    paymentDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 12,
    },
    paymentTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.black,
    },
    paymentStatusContainer: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    paidText: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '600',
        marginLeft: 8,
    },
    pendingPaymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    pendingPaymentText: {
        fontSize: 14,
        color: '#FFA500',
        fontWeight: '600',
        marginLeft: 8,
        textTransform: 'capitalize',
    },
    paymentMethodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    paymentMethodText: {
        fontSize: 13,
        color: colors.gray,
        marginLeft: 8,
        textTransform: 'capitalize',
    },
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
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    headerCard: {
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
    typeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.brandColor,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 15,
    },
    typeBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    bookingNumberLabel: {
        fontSize: 12,
        color: colors.gray,
        marginBottom: 5,
    },
    bookingNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 5,
    },
    bookingDate: {
        fontSize: 13,
        color: colors.gray,
        marginBottom: 15,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
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
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: colors.black,
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
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
    totalAmount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.brandColor,
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
    },
    cancelButton: {
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
});

export default OrderDetails;