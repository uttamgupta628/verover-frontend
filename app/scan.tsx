import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '../assets/color';

export default function UniversalScanner() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [data, setData] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const detectType = (value: string) => {
    if (value.startsWith('http')) return 'URL';
    if (/^[a-f0-9]{24}$/i.test(value)) return 'Object ID';
    if (value.startsWith('{') || value.startsWith('[')) return 'JSON';
    return 'Text / Code';
  };

  const handleScan = ({ data }: { data: string }) => {
    setScanned(true);
    setData(data);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission…</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>No camera access</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        style={styles.camera}
      />

      {scanned && (
        <View style={styles.resultWrapper}>
          <ScrollView>
            <View style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="qr-code-outline" size={22} color={colors.brandColor} />
                <Text style={styles.title}>Scan Result</Text>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>{detectType(data)}</Text>
              </View>

              <Text style={styles.label}>Scanned Data</Text>
              <Text style={styles.value}>{data}</Text>
            </View>

            <TouchableOpacity
              style={styles.scanAgainBtn}
              onPress={() => {
                setScanned(false);
                setData('');
              }}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.scanAgainText}>Scan Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultWrapper: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#F9F9F9',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '55%',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: {
    color: colors.brandColor,
    fontWeight: '600',
    fontSize: 12,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  value: {
    fontSize: 14,
    color: '#222',
    lineHeight: 22,
  },
  scanAgainBtn: {
    marginTop: 20,
    backgroundColor: colors.brandColor,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanAgainText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  backBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  backText: {
    color: '#555',
    fontSize: 14,
  },
});
