import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { images } from '../../assets/images/images';
import colors from '../../assets/color';
import axiosInstance from '../../api/axios';

const { width, height } = Dimensions.get('window');

const DriverReceipt = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const receiptRef = useRef<View>(null);
  
  // Redux auth state
  const { user, token, isAuthenticated } = useSelector((state: any) => state.auth);
  
  // Parse booking data
  const [bookingData, setBookingData] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    try {
      if (params.bookingData && typeof params.bookingData === 'string') {
        const parsed = JSON.parse(params.bookingData);
        console.log('📦 Parsed booking data:', parsed);
        setBookingData(parsed);
      } else if (params.bookingData && typeof params.bookingData === 'object') {
        setBookingData(params.bookingData);
      }
    } catch (error) {
      console.error('❌ Error parsing booking data:', error);
      Alert.alert('Error', 'Failed to load receipt data');
    }
  }, [params.bookingData]);

  // Fetch receipt details from backend
  useEffect(() => {
    const fetchReceiptData = async () => {
      if (!bookingData?.id && !bookingData?._id) return;
      
      try {
        setLoading(true);
        const bookingId = bookingData.id || bookingData._id;
        
        console.log('📡 Fetching receipt from backend:', bookingId);
        
        const response = await axiosInstance.get(`/users/receipts/driver/${bookingId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.data.success) {
          console.log('✅ Receipt fetched:', response.data.data);
          setReceiptData(response.data.data);
        } else {
          // Use local data as fallback
          console.log('⚠️ Using local booking data');
          setReceiptData(generateLocalReceipt(bookingData));
        }
      } catch (error: any) {
        console.error('❌ Error fetching receipt:', error);
        // Generate receipt from local data
        setReceiptData(generateLocalReceipt(bookingData));
      } finally {
        setLoading(false);
      }
    };

    if (bookingData) {
      fetchReceiptData();
    }
  }, [bookingData, token]);

  // Generate receipt from local data
  const generateLocalReceipt = (data: any) => {
    const now = new Date();
    return {
      receiptNumber: `RCP-${Date.now()}`,
      bookingId: data.id || data._id,
      orderNumber: data.orderNumber || 'N/A',
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      
      driver: {
        name: data.driver?.name || `${user.firstName} ${user.lastName}`.trim() || user.fullName || 'Driver',
        id: data.driver?.id || user._id,
        phone: data.driver?.phone || user.phone || 'N/A',
      },
      
      customer: {
        name: data.customerName || data.user?.name || 'Customer',
        phone: data.customerPhone || 'N/A',
      },
      
      service: {
        provider: data.dryCleaner?.shopname || 'Dry Cleaning Service',
        type: 'Pickup & Delivery',
      },
      
      route: {
        pickupAddress: data.pickupAddress || 'N/A',
        dropoffAddress: data.dropoffAddress || data.dropOff || 'N/A',
        distance: data.calculatedDistance || data.distanceInKm || data.routeDistance || 'N/A',
        duration: data.calculatedDuration || data.routeDuration || 'N/A',
      },
      
      payment: {
        deliveryCharge: parseFloat(data.deliveryCharge || data.pricing?.deliveryCharge || 0),
        tip: parseFloat(data.estimatedTip || data.tip || data.pricing?.estimatedTip || 0),
        tax: parseFloat(data.tax || 0),
        platformFee: parseFloat(data.platformFee || 0),
        total: 0, // Will calculate
      },
      
      timeline: {
        accepted: data.acceptedAt || now.toISOString(),
        pickedUp: data.pickedUpAt || now.toISOString(),
        delivered: data.deliveredAt || data.dropoffCompletedAt || now.toISOString(),
      },
      
      status: data.status || 'completed',
    };
  };

  // Calculate totals
  useEffect(() => {
    if (receiptData?.payment) {
      const { deliveryCharge, tip, tax, platformFee } = receiptData.payment;
      const total = deliveryCharge + tip + tax - platformFee;
      setReceiptData((prev: any) => ({
        ...prev,
        payment: {
          ...prev.payment,
          total: total,
          earnings: total,
        }
      }));
    }
  }, [receiptData?.payment?.deliveryCharge]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Format date and time
  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  // Share receipt as image
  const handleShareReceipt = async () => {
    try {
      setIsSharing(true);
      
      if (Platform.OS === 'web') {
        const shareData = {
          title: 'Delivery Receipt',
          text: `Receipt #${receiptData?.receiptNumber}\nTotal Earnings: ${formatCurrency(receiptData?.payment?.total || 0)}`,
        };
        
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          Alert.alert('Success', 'Receipt link copied to clipboard');
        }
      } else {
        if (receiptRef.current) {
          const uri = await captureRef(receiptRef, {
            format: 'png',
            quality: 1,
          });
          
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share Receipt',
          });
        }
      }
    } catch (error) {
      console.error('❌ Share error:', error);
      Alert.alert('Error', 'Failed to share receipt');
    } finally {
      setIsSharing(false);
    }
  };

  // Print receipt as PDF
  const handlePrintReceipt = async () => {
    try {
      setIsPrinting(true);
      
      const htmlContent = generateReceiptHTML();
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Receipt PDF',
      });
      
      Alert.alert('Success', 'Receipt PDF generated successfully');
    } catch (error) {
      console.error('❌ Print error:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setIsPrinting(false);
    }
  };

  // Generate HTML for PDF
  const generateReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            padding: 40px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #FF8C00;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #FF8C00;
            margin: 0;
            font-size: 32px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .section {
            margin: 20px 0;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
          }
          .section-title {
            font-weight: bold;
            font-size: 18px;
            color: #FF8C00;
            margin-bottom: 10px;
            border-bottom: 2px solid #FF8C00;
            padding-bottom: 5px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          .row.total {
            border-top: 2px solid #333;
            margin-top: 10px;
            padding-top: 10px;
            font-weight: bold;
            font-size: 20px;
            color: #4CAF50;
          }
          .label {
            color: #666;
          }
          .value {
            font-weight: 500;
            text-align: right;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #999;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚗 Delivery Receipt</h1>
          <p>Receipt #${receiptData?.receiptNumber || 'N/A'}</p>
          <p>${receiptData?.date || 'N/A'} at ${receiptData?.time || 'N/A'}</p>
        </div>

        <div class="section">
          <div class="section-title">Driver Information</div>
          <div class="row">
            <span class="label">Name:</span>
            <span class="value">${receiptData?.driver?.name || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Driver ID:</span>
            <span class="value">${receiptData?.driver?.id || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Phone:</span>
            <span class="value">${receiptData?.driver?.phone || 'N/A'}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Service Details</div>
          <div class="row">
            <span class="label">Order Number:</span>
            <span class="value">${receiptData?.orderNumber || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Service Provider:</span>
            <span class="value">${receiptData?.service?.provider || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Service Type:</span>
            <span class="value">${receiptData?.service?.type || 'N/A'}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Route Information</div>
          <div class="row">
            <span class="label">Pickup:</span>
            <span class="value">${receiptData?.route?.pickupAddress || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Dropoff:</span>
            <span class="value">${receiptData?.route?.dropoffAddress || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Distance:</span>
            <span class="value">${receiptData?.route?.distance || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Duration:</span>
            <span class="value">${receiptData?.route?.duration || 'N/A'}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Payment Breakdown</div>
          <div class="row">
            <span class="label">Delivery Charge:</span>
            <span class="value">${formatCurrency(receiptData?.payment?.deliveryCharge || 0)}</span>
          </div>
          <div class="row">
            <span class="label">Tip:</span>
            <span class="value">${formatCurrency(receiptData?.payment?.tip || 0)}</span>
          </div>
          <div class="row">
            <span class="label">Tax:</span>
            <span class="value">${formatCurrency(receiptData?.payment?.tax || 0)}</span>
          </div>
          <div class="row">
            <span class="label">Platform Fee:</span>
            <span class="value">-${formatCurrency(receiptData?.payment?.platformFee || 0)}</span>
          </div>
          <div class="row total">
            <span class="label">Total Earnings:</span>
            <span class="value">${formatCurrency(receiptData?.payment?.total || 0)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your service!</p>
          <p>This is a computer-generated receipt</p>
        </div>
      </body>
      </html>
    `;
  };

  // Send receipt via email
  const handleEmailReceipt = async () => {
    try {
      const response = await axiosInstance.post('/users/receipts/send-email', {
        receiptId: receiptData?.receiptNumber,
        driverEmail: user.email,
        bookingId: receiptData?.bookingId,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        Alert.alert('Success', 'Receipt sent to your email');
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('❌ Email error:', error);
      Alert.alert('Error', 'Failed to send receipt email');
    }
  };

  // Navigate to home
  const handleGoHome = () => {
    router.replace('/driverHome'); 
  };

  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Authentication required</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoHome}>
          <MaterialIcons name="home" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipt</Text>
        {/* <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleEmailReceipt}
        >
          <MaterialIcons name="email" size={24} color={colors.brandColor} />
        </TouchableOpacity> */}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt Card */}
        <View style={styles.receiptCard} ref={receiptRef}>
          {/* Receipt Header */}
          <View style={styles.receiptHeader}>
            <View style={styles.receiptIconContainer}>
              <MaterialIcons name="receipt-long" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.receiptTitle}>Delivery Receipt</Text>
            <Text style={styles.receiptNumber}>#{receiptData?.receiptNumber}</Text>
            <View style={styles.statusBadge}>
              <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.statusText}>COMPLETED</Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <MaterialIcons name="calendar-today" size={18} color="#666" />
              <Text style={styles.dateTimeText}>{receiptData?.date}</Text>
            </View>
            <View style={styles.dateTimeItem}>
              <MaterialIcons name="access-time" size={18} color="#666" />
              <Text style={styles.dateTimeText}>{receiptData?.time}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Driver Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Information</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="person" size={20} color="#666" />
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{receiptData?.driver?.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="badge" size={20} color="#666" />
              <Text style={styles.infoLabel}>Driver ID</Text>
              <Text style={styles.infoValue}>{receiptData?.driver?.id?.substring(0, 8)}...</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color="#666" />
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{receiptData?.driver?.phone}</Text>
            </View>
          </View>

          {/* Service Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="shopping-bag" size={20} color="#666" />
              <Text style={styles.infoLabel}>Order #</Text>
              <Text style={styles.infoValue}>{receiptData?.orderNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="store" size={20} color="#666" />
              <Text style={styles.infoLabel}>Provider</Text>
              <Text style={styles.infoValue}>{receiptData?.service?.provider}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="local-laundry-service" size={20} color="#666" />
              <Text style={styles.infoLabel}>Service</Text>
              <Text style={styles.infoValue}>{receiptData?.service?.type}</Text>
            </View>
          </View>

          {/* Route Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route Information</Text>
            <View style={styles.routeContainer}>
              <View style={styles.routePoint}>
                <View style={styles.greenDot} />
                <View style={styles.routeDetails}>
                  <Text style={styles.routeLabel}>Pickup Location</Text>
                  <Text style={styles.routeAddress}>{receiptData?.route?.pickupAddress}</Text>
                </View>
              </View>
              
              <View style={styles.routeLine} />
              
              <View style={styles.routePoint}>
                <View style={styles.orangeDot} />
                <View style={styles.routeDetails}>
                  <Text style={styles.routeLabel}>Dropoff Location</Text>
                  <Text style={styles.routeAddress}>{receiptData?.route?.dropoffAddress}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.routeStats}>
              <View style={styles.routeStatItem}>
                <MaterialIcons name="straighten" size={20} color="#FF8C00" />
                <Text style={styles.routeStatValue}>{receiptData?.route?.distance}</Text>
              </View>
              <View style={styles.routeStatItem}>
                <MaterialIcons name="timer" size={20} color="#FF8C00" />
                <Text style={styles.routeStatValue}>{receiptData?.route?.duration}</Text>
              </View>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Timeline</Text>
            {receiptData?.timeline?.accepted && (
              <View style={styles.timelineItem}>
                <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Booking Accepted</Text>
                  <Text style={styles.timelineTime}>
                    {formatDateTime(receiptData.timeline.accepted).time}
                  </Text>
                </View>
              </View>
            )}
            {receiptData?.timeline?.pickedUp && (
              <View style={styles.timelineItem}>
                <MaterialIcons name="local-shipping" size={20} color="#2196F3" />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Items Picked Up</Text>
                  <Text style={styles.timelineTime}>
                    {formatDateTime(receiptData.timeline.pickedUp).time}
                  </Text>
                </View>
              </View>
            )}
            {receiptData?.timeline?.delivered && (
              <View style={styles.timelineItem}>
                <MaterialIcons name="done-all" size={20} color="#4CAF50" />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Delivered to Center</Text>
                  <Text style={styles.timelineTime}>
                    {formatDateTime(receiptData.timeline.delivered).time}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Payment Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Breakdown</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Delivery Charge</Text>
              <Text style={styles.paymentValue}>
                {formatCurrency(receiptData?.payment?.deliveryCharge || 0)}
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Customer Tip</Text>
              <Text style={[styles.paymentValue, styles.tipValue]}>
                {formatCurrency(receiptData?.payment?.tip || 0)}
              </Text>
            </View>
            {receiptData?.payment?.tax > 0 && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Tax</Text>
                <Text style={styles.paymentValue}>
                  {formatCurrency(receiptData.payment.tax)}
                </Text>
              </View>
            )}
            {receiptData?.payment?.platformFee > 0 && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Platform Fee</Text>
                <Text style={[styles.paymentValue, styles.feeValue]}>
                  -{formatCurrency(receiptData.payment.platformFee)}
                </Text>
              </View>
            )}
            
            <View style={styles.totalDivider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Earnings</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(receiptData?.payment?.total || 0)}
              </Text>
            </View>
          </View>

          {/* Footer Note */}
          <View style={styles.footerNote}>
            <MaterialIcons name="info-outline" size={18} color="#999" />
            <Text style={styles.footerText}>
              Earnings will be deposited to your account within 2-3 business days
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={handleShareReceipt}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="share" size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.downloadButton}
            onPress={handlePrintReceipt}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="download" size={20} color="#FFFFFF" />
                <Text style={styles.downloadButtonText}>Download PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Back to Home Button */}
        <View style={styles.homeButtonContainer}>
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={handleGoHome}
          >
            <MaterialIcons name="home" size={24} color="#FFFFFF" />
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : (StatusBar.currentHeight || 0),
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: -60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 180,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  receiptHeader: {
    backgroundColor: '#FF8C00',
    padding: 24,
    alignItems: 'center',
  },
  receiptIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  receiptNumber: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8',
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'right',
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginTop: 4,
    marginRight: 12,
  },
  orangeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF8C00',
    marginTop: 4,
    marginRight: 12,
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#DDD',
    marginLeft: 5,
    marginVertical: -8,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  routeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  timelineTime: {
    fontSize: 13,
    color: '#666',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  tipValue: {
    color: '#4CAF50',
  },
  feeValue: {
    color: '#FF5252',
  },
  totalDivider: {
    height: 2,
    backgroundColor: '#FF8C00',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F8F8',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    flex: 1,
    lineHeight: 18,
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  homeButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  homeButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#FF8C00',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF5252',
    textAlign: 'center',
  },
});
export default DriverReceipt;