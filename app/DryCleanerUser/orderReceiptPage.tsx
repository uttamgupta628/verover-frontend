import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { clearOrderAfterPlacement } from '../../components/redux/userSlice';
import axiosInstance from '../../api/axios';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

export default function OrderReceiptPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useDispatch();
  const viewShotRef = useRef<ViewShot>(null);
  
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  const orderId = params.orderId as string;
  const orderNumber = params.orderNumber as string;
  const trackingId = params.trackingId as string;
  const totalAmount = params.totalAmount ? parseFloat(params.totalAmount as string) : 0;
  
  const passedOrderData = useMemo(() => {
    try {
      return params.orderData ? JSON.parse(params.orderData as string) : null;
    } catch (e) {
      console.error('Failed to parse orderData:', e);
      return null;
    }
  }, [params.orderData]);

  const fetchOrderReceipt = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (passedOrderData && orderNumber) {
        console.log('Using passed order data instead of API call');
        setOrderData({
          _id: orderId,
          orderNumber,
          trackingId,
          totalAmount,
          items: passedOrderData.items || [],
          cleaner: passedOrderData.cleaner,
          addresses: passedOrderData.addresses,
          scheduling: passedOrderData.scheduling,
          createdAt: new Date().toISOString(),
        });
        setLoading(false);
        return;
      }

      if (!orderId) {
        throw new Error('No order ID or order data available');
      }

      console.log('Fetching receipt for orderId:', orderId);
      
      const response = await axiosInstance.get(`/users/orders/${orderId}/receipt`);
      
      if (response.data.success && response.data.data) {
        setOrderData(response.data.data);
      } else {
        throw new Error('Invalid response format');
      }

    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  }, [orderId, orderNumber, trackingId, totalAmount, passedOrderData]);

  useEffect(() => {
    fetchOrderReceipt();
  }, []);

  const handleBack = useCallback(() => {
    dispatch(clearOrderAfterPlacement());
    router.replace('/userHome'); 
  }, [router, dispatch]);

  

  const handleShareReceipt = async () => {
    try {
      if (!viewShotRef.current) {
        Alert.alert('Error', 'Unable to capture receipt');
        return;
      }

      // Capture the view as image
      const uri = await viewShotRef.current.capture();
      
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Order Receipt',
        });
      } else {
        Alert.alert('Info', 'Sharing not available on this device');
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

 const handleDownloadReceipt = async () => {
  try {
    setDownloading(true);

    if (!viewShotRef.current) {
      Alert.alert('Error', 'Unable to capture receipt');
      return;
    }
    const permission = await MediaLibrary.requestPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow photo access to save the receipt'
      );
      return;
    }

    const uri = await viewShotRef.current.capture({
      format: 'png',
      quality: 0.9,
    });

    const asset = await MediaLibrary.createAssetAsync(uri);

    try {
      const album = await MediaLibrary.getAlbumAsync('Vervoer Receipts');
      if (!album) {
        await MediaLibrary.createAlbumAsync('Vervoer Receipts', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
    } catch {
    }

    Alert.alert('Success', 'Receipt saved to gallery successfully!');
  } catch (error: any) {
    console.error('Error downloading receipt:', error);
    Alert.alert('Error', error.message || 'Failed to save receipt');
  } finally {
    setDownloading(false);
  }
};



  const qrCodeValue = orderId || orderNumber || trackingId || 'N/A';

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !orderData) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButtonContainer} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.brandName}>ervoer</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF8C00" />
          <Text style={styles.errorTitle}>Unable to Load Receipt</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={fetchOrderReceipt}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Success state - Receipt UI
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButtonContainer} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>V</Text>
          </View>
          <Text style={styles.brandName}>ervoer</Text>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareReceipt}>
          <MaterialIcons name="share" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ViewShot 
          ref={viewShotRef} 
          options={{ format: 'png', quality: 0.9 }}
          style={{ backgroundColor: '#F5F5F5' }}
        >
          {/* Success Icon */}
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <MaterialIcons name="check" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Order Confirmed!</Text>
            <Text style={styles.successSubtitle}>
              Your dry cleaning order has been placed successfully
            </Text>
          </View>

          {/* QR Code Section */}
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Order QR Code</Text>
            <Text style={styles.qrSubtitle}>Show this QR code for quick access</Text>
            
            <View style={styles.qrContainer}>
              <QRCode
                value={qrCodeValue}
                size={180}
                backgroundColor="white"
                color="#000"
              />
            </View>
            
            <Text style={styles.qrOrderNumber}>#{orderData?.orderNumber || orderNumber || 'N/A'}</Text>
            
            <TouchableOpacity 
              style={styles.toggleQRButton}
              onPress={() => setShowQR(!showQR)}
            >
              <MaterialIcons 
                name={showQR ? "visibility-off" : "visibility"} 
                size={20} 
                color="#FF8C00" 
              />
              <Text style={styles.toggleQRText}>
                {showQR ? 'Hide Details' : 'Show Full Details'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Order Details Card */}
          {showQR && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Order Details</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order Number:</Text>
                  <Text style={styles.detailValue}>#{orderData?.orderNumber || orderNumber || 'N/A'}</Text>
                </View>
                
                {(orderData?.trackingId || trackingId) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tracking ID:</Text>
                    <Text style={styles.detailValue}>{orderData?.trackingId || trackingId}</Text>
                  </View>
                )}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Amount:</Text>
                  <Text style={styles.detailValue}>
                    ${(orderData?.totalAmount || totalAmount || 0).toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order Date:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(orderData?.createdAt || Date.now()).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {/* Items Card */}
              {orderData?.items && orderData.items.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Items ({orderData.items.length})</Text>
                  {orderData.items.map((item: any, index: number) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemDetails}>
                          Qty: {item.quantity} × ${parseFloat(item.price || 0).toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        ${(parseFloat(item.price || 0) * parseInt(item.quantity || 0)).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Cleaner Info */}
              {orderData?.cleaner && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Dry Cleaner</Text>
                  <Text style={styles.cleanerName}>{orderData.cleaner.shopname}</Text>
                  {orderData.cleaner.address && (
                    <Text style={styles.cleanerAddress}>
                      {typeof orderData.cleaner.address === 'string' 
                        ? orderData.cleaner.address 
                        : `${orderData.cleaner.address.street}, ${orderData.cleaner.address.city}, ${orderData.cleaner.address.state}`
                      }
                    </Text>
                  )}
                </View>
              )}

              {/* Scheduling Info */}
              {orderData?.scheduling && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Schedule</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pickup:</Text>
                    <Text style={styles.detailValue}>
                      {orderData.scheduling.pickupDate} {orderData.scheduling.pickupMonth} at {orderData.scheduling.pickupTime}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivery:</Text>
                    <Text style={styles.detailValue}>
                      {orderData.scheduling.deliveryDate} {orderData.scheduling.deliveryMonth} at {orderData.scheduling.deliveryTime}
                    </Text>
                  </View>
                </View>
              )}

              {/* Next Steps */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>What's Next?</Text>
                <Text style={styles.nextStepText}>
                  • Track your order status in the Orders section{'\n'}
                  • Your items will be ready as per the agreed timeline{'\n'}
                  • You'll receive notifications about your order status{'\n'}
                  • Show this QR code for quick verification
                </Text>
              </View>
            </>
          )}
        </ViewShot>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, downloading && styles.actionButtonDisabled]}
            onPress={handleDownloadReceipt}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#FF8C00" />
            ) : (
              <>
                <MaterialIcons name="download" size={20} color="#FF8C00" />
                <Text style={styles.actionButtonText}>Download</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleShareReceipt}
          >
            <MaterialIcons name="share" size={20} color="#FF8C00" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/orders')}
        >
          <Text style={styles.secondaryButtonText}>View Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.trackButton} 
          onPress={handleBack}
        >
          <Text style={styles.trackButtonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 60,
    marginTop: -70,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButtonContainer: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  logoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF8C00',
    marginBottom: 15,
  },
  qrOrderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 15,
  },
  toggleQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF5E6',
    gap: 8,
  },
  toggleQRText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C00',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF8C00',
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cleanerAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  nextStepText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C00',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF8C00',
  },
  secondaryButtonText: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackButton: {
    flex: 1,
    backgroundColor: '#FF8C00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});