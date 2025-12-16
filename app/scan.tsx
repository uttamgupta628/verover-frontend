import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import colors from '../assets/color';
import axiosInstance from '../api/axios';

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const { token } = useSelector((state: any) => state.auth);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    
    try {
      console.log('QR Code scanned:', data);
      
      // Extract booking/order ID from QR code data
      let bookingId = data;
      
      // If QR code contains a URL, extract the ID
      if (data.includes('/')) {
        const parts = data.split('/');
        bookingId = parts[parts.length - 1];
      }

      console.log('Extracted ID:', bookingId);

      // Try to fetch from different endpoints
      // First try garage booking
      let bookingData = null;
      let bookingType: 'garage' | 'parkinglot' | 'residence' | 'drycleaner' | null = null;

      try {
        console.log('Trying garage booking...');
        const garageResponse = await axiosInstance.get(
          `/merchants/garage-booking/scan/${bookingId}`,
          {
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json',
            },
          }
        );

        if (garageResponse.data.success) {
          bookingData = garageResponse.data.data;
          bookingType = 'garage';
          console.log('Found garage booking');
        }
      } catch (error: any) {
        console.log('Not a garage booking:', error.response?.status);
      }

      // Try parking lot booking
      if (!bookingData) {
        try {
          console.log('Trying parking lot booking...');
          const lotResponse = await axiosInstance.get(
            `/merchants/parkinglot/booking/${bookingId}`,
            {
              headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
              },
            }
          );

          if (lotResponse.data.success) {
            bookingData = lotResponse.data.data;
            bookingType = 'parkinglot';
            console.log('Found parking lot booking');
          }
        } catch (error: any) {
          console.log('Not a parking lot booking:', error.response?.status);
        }
      }

      // Try residence booking
      if (!bookingData) {
        try {
          console.log('Trying residence booking...');
          const residenceResponse = await axiosInstance.get(
            `/merchants/residence/booking/${bookingId}`,
            {
              headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
              },
            }
          );

          if (residenceResponse.data.success) {
            bookingData = residenceResponse.data.data;
            bookingType = 'residence';
            console.log('Found residence booking');
          }
        } catch (error: any) {
          console.log('Not a residence booking:', error.response?.status);
        }
      }

      // Try dry cleaner order
      if (!bookingData) {
        try {
          console.log('Trying dry cleaner order...');
          const orderResponse = await axiosInstance.get(
            `/users/bookings/${bookingId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (orderResponse.data.success) {
            bookingData = orderResponse.data.data;
            bookingType = 'drycleaner';
            console.log('Found dry cleaner order');
          }
        } catch (error: any) {
          console.log('Not a dry cleaner order:', error.response?.status);
        }
      }

      if (!bookingData) {
        throw new Error('Booking not found. Please check the QR code and try again.');
      }

      // Transform data based on type
      let transformedData: any = {
        _id: bookingData._id,
        type: bookingType,
      };

      if (bookingType === 'garage') {
        transformedData = {
          ...transformedData,
          bookingNumber: `#GRG${bookingData._id.slice(-6)}`,
          status: bookingData.paymentDetails?.status || 'pending',
          createdAt: bookingData.createdAt,
          totalAmount: bookingData.totalAmount || 0,
          customerName: `${bookingData.customerId?.firstName || ''} ${bookingData.customerId?.lastName || ''}`.trim(),
          customerPhone: bookingData.customerId?.phoneNumber,
          vehicleNumber: bookingData.vehicleNumber,
          bookedSlot: `Zone ${bookingData.bookedSlot?.zone || 'A'} - Slot ${bookingData.bookedSlot?.slot || '1'}`,
          garageName: bookingData.garageId?.garageName || 'N/A',
          bookingPeriod: {
            from: bookingData.bookingPeriod?.startTime,
            to: bookingData.bookingPeriod?.endTime,
          },
          priceRate: bookingData.priceRate,
          paymentMethod: bookingData.paymentDetails?.method,
          paymentStatus: bookingData.paymentDetails?.status,
        };
      } else if (bookingType === 'parkinglot') {
        transformedData = {
          ...transformedData,
          bookingNumber: `#LOT${bookingData._id.slice(-6)}`,
          status: bookingData.paymentDetails?.status || 'pending',
          createdAt: bookingData.createdAt,
          totalAmount: bookingData.totalAmount || 0,
          customerName: `${bookingData.customerId?.firstName || ''} ${bookingData.customerId?.lastName || ''}`.trim(),
          customerPhone: bookingData.customerId?.phoneNumber,
          vehicleNumber: bookingData.vehicleNumber,
          bookedSlot: `Zone ${bookingData.bookedSlot?.zone || 'A'} - Slot ${bookingData.bookedSlot?.slot || '1'}`,
          parkingName: bookingData.lotId?.parkingName || 'N/A',
          bookingPeriod: {
            from: bookingData.bookingPeriod?.startTime,
            to: bookingData.bookingPeriod?.endTime,
          },
          priceRate: bookingData.priceRate,
          paymentMethod: bookingData.paymentDetails?.method,
          paymentStatus: bookingData.paymentDetails?.status,
        };
      } else if (bookingType === 'residence') {
        transformedData = {
          ...transformedData,
          bookingNumber: `#RES${bookingData._id.slice(-6)}`,
          status: bookingData.paymentDetails?.status || 'pending',
          createdAt: bookingData.createdAt,
          totalAmount: bookingData.totalAmount || 0,
          customerName: `${bookingData.customerId?.firstName || ''} ${bookingData.customerId?.lastName || ''}`.trim(),
          customerPhone: bookingData.customerId?.phoneNumber,
          vehicleNumber: bookingData.vehicleNumber,
          residenceName: bookingData.residenceId?.residenceName || 'N/A',
          bookingPeriod: {
            from: bookingData.bookingPeriod?.startTime,
            to: bookingData.bookingPeriod?.endTime,
          },
          priceRate: bookingData.priceRate,
          paymentMethod: bookingData.paymentDetails?.method,
          paymentStatus: bookingData.paymentDetails?.status,
        };
      } else if (bookingType === 'drycleaner') {
        transformedData = {
          ...transformedData,
          orderNumber: bookingData.bookingNumber || `#DRY${bookingData._id.slice(-6)}`,
          bookingNumber: bookingData.bookingNumber || `#DRY${bookingData._id.slice(-6)}`,
          status: bookingData.status,
          createdAt: bookingData.createdAt,
          totalAmount: bookingData.totalPrice || bookingData.totalAmount || 0,
          customerName: bookingData.user ? `${bookingData.user.firstName || ''} ${bookingData.user.lastName || ''}`.trim() : 'N/A',
          customerPhone: bookingData.user?.phoneNumber,
          items: bookingData.items || [],
          pickupAddress: bookingData.pickupLocation?.address || 'N/A',
          deliveryAddress: bookingData.deliveryLocation?.address || 'N/A',
          pickupTime: bookingData.pickupTimeSlot || 'N/A',
          deliveryTime: bookingData.deliveryTimeSlot || 'N/A',
          paymentMethod: bookingData.paymentMethod,
          paymentStatus: bookingData.paymentStatus,
          specialInstructions: bookingData.specialInstructions,
        };
      }

      // Navigate to booking details screen with the data
      router.push({
        pathname: '/bookingDetails',
        params: { 
          bookingData: JSON.stringify(transformedData) 
        }
      });

    } catch (error: any) {
      console.error('Error scanning QR code:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to scan QR code. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => setScanned(false)
          }
        ]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan QR Code</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Camera View */}
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        style={styles.camera}
      >
        <View style={styles.overlay}>
          {/* Top overlay */}
          <View style={styles.overlayTop} />
          
          {/* Middle section with scanning frame */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              {/* Corner borders */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          
          {/* Bottom overlay */}
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>
              {scanned ? 'Processing...' : 'Align QR code within the frame'}
            </Text>
            <Text style={styles.subInstructionText}>
              Supports parking bookings and dry cleaner orders
            </Text>
          </View>
        </View>
      </CameraView>

      {/* Rescan button */}
      {scanned && (
        <View style={styles.rescanContainer}>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: colors.brandColor,
  },
  backButton: {
    padding: 5,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 38,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.brandColor,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 8,
  },
  subInstructionText: {
    color: '#CCCCCC',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  text: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.brandColor,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rescanContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  rescanButton: {
    backgroundColor: colors.brandColor,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  rescanText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});