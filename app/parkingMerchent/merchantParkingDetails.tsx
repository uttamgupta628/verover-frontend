import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Interface for Zone Data
interface Zone {
  id: string;
  name: string;
  slots: string;
  price: string;
}

export default function ParkingDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // --- State Initialization ---
  
  // 1. Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // 2. Form Data State (Merged existing params with new screenshot data)
  const [formData, setFormData] = useState({
    title: (params.title as string) || 'Parking Lot Name',
    location: (params.location as string) || 'Asam,India',
    price: (params.price as string) || '1.00',
    description: (params.description as string) || "Residential parking refers to parking spaces designated for residents of a specific area, often involving permits.",
    
    // New Fields from Screenshot
    contactNumber: '6291015951',
    email: 'Not provided',
    latitude: '37.421998',
    longitude: '-122.084000',
    zones: [
      { id: '1', name: 'Zone A', slots: '10', price: '1.00' },
      { id: '2', name: 'Zone B', slots: '20', price: '1.00' },
    ] as Zone[]
  });

  // Images handling
  const imageList = params.images ? JSON.parse(params.images as string) : [];
  const images = imageList.length > 0 ? imageList : ['https://via.placeholder.com/400x300?text=No+Image'];

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);


  // --- Logic & Handlers ---

  const handleToggleEdit = () => {
    if (isEditing) {
      // Save logic would go here (e.g., API call)
      Alert.alert("Saved", "Your changes have been updated successfully.");
    }
    setIsEditing(!isEditing);
  };

  const updateZone = (id: string, field: keyof Zone, value: string) => {
    const updatedZones = formData.zones.map(z => 
      z.id === id ? { ...z, [field]: value } : z
    );
    setFormData({ ...formData, zones: updatedZones });
  };

  // --- Slider Logic (Same as before) ---
  const scrollToIndex = (index: number) => {
    if (index >= 0 && index < images.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }).current;


  // --- Render Helpers ---

  // Helper to render a simple Text or TextInput based on mode
  const EditableText = ({ 
    value, 
    onChangeText, 
    style, 
    placeholder, 
    multiline = false,
    keyboardType = 'default' 
  }: any) => {
    if (isEditing) {
      return (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[style, styles.editableInput]}
          placeholder={placeholder}
          multiline={multiline}
          keyboardType={keyboardType}
        />
      );
    }
    return <Text style={style}>{value}</Text>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color="#F59E0B" size={28} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Parking</Text>
          
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleToggleEdit}>
              <Text style={styles.editText}>{isEditing ? 'Save' : 'Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert("Delete")} style={{ marginLeft: 15 }}>
              <Trash2 color="#FF3B30" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          
          {/* Image Slider */}
          <View style={styles.sliderContainer}>
            <FlatList
              ref={flatListRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              onViewableItemsChanged={onViewableItemsChanged}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.sliderImage} resizeMode="cover" />
              )}
            />
            {/* Slider Controls */}
            <View style={styles.sliderControls}>
              <TouchableOpacity onPress={() => scrollToIndex(activeIndex - 1)} style={styles.arrowButton}>
                <ChevronLeft color="#fff" size={24} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => scrollToIndex(activeIndex + 1)} style={styles.arrowButton}>
                <ChevronRight color="#fff" size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {/* MAIN INFO CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>P</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelSmall}>Parking Lot Name</Text>
                <EditableText 
                  value={formData.title} 
                  onChangeText={(t: string) => setFormData({...formData, title: t})}
                  style={styles.lotName} 
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Address</Text>
              <EditableText 
                value={formData.location}
                onChangeText={(t: string) => setFormData({...formData, location: t})}
                style={styles.valueText}
              />
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Price per Hour</Text>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                 {/* Only editing the number part to keep styling simple */}
                 <Text style={[styles.priceText, {marginRight: 2}]}>$</Text>
                 <EditableText 
                    value={formData.price.replace('$','')} // Strip $ for editing
                    onChangeText={(t: string) => setFormData({...formData, price: t})}
                    style={styles.priceText}
                    keyboardType="numeric"
                 />
                 <Text style={styles.priceText}>/hr</Text>
              </View>
            </View>
          </View>

          {/* ABOUT SECTION */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <EditableText 
              value={formData.description}
              onChangeText={(t: string) => setFormData({...formData, description: t})}
              style={styles.aboutText}
              multiline={true}
            />
          </View>

          {/* 1. CONTACT INFORMATION (New) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact Information</Text>
            
            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Contact Number</Text>
              <EditableText 
                value={formData.contactNumber}
                onChangeText={(t: string) => setFormData({...formData, contactNumber: t})}
                style={styles.valueText}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Email</Text>
              <EditableText 
                value={formData.email}
                onChangeText={(t: string) => setFormData({...formData, email: t})}
                style={styles.valueText}
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* 2. PARKING ZONES & SPACES (New) */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, {marginBottom: 15}]}>Parking Zones & Spaces</Text>
            
            {formData.zones.map((zone, index) => (
              <View key={zone.id}>
                {index > 0 && <View style={[styles.divider, { marginVertical: 12 }]} />}
                
                <Text style={styles.zoneName}>{zone.name}</Text>
                
                <View style={styles.zoneRow}>
                  {/* Slots Input */}
                  <View style={styles.zoneItem}>
                    <Text style={styles.zoneLabel}>Slots: </Text>
                    <EditableText 
                      value={zone.slots}
                      onChangeText={(t: string) => updateZone(zone.id, 'slots', t)}
                      style={styles.zoneValue}
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Price Input */}
                  <View style={styles.zoneItem}>
                    <Text style={styles.zoneLabel}>Price: </Text>
                    <Text style={styles.zoneValue}>$</Text>
                    <EditableText 
                      value={zone.price}
                      onChangeText={(t: string) => updateZone(zone.id, 'price', t)}
                      style={styles.zoneValue}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* 3. LOCATION (New) */}
          <View style={[styles.card, {marginBottom: 50}]}>
            <Text style={styles.cardTitle}>Location</Text>
            
            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Latitude</Text>
              <EditableText 
                value={formData.latitude}
                onChangeText={(t: string) => setFormData({...formData, latitude: t})}
                style={styles.valueText}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Longitude</Text>
              <EditableText 
                value={formData.longitude}
                onChangeText={(t: string) => setFormData({...formData, longitude: t})}
                style={styles.valueText}
                keyboardType="numeric"
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  // Inputs in Edit Mode
  editableInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
    backgroundColor: '#FFF8E1',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: { padding: 4 },
  editText: {
    color: '#F59E0B',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Slider
  sliderContainer: {
    height: 250,
    width: width - 32,
    alignSelf: 'center',
    marginVertical: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sliderImage: {
    width: width - 32,
    height: 250,
  },
  sliderControls: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  arrowButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 25,
    padding: 8,
  },

  // Generic Card Styles
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoContainer: {
    width: 50, height: 50,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  logoText: {
    fontSize: 28, fontWeight: '900', color: '#F59E0B',
  },
  lotName: {
    fontSize: 18, fontWeight: '600', color: '#000',
  },
  divider: {
    height: 1, backgroundColor: '#F0F0F0', marginBottom: 15,
  },
  infoBlock: {
    marginBottom: 15,
  },
  labelSmall: {
    fontSize: 13, color: '#999', marginBottom: 4,
  },
  valueText: {
    fontSize: 16, color: '#333', fontWeight: '500',
  },
  priceText: {
    fontSize: 18, color: '#F59E0B', fontWeight: 'bold',
  },
  aboutText: {
    fontSize: 14, color: '#444', lineHeight: 22,
  },

  // Zone Styles
  zoneName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneLabel: {
    fontSize: 14,
    color: '#888',
  },
  zoneValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});