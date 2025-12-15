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
  KeyboardAvoidingView,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Plus, X, Camera } from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#F59E0B',
  secondary: '#FFF7ED',
  surface: '#F8F9FA',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  danger: '#EF4444',
};

interface Zone {
  id: string;
  name: string;
  slots: string;
  price: string;
}

const CustomToggle = ({ value, onToggle, activeLabel = 'OPEN', inactiveLabel = 'CLOSED' }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onToggle}
    style={[
      styles.toggleContainer,
      { 
        backgroundColor: value ? COLORS.primary : COLORS.surface,
        borderColor: value ? COLORS.primary : COLORS.border 
      }
    ]}
  >
    <View style={styles.toggleInternal}>
      <Text style={[styles.toggleText, { color: value ? '#fff' : COLORS.textLight }]}>
        {value ? activeLabel : inactiveLabel}
      </Text>
    </View>
    <View style={[styles.toggleKnob, value ? { right: 2 } : { left: 2 }]} />
  </TouchableOpacity>
);

const DaySchedule = ({ dayData, onUpdate, isEditing }: any) => {
  const { day, isOpen, openTime, closeTime, is24Hours } = dayData;

  const handleToggleOpen = () => {
    if (!isEditing) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onUpdate({ ...dayData, isOpen: !isOpen });
  };

  const handleToggle24Hr = () => {
    if (!isEditing) return;
    onUpdate({ ...dayData, is24Hours: !is24Hours });
  };

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{day}</Text>
        <CustomToggle value={isOpen} onToggle={handleToggleOpen} />
      </View>

      {isOpen && (
        <View style={styles.dayBody}>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Open Time</Text>
              <View style={[styles.timeInput, is24Hours && styles.disabledInput]}>
                <Text style={styles.timeText}>{is24Hours ? '00:00' : openTime}</Text>
              </View>
            </View>
            <View style={{ width: 15 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Close Time</Text>
              <View style={[styles.timeInput, is24Hours && styles.disabledInput]}>
                <Text style={styles.timeText}>{is24Hours ? '23:59' : closeTime}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.dayFooter}>
            <Text style={styles.toggleLabel}>24 Hours?</Text>
            <CustomToggle 
              value={is24Hours} 
              onToggle={handleToggle24Hr}
              activeLabel="YES"
              inactiveLabel="NO"
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default function MerchantGarageDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const parseZones = (): Zone[] => {
    try {
      if (params.zones && typeof params.zones === 'string') {
        return JSON.parse(params.zones);
      }
    } catch (e) {
      console.error('Error parsing zones:', e);
    }
    return [{ id: '1', name: 'Zone A', slots: '10', price: '100.00' }];
  };

  const parseImages = (): string[] => {
    try {
      if (params.images && typeof params.images === 'string') {
        const parsed = JSON.parse(params.images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error parsing images:', e);
    }
    
    if (params.logo && typeof params.logo === 'string') {
      return [params.logo];
    }
    
    return ['https://images.unsplash.com/photo-1590674899505-1c5c41951f89?q=80&w=2070&auto=format&fit=crop'];
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [imageCount, setImageCount] = useState(parseImages().length);

  const [formData, setFormData] = useState({
    title: (params.title as string) || 'Garage Name',
    location: (params.location as string) || (params.address as string) || 'Location not provided',
    price: (params.price as string) || '100.00',
    description: (params.description as string) || "No description provided.",
    contactNumber: (params.phone as string) || 'Not provided',
    email: (params.email as string) || 'Not provided',
    latitude: (params.latitude as string) || '0.0',
    longitude: (params.longitude as string) || '0.0',
    slots: (params.slots as string) || '0',
    status: (params.status as string) || '24/7 Open',
    zones: parseZones()
  });

  const initialSchedule = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => ({
    day,
    isOpen: day !== 'SAT' && day !== 'SUN',
    openTime: '09:00',
    closeTime: '21:00',
    is24Hours: false,
  }));
  const [schedule, setSchedule] = useState(initialSchedule);

  const images = parseImages();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleToggleEdit = () => {
    if (isEditing) {
      Alert.alert("Saved", "Your changes have been updated successfully.");
    }
    setIsEditing(!isEditing);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Garage",
      "Are you sure you want to delete this garage? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => router.back()
        }
      ]
    );
  };

  const addZone = () => {
    if (!isEditing) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newId = (formData.zones.length + 1).toString() + Date.now();
    setFormData({
      ...formData,
      zones: [...formData.zones, { id: newId, name: '', slots: '', price: '' }]
    });
  };

  const removeZone = (id: string) => {
    if (!isEditing) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFormData({
      ...formData,
      zones: formData.zones.filter(z => z.id !== id)
    });
  };

  const updateZone = (id: string, field: keyof Zone, value: string) => {
    if (!isEditing) return;
    const updatedZones = formData.zones.map(z => 
      z.id === id ? { ...z, [field]: value } : z
    );
    setFormData({ ...formData, zones: updatedZones });
  };

  const updateDaySchedule = (updatedDay: any) => {
    if (!isEditing) return;
    setSchedule(schedule.map(d => d.day === updatedDay.day ? updatedDay : d));
  };

  const scrollToIndex = (index: number) => {
    if (index >= 0 && index < images.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }).current;

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

  const totalSlots = formData.zones.reduce((acc, zone) => acc + (parseInt(zone.slots) || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={COLORS.primary} size={28} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Garage Details</Text>
          
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleToggleEdit}>
              <Text style={styles.editText}>{isEditing ? 'Save' : 'Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={{ marginLeft: 15 }}>
              <Trash2 color="#FF3B30" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          
          {isEditing ? (
            <TouchableOpacity 
              style={styles.imagePicker} 
              onPress={() => setImageCount(prev => Math.min(prev + 1, 5))}
            >
              <Camera color={COLORS.primary} size={32} />
              <Text style={styles.imagePickerText}>
                {imageCount > 0 ? `${imageCount} Images Selected` : 'Tap to Upload Images (0/5)'}
              </Text>
            </TouchableOpacity>
          ) : (
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
              {images.length > 1 && (
                <>
                  <View style={styles.sliderControls}>
                    <TouchableOpacity onPress={() => scrollToIndex(activeIndex - 1)} style={styles.arrowButton}>
                      <ChevronLeft color="#fff" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => scrollToIndex(activeIndex + 1)} style={styles.arrowButton}>
                      <ChevronRight color="#fff" size={24} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.imageCounter}>
                    <Text style={styles.imageCounterText}>{activeIndex + 1} / {images.length}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>G</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelSmall}>Garage Name</Text>
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
              <Text style={styles.labelSmall}>Base Price per Hour</Text>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                <Text style={[styles.priceText, {marginRight: 2}]}>$</Text>
                <EditableText 
                  value={formData.price.replace('$','')} 
                  onChangeText={(t: string) => setFormData({...formData, price: t})}
                  style={styles.priceText}
                  keyboardType="numeric"
                />
                <Text style={styles.priceText}>/hr</Text>
              </View>
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.labelSmall}>Status</Text>
              {isEditing ? (
                <View style={styles.statusToggleRow}>
                  {['24/7 Open', 'Limited Hours'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setFormData({...formData, status})}
                      style={[
                        styles.statusToggleBtn,
                        formData.status === status && styles.statusToggleBtnActive
                      ]}
                    >
                      <Text style={[
                        styles.statusToggleText,
                        formData.status === status && styles.statusToggleTextActive
                      ]}>{status}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={[
                  styles.statusBadge,
                  formData.status === '24/7 Open' ? styles.statusGreen : styles.statusRed
                ]}>
                  <Text style={styles.statusText}>{formData.status}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>About Garage</Text>
            <EditableText 
              value={formData.description}
              onChangeText={(t: string) => setFormData({...formData, description: t})}
              style={styles.aboutText}
              multiline={true}
            />
          </View>

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

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Parking Zones & Spaces</Text>
              <Text style={styles.totalCapacity}>Total: {totalSlots} slots</Text>
            </View>
            
            {formData.zones.map((zone, index) => (
              <View key={zone.id}>
                {index > 0 && <View style={[styles.divider, { marginVertical: 12 }]} />}
                
                {isEditing ? (
                  <View style={styles.zoneRow}>
                    <View style={styles.zoneInputWrapper}>
                      <Text style={styles.zoneLabel}>Zone Name</Text>
                      <TextInput
                        style={styles.zoneInput}
                        placeholder="Zone A"
                        value={zone.name}
                        onChangeText={(t) => updateZone(zone.id, 'name', t)}
                      />
                    </View>
                    <View style={[styles.zoneInputWrapper, { width: 70 }]}>
                      <Text style={styles.zoneLabel}>Slots</Text>
                      <TextInput
                        style={[styles.zoneInput, { textAlign: 'center' }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={zone.slots}
                        onChangeText={(t) => updateZone(zone.id, 'slots', t)}
                      />
                    </View>
                    <View style={[styles.zoneInputWrapper, { width: 70 }]}>
                      <Text style={styles.zoneLabel}>Price</Text>
                      <TextInput
                        style={[styles.zoneInput, { textAlign: 'center' }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={zone.price}
                        onChangeText={(t) => updateZone(zone.id, 'price', t)}
                      />
                    </View>
                    <TouchableOpacity onPress={() => removeZone(zone.id)} style={styles.removeZoneBtn}>
                      <X color={COLORS.danger} size={20} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <View style={styles.zoneDisplayRow}>
                      <View style={styles.zoneItem}>
                        <Text style={styles.zoneDisplayLabel}>Slots: </Text>
                        <Text style={styles.zoneValue}>{zone.slots}</Text>
                      </View>
                      <View style={styles.zoneItem}>
                        <Text style={styles.zoneDisplayLabel}>Price: </Text>
                        <Text style={styles.zoneValue}>${zone.price}/hr</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            ))}

            {isEditing && (
              <TouchableOpacity style={styles.addZoneBtn} onPress={addZone}>
                <Plus color={COLORS.primary} size={20} />
                <Text style={styles.addZoneText}>Add New Zone</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location Coordinates</Text>
            
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

          <View style={[styles.card, {marginBottom: 50}]}>
            <Text style={styles.cardTitle}>Weekly Availability</Text>
            {schedule.map((dayData) => (
              <DaySchedule 
                key={dayData.day} 
                dayData={dayData} 
                onUpdate={updateDaySchedule}
                isEditing={isEditing}
              />
            ))}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  editableInput: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.secondary,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 4 },
  editText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  
  imagePicker: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 20,
    backgroundColor: COLORS.secondary,
  },
  imagePickerText: { color: COLORS.primary, marginTop: 8, fontSize: 14, fontWeight: '600' },
  
  sliderContainer: {
    height: 250,
    width: width - 32,
    alignSelf: 'center',
    marginVertical: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sliderImage: { width: width - 32, height: 250 },
  sliderControls: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  arrowButton: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25, padding: 8 },
  imageCounter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageCounterText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

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
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalCapacity: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  logoContainer: {
    width: 50, height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  logoText: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  lotName: { fontSize: 18, fontWeight: '600', color: '#000' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 15 },
  infoBlock: { marginBottom: 15 },
  labelSmall: { fontSize: 13, color: '#999', marginBottom: 4 },
  valueText: { fontSize: 16, color: '#333', fontWeight: '500' },
  priceText: { fontSize: 18, color: COLORS.primary, fontWeight: 'bold' },
  aboutText: { fontSize: 14, color: '#444', lineHeight: 22 },
  
  statusToggleRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statusToggleBtnActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.primary },
  statusToggleText: { color: COLORS.textLight, fontWeight: '600', fontSize: 13 },
  statusToggleTextActive: { color: COLORS.primary, fontWeight: '700' },
  
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  statusGreen: { backgroundColor: '#4CAF50' },
  statusRed: { backgroundColor: '#FF4444' },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  zoneName: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 8 },
  zoneDisplayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zoneItem: { flexDirection: 'row', alignItems: 'center' },
  zoneDisplayLabel: { fontSize: 14, color: '#888' },
  zoneValue: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  zoneInputWrapper: { flex: 1 },
  zoneLabel: { fontSize: 10, color: COLORS.textLight, marginBottom: 4, fontWeight: '600' },
  zoneInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  removeZoneBtn: {
    height: 42,
    width: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  addZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: COLORS.secondary,
  },
  addZoneText: { color: COLORS.primary, fontWeight: '700', marginLeft: 6 },

  dayCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayBody: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.surface },
  dayTitle: { fontWeight: '800', fontSize: 16, color: COLORS.text },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subLabel: { fontSize: 11, color: COLORS.textLight, marginBottom: 4, fontWeight: '600' },
  timeInput: {
    backgroundColor: COLORS.surface,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabledInput: { backgroundColor: '#E5E7EB', borderColor: '#E5E7EB' },
  timeText: { fontWeight: '600', color: COLORS.text },
  dayFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  toggleContainer: {
    width: 64,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    position: 'relative',
  },
  toggleInternal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleKnob: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});