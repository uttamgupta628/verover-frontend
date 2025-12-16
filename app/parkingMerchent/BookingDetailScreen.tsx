import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../assets/color';

type BookingType = 'parking' | 'garage' | 'residence';
type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'active';

interface BookingDetail {
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
        email?: string;
    };
}

const BookingDetailScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState<BookingDetail | null>(null);

    useEffect(() => {
        loadBookingData();
    }, []);

    const loadBookingData = () => {
        try {
            if (params.bookingData) {
                const bookingData = JSON.parse(params.bookingData as string);
                setBooking(bookingData);
            }
        } catch (error) {
            console.error('Error loading booking data:', error);
            Alert.alert('Error', 'Failed to load booking details');
        }
    };

    const getStatusColor = (status: BookingStatus) => {
        switch (status) {
            case 'pending': return '#FFA500';
            case 'confirmed':
            case 'active': return '#4CAF50';
            case 'in_progress': return '#FF8C00';
            case 'completed': return '#666666';
            case 'cancelled': return '#FF0000';
            default: return colors.gray;
        }
    };

    const getStatusText = (status: BookingStatus) => {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'active': 'Active',
            'in_progress': 'In Progress',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    };

    const getTypeIcon = (type: BookingType) => {
        const iconMap = {
            'parking': 'car-sport',
            'garage': 'construct',
            'residence': 'home'
        };
        return iconMap[type] || 'car';
    };

    const getTypeColor = (type: BookingType) => {
        const colorMap = {
            'parking': '#FF8C00',
            'garage': '#FF9800',
            'residence': '#4CAF50'
        };
        return colorMap[type] || colors.gray;
    };

    const getTypeText = (type: BookingType) => {
        const textMap = {
            'parking': 'Parking Booking',
            'garage': 'Garage Booking',
            'residence': 'Residence Booking'
        };
        return textMap[type] || 'Booking';
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return 'Invalid date';
        }
    };

    const formatTime = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return 'Invalid time';
        }
    };

    const formatDateTime = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return 'Invalid date';
        }
    };

    const calculateDuration = (from: string, to: string): string => {
        try {
            const diffMs = new Date(to).getTime() - new Date(from).getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        } catch {
            return 'N/A';
        }
    };

    const handleCall = (phoneNumber: string) => {
        if (phoneNumber && phoneNumber !== 'N/A') {
            Linking.openURL(`tel:${phoneNumber}`);
        } else {
            Alert.alert('Error', 'Phone number not available');
        }
    };

    const handleEmail = (email: string) => {
        if (email) {
            Linking.openURL(`mailto:${email}`);
        } else {
            Alert.alert('Error', 'Email not available');
        }
    };

    const handleUpdateStatus = () => {
        Alert.alert(
            'Update Status',
            'Choose new status for this booking',
            [
                { text: 'Confirm', onPress: () => updateBookingStatus('confirmed') },
                { text: 'In Progress', onPress: () => updateBookingStatus('in_progress') },
                { text: 'Complete', onPress: () => updateBookingStatus('completed') },
                { text: 'Cancel', style: 'destructive', onPress: () => updateBookingStatus('cancelled') },
                { text: 'Close', style: 'cancel' }
            ]
        );
    };

    // const updateBookingStatus = async (newStatus: BookingStatus) => {
    //     // TODO: Implement API call to update status
    //     // Example:
    //     // try {
    //     //     const response = await axiosInstance.patch(
    //     //         `/merchants/${booking.type}/booking/${booking.bookingId}/status`,
    //     //         { status: newStatus },
    //     //         { headers: { 'Authorization': `Bearer ${token}` } }
    //     //     );
    //     //     if (response.data.success) {
    //     //         setBooking({ ...booking, status: newStatus });
    //     //         Alert.alert('Success', `Booking status updated to ${getStatusText(newStatus)}`);
    //     //     }
    //     // } catch (error) {
    //     //     Alert.alert('Error', 'Failed to update status');
    //     // }
    //     // Alert.alert('Success', `Booking status updated to ${getStatusText(newStatus)}`);
    // };

    if (loading || !booking) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading booking details...</Text>
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
                    <Ionicons name="arrow-back" size={24} color={colors.white || '#FFF'} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking Details</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Status Banner */}
                {/* <View style={[styles.statusBanner, { backgroundColor: getStatusColor(booking.status) }]}>
                    <View style={styles.statusContent}>
                        <Ionicons name="checkmark-circle" size={32} color="#FFF" />
                        <View style={styles.statusTextContainer}>
                            <Text style={styles.statusTitle}>{getStatusText(booking.status)}</Text>
                            <Text style={styles.statusSubtitle}>
                                {booking.status === 'pending' && 'Waiting for confirmation'}
                                {booking.status === 'confirmed' && 'Booking confirmed'}
                                {booking.status === 'active' && 'Currently active'}
                                {booking.status === 'in_progress' && 'Service in progress'}
                                {booking.status === 'completed' && 'Service completed'}
                                {booking.status === 'cancelled' && 'Booking cancelled'}
                            </Text>
                        </View>
                    </View>
                </View> */}

                {/* Booking Type Badge */}
                <View style={styles.section}>
                    <View style={[styles.typeBadgeLarge, { backgroundColor: `${getTypeColor(booking.type)}15` }]}>
                        <Ionicons 
                            name={getTypeIcon(booking.type)} 
                            size={24} 
                            color={getTypeColor(booking.type)} 
                        />
                        <Text style={[styles.typeBadgeText, { color: getTypeColor(booking.type) }]}>
                            {getTypeText(booking.type)}
                        </Text>
                    </View>
                </View>

                {/* Booking Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Booking Information</Text>
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Booking ID</Text>
                            <Text style={styles.infoValue}>{booking.orderNumber}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Booking Date</Text>
                            <Text style={styles.infoValue}>{formatDate(booking.createdAt)}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Booking Time</Text>
                            <Text style={styles.infoValue}>{formatTime(booking.createdAt)}</Text>
                        </View>
                        {booking.vehicleNumber && (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Vehicle Number</Text>
                                    <Text style={[styles.infoValue, styles.vehicleNumber]}>
                                        {booking.vehicleNumber}
                                    </Text>
                                </View>
                            </>
                        )}
                        {booking.slot && (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Slot</Text>
                                    <Text style={styles.infoValue}>{booking.slot}</Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Booking Period */}
                {booking.bookingPeriod && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Booking Period</Text>
                        <View style={styles.card}>
                            <View style={styles.periodContainer}>
                                <View style={styles.periodItem}>
                                    <Ionicons name="log-in-outline" size={24} color={colors.primary} />
                                    <View style={styles.periodDetails}>
                                        <Text style={styles.periodLabel}>Check-in</Text>
                                        <Text style={styles.periodValue}>
                                            {formatDateTime(booking.bookingPeriod.from)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.durationIndicator}>
                                    <View style={styles.durationLine} />
                                    <Text style={styles.durationText}>
                                        {calculateDuration(booking.bookingPeriod.from, booking.bookingPeriod.to)}
                                    </Text>
                                </View>
                                <View style={styles.periodItem}>
                                    <Ionicons name="log-out-outline" size={24} color="#FF8C00" />
                                    <View style={styles.periodDetails}>
                                        <Text style={styles.periodLabel}>Check-out</Text>
                                        <Text style={styles.periodValue}>
                                            {formatDateTime(booking.bookingPeriod.to)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Location Information */}
                {booking.placeInfo && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Location Details</Text>
                        <View style={styles.card}>
                            <View style={styles.locationHeader}>
                                <Ionicons name="location" size={24} color={colors.primary} />
                                <Text style={styles.locationName}>{booking.placeInfo.name}</Text>
                            </View>
                            <Text style={styles.locationAddress}>{booking.placeInfo.address}</Text>
                            {booking.placeInfo.phoneNo && booking.placeInfo.phoneNo !== 'N/A' && (
                                <TouchableOpacity 
                                    style={styles.contactButton}
                                    onPress={() => handleCall(booking.placeInfo!.phoneNo)}
                                >
                                    <Ionicons name="call" size={18} color={colors.primary} />
                                    <Text style={styles.contactButtonText}>{booking.placeInfo.phoneNo}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Customer Information */}
                {booking.user && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                        <View style={styles.card}>
                            <View style={styles.customerHeader}>
                                <View style={styles.customerAvatar}>
                                    <Ionicons name="person" size={24} color="#FFF" />
                                </View>
                                <View style={styles.customerInfo}>
                                    <Text style={styles.customerName}>
                                        {booking.user.firstName} {booking.user.lastName}
                                    </Text>
                                    {booking.user.phone && (
                                        <Text style={styles.customerContact}>{booking.user.phone}</Text>
                                    )}
                                    {booking.user.email && (
                                        <Text style={styles.customerContact}>{booking.user.email}</Text>
                                    )}
                                </View>
                            </View>
                            <View style={styles.customerActions}>
                                {booking.user.phone && (
                                    <TouchableOpacity 
                                        style={styles.actionButton}
                                        onPress={() => handleCall(booking.user!.phone)}
                                    >
                                        <Ionicons name="call" size={20} color="#FFF" />
                                        <Text style={styles.actionButtonText}>Call</Text>
                                    </TouchableOpacity>
                                )}
                                {booking.user.email && (
                                    <TouchableOpacity 
                                        style={[styles.actionButton, styles.actionButtonSecondary]}
                                        onPress={() => handleEmail(booking.user!.email!)}
                                    >
                                        <Ionicons name="mail" size={20} color={colors.primary} />
                                        <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                                            Email
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* Payment Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Total Amount</Text>
                            <Text style={styles.amountValue}>₹{booking.totalAmount.toFixed(2)}</Text>
                        </View>
                        {booking.paymentMethod && (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Payment Method</Text>
                                    <Text style={styles.infoValue}>
                                        {booking.paymentMethod.toUpperCase()}
                                    </Text>
                                </View>
                            </>
                        )}
                        {booking.paymentStatus && (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Payment Status</Text>
                                    <View style={styles.paymentStatusBadge}>
                                        <Text style={styles.paymentStatusText}>
                                            {booking.paymentStatus.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                    <View style={styles.section}>
                        <TouchableOpacity 
                            style={styles.updateButton}
                            onPress={handleUpdateStatus}
                        >
                            <Ionicons name="refresh" size={20} color="#FFF" />
                            <Text style={styles.updateButtonText}>Update Status</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 0,
        paddingBottom: 16,
        backgroundColor: '#FFF',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor:'#FF8C00'
    },
    headerTitle: {
        fontSize: 20,
        color: '#00000',
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    statusBanner: {
        padding: 20,
        marginBottom: 16,
    },
    statusContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusTextContainer: {
        marginLeft: 16,
        flex: 1,
    },
    statusTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    statusSubtitle: {
        fontSize: 14,
        color: '#FFFFFF',
        opacity: 0.9,
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    typeBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
    },
    typeBadgeText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: '#666666',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: '#000000',
        fontWeight: '500',
        flex: 1,
        textAlign: 'right',
    },
    vehicleNumber: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#FF8C00',
    },
    amountValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
    },
    periodContainer: {
        paddingVertical: 8,
    },
    periodItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    periodDetails: {
        marginLeft: 12,
        flex: 1,
    },
    periodLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 4,
    },
    periodValue: {
        fontSize: 14,
        color: '#000000',
        fontWeight: '500',
    },
    durationIndicator: {
        alignItems: 'center',
        marginVertical: 8,
    },
    durationLine: {
        width: 2,
        height: 30,
        backgroundColor: '#E0E0E0',
        marginBottom: 8,
    },
    durationText: {
        fontSize: 12,
        color: '#FF8C00',
        fontWeight: '600',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
        marginLeft: 12,
        flex: 1,
    },
    locationAddress: {
        fontSize: 14,
        color: '#666666',
        lineHeight: 20,
        marginBottom: 12,
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    contactButtonText: {
        fontSize: 14,
        color: '#FF8C00',
        fontWeight: '500',
        marginLeft: 8,
    },
    customerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    customerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FF8C00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    customerInfo: {
        marginLeft: 12,
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 4,
    },
    customerContact: {
        fontSize: 13,
        color: '#666666',
        marginTop: 2,
    },
    customerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF8C00',
        padding: 12,
        borderRadius: 8,
    },
    actionButtonSecondary: {
        backgroundColor: '#E3F2FD',
    },
    actionButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '600',
        marginLeft: 8,
    },
    actionButtonTextSecondary: {
        color: '#FF8C00',
    },
    paymentStatusBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    paymentStatusText: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '600',
    },
    updateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF8C00',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    updateButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginLeft: 8,
    },
});

export default BookingDetailScreen;