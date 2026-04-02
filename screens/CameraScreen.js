import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMemo, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CameraScreen() {
  const cameraReference = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState('back');  
  const [flashEnabled, setFlashEnabled] = useState(false);

  // State for barcode scanning
  const [hasScanned, setHasScanned] = useState(false);
  const [scanResult, setScanResult] = useState(null);    

  // Barcode scanner configuration
  // Temporary templates fo types
  const barcodeSettings = useMemo(
    () => ({
      barcodeTypes: [
        'qr', 'pdf417', 'datamatrix', 'aztec',
        'ean13', 'ean8', 'upc_e', 'upc_a',
        'code128', 'code39', 'code93', 'itf14',
      ],
    }),
    []
  );

  // Still loading permissions
  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: '#fff', marginBottom: 12, textAlign: 'center' }}>
          We need camera permission to scan barcodes
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Check if scanned data is a valid URL
  function checkIfValidUrl(text) {
    try {
      const url = new URL(text);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  const handleBarcodeScanned = ({ data, type }) => {
    if (hasScanned) return; // Prevent multiple scans
    
    setHasScanned(true);
    setScanResult({ data, type });
  };

  const resetScanning = () => {
    setScanResult(null);
    setHasScanned(false);
  };

  const handleOpenUrl = async () => {
    if (scanResult && checkIfValidUrl(scanResult.data)) {
      try {
        await Linking.openURL(scanResult.data);
      } catch (error) {
        Alert.alert('Error', 'Could not open the URL');
      }
    } else {
      Alert.alert('Not a URL', 'The scanned code is not a valid web link.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={cameraReference}
        style={{ flex: 1 }}
        facing={cameraFacing}
        enableTorch={flashEnabled}
        barcodeScannerSettings={barcodeSettings}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Scanning overlay with reticle */}
      <View pointerEvents="none" style={styles.scanningOverlay}>
        <View style={styles.scanningReticle} />
      </View>

      {/* Top controls bar */}
      <View style={styles.topControlsBar}>
        <TouchableOpacity 
          onPress={() => setFlashEnabled(prev => !prev)} 
          style={styles.controlButton}
        >
          <Ionicons name={flashEnabled ? 'flash' : 'flash-off'} size={22} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.screenTitle}>Scan QR Code</Text>
        
        <TouchableOpacity
          onPress={() => setCameraFacing(current => (current === 'back' ? 'front' : 'back'))}
          style={styles.controlButton}
        >
          <Ionicons name="camera-reverse" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Result bottom sheet */}
      {scanResult && (
        <View style={styles.resultSheet}>
          <Text style={styles.resultTitle}>Code Scanned Successfully</Text>
          <Text numberOfLines={2} style={styles.resultData}>
            {scanResult.data}
          </Text>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity 
              onPress={resetScanning} 
              style={[styles.actionButton, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>Scan Again</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleOpenUrl} 
              style={[styles.actionButton, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>
                {checkIfValidUrl(scanResult.data) ? 'Open Link' : 'View'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#000',
    paddingHorizontal: 20,
  },
  permissionButton: { 
    backgroundColor: '#3EA0D1', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 8 
  },
  permissionButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },

  topControlsBar: {
    position: 'absolute', 
    top: 50, 
    left: 16, 
    right: 16,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  controlButton: { 
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  screenTitle: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 18,
  },

  scanningOverlay: {
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  scanningReticle: {
    width: 250, 
    height: 250, 
    borderRadius: 20,
    borderWidth: 3, 
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
  },

  resultSheet: {
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0,
    padding: 20, 
    backgroundColor: 'rgba(40,40,40,0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  resultTitle: { 
    color: '#fff', 
    fontWeight: '600', 
    marginBottom: 8,
    fontSize: 16,
  },
  resultData: { 
    color: '#e0e0e0', 
    fontSize: 14, 
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButtonsRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  actionButton: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  primaryButton: { 
    backgroundColor: '#3EA0D1' 
  },
  primaryButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: { 
    backgroundColor: '#fff' 
  },
  secondaryButtonText: { 
    color: '#333', 
    fontWeight: '600',
    fontSize: 16,
  },
});