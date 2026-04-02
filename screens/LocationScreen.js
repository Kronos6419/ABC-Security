import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LocationScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  
  // Permission state
  const [hasLocationPermission, setHasLocationPermission] = useState(null); 
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  
  // Location state
  const [mapRegion, setMapRegion] = useState({
    latitude: -36.8485, // Default to Auckland, NZ
    longitude: 174.7633,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [currentAddress, setCurrentAddress] = useState('');

  const getCurrentLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000, // 15 second timeout
      });
      
      const { latitude, longitude } = position.coords;
      
      // Update map region
      setMapRegion(previousRegion => ({
        ...previousRegion,
        latitude,
        longitude,
        latitudeDelta: 0.005, // Zoom in closer when we get actual location
        longitudeDelta: 0.005,
      }));

      // Try to get address from coordinates
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ 
          latitude, 
          longitude 
        });
        
        if (reverseGeocode && reverseGeocode[0]) {
          const addressData = reverseGeocode[0];
          const formattedAddress = [
            addressData.name,
            addressData.street, 
            addressData.subregion, 
            addressData.city, 
            addressData.region, 
            addressData.country
          ]
            .filter(Boolean) // Remove null/undefined values
            .join(', ');
          setCurrentAddress(formattedAddress);
        } else {
          setCurrentAddress('Address unavailable');
        }
      } catch (geocodeError) {
        console.warn('Reverse geocoding failed:', geocodeError);
        setCurrentAddress('Address lookup failed');
      }
    } catch (locationError) {
      console.warn('Location error:', locationError);
      Alert.alert(
        'Location Error', 
        'Could not get your current location. Please check your GPS settings.'
      );
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setHasLocationPermission(false);
          setIsLoadingLocation(false);
          return;
        }
        
        setHasLocationPermission(true);
        await getCurrentLocation();
      } catch (error) {
        console.warn('Permission request failed:', error);
        setHasLocationPermission(false);
        setIsLoadingLocation(false);
      }
    };

    requestLocationPermission();
  }, [getCurrentLocation]);

  const handleRecenterMap = async () => {
    if (!hasLocationPermission) {
      Alert.alert('Permission Required', 'Location permission is needed to center the map.');
      return;
    }
    
    await getCurrentLocation();
  };

  const openInExternalMaps = () => {
    const { latitude, longitude } = mapRegion;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    
    Linking.openURL(mapsUrl).catch(error => {
      console.warn('Could not open maps:', error);
      Alert.alert('Error', 'Could not open external maps application.');
    });
  };

  // Show permission denied message
  if (hasLocationPermission === false) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="location-outline" size={48} color="#ccc" style={{ marginBottom: 16 }} />
        <Text style={styles.permissionTitle}>Location Access Required</Text>
        <Text style={styles.permissionDescription}>
          This app needs location permission to show your current position on the map.
          Please enable location services in your device settings and restart the app.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Map View */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        region={mapRegion}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={false} // We'll use our own button
        toolbarEnabled={false}
        onRegionChangeComplete={setMapRegion}
      >
        <Marker
          coordinate={{ 
            latitude: mapRegion.latitude, 
            longitude: mapRegion.longitude 
          }}
          title="Current Location"
          description={currentAddress || "You are here"}
        />
      </MapView>

      {/* Loading indicator */}
      {isLoadingLocation && (
        <View style={[
          styles.loadingOverlay, 
          { bottom: (safeAreaInsets.bottom || 10) + 130 }
        ]}>
          <ActivityIndicator size="small" color="#3EA0D1" />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      )}

      {/* Bottom info panel */}
      <View style={[
        styles.bottomPanel, 
        { paddingBottom: Math.max(safeAreaInsets.bottom, 16) }
      ]}>
        <View style={styles.locationInfo}>
          <Text style={styles.locationTitle}>Current Position</Text>
          <Text style={styles.locationDetails}>
            {currentAddress || `${mapRegion.latitude.toFixed(5)}, ${mapRegion.longitude.toFixed(5)}`}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            onPress={handleRecenterMap} 
            style={[styles.actionButton, styles.secondaryActionButton]}
            disabled={isLoadingLocation}
          >
            <Ionicons name="locate" size={18} color="#222" />
            <Text style={styles.secondaryButtonText}>
              {isLoadingLocation ? 'Loading...' : 'Recenter'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={openInExternalMaps} 
            style={[styles.actionButton, styles.primaryActionButton]}
          >
            <Ionicons name="map" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24,
    backgroundColor: '#F6F7F9',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDescription: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  loadingOverlay: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e2e2',
  },
  locationInfo: {
    marginBottom: 16,
  },
  locationTitle: { 
    fontWeight: '600', 
    marginBottom: 4, 
    color: '#222',
    fontSize: 16,
  },
  locationDetails: { 
    color: '#555', 
    fontSize: 14,
    lineHeight: 18,
  },
  buttonRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryActionButton: { 
    backgroundColor: '#3EA0D1' 
  },
  primaryButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryActionButton: { 
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#d7d7d7' 
  },
  secondaryButtonText: { 
    color: '#222', 
    fontWeight: '600',
    fontSize: 16,
  },
});