import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { ArrowLeft, Camera, Plus, X, Clock, DollarSign, MapPin, User, Mail } from 'lucide-react-native';

// Enable layout animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  primary: '#F59E0B', // Orange
  secondary: '#FFF7ED', // Light Orange BG
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#10B981',
};

// --- Reusable Components ---

const SectionHeader = ({ title, subtitle }) => (
  <View style={styles.sectionHeaderContainer}>
    <Text style={styles.sectionHeader}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
  </View>
);

const CustomToggle = ({ value, onToggle, label, activeLabel = 'YES', inactiveLabel = 'NO' }) => (
  <View style={styles.toggleWrapper}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
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
      <View style={[
        styles.toggleKnob, 
        value ? { right: 2 } : { left: 2 }
      ]} />
    </TouchableOpacity>
  </View>
);

const FormInput = ({ label, value, onChangeText, placeholder, icon, multiline, keyboardType = 'default' }) => (
  <View style={styles.inputGroup}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View style={[styles.inputContainer, multiline && styles.textAreaContainer]}>
      {icon && <View style={styles.inputIconWrapper}>{icon}</View>}
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  </View>
);

const DaySchedule = ({ dayData, onUpdate }) => {
  const { day, isOpen, openTime, closeTime, is24Hours } = dayData;

  const handleToggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onUpdate({ ...dayData, isOpen: !isOpen });
  };

  const handleToggle24Hr = () => {
    onUpdate({ ...dayData, is24Hours: !is24Hours });
  };

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{day}</Text>
        <CustomToggle 
          value={isOpen} 
          onToggle={handleToggleOpen} 
          activeLabel="OPEN" 
          inactiveLabel="CLOSED" 
        />
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
             <CustomToggle 
              label="24 Hours?" 
              value={is24Hours} 
              onToggle={handleToggle24Hr} 
            />
          </View>
        </View>
      )}
    </View>
  );
};

// --- Main Screen ---

export default function RegisterParkingLot() {
  // State: Basic Info
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [about, setAbout] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  
  // State: Vehicle Type
  const [vehicleType, setVehicleType] = useState('Both');
  
  // State: Images
  const [imageCount, setImageCount] = useState(0);

  // State: Zones (Dynamic)
  const [zones, setZones] = useState([
    { id: '1', name: 'Zone A', capacity: '10', occupied: '0' },
    { id: '2', name: 'Zone B', capacity: '5', occupied: '0' },
  ]);

  // State: Schedule (7 Days)
  const initialSchedule = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => ({
    day,
    isOpen: day !== 'SAT' && day !== 'SUN', // Example logic
    openTime: '09:00',
    closeTime: '21:00',
    is24Hours: false,
  }));
  const [schedule, setSchedule] = useState(initialSchedule);

  // Derived State: Total Slots Calculation
  const totalSlots = useMemo(() => {
    return zones.reduce((acc, zone) => acc + (parseInt(zone.capacity) || 0), 0);
  }, [zones]);

  // Handlers
  const addZone = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newId = (zones.length + 1).toString() + Date.now();
    setZones([...zones, { id: newId, name: '', capacity: '', occupied: '' }]);
  };

  const removeZone = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setZones(zones.filter(z => z.id !== id));
  };

  const updateZone = (id, field, value) => {
    setZones(zones.map(z => z.id === id ? { ...z, [field]: value } : z));
  };

  const updateDaySchedule = (updatedDay) => {
    setSchedule(schedule.map(d => d.day === updatedDay.day ? updatedDay : d));
  };

  const handleSave = () => {
    // Simulate API Payload
    const payload = {
      name, address, price, about, contactName, email,
      vehicleType,
      zones,
      totalSlots,
      schedule
    };
    
    if(!name || !price) {
      Alert.alert('Missing Fields', 'Please fill in Name and Price.');
      return;
    }

    console.log(JSON.stringify(payload, null, 2));
    Alert.alert('Success', 'Parking Lot Registered Successfully!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn}>
          <ArrowLeft color={COLORS.primary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Parking Lot</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Progress Tabs */}
          <View style={styles.tabsContainer}>
            <View style={styles.tabInactive}><Text style={styles.tabTextInactive}>Location</Text></View>
            <View style={styles.tabActive}><Text style={styles.tabTextActive}>Parking Info</Text></View>
            <View style={styles.tabInactive}><Text style={styles.tabTextInactive}>Photos</Text></View>
          </View>

          {/* Image Picker */}
          <TouchableOpacity 
            style={styles.imagePicker} 
            onPress={() => setImageCount(prev => Math.min(prev + 1, 5))}
          >
            <Camera color={COLORS.primary} size={32} />
            <Text style={styles.imagePickerText}>
              {imageCount > 0 ? `${imageCount} Images Selected` : 'Tap to Upload Images (0/5)'}
            </Text>
          </TouchableOpacity>

          {/* Basic Info */}
          <FormInput 
            label="Parking Lot Name*" 
            placeholder="e.g. City Center Parking" 
            value={name} 
            onChangeText={setName} 
          />
          <FormInput 
            label="Address" 
            placeholder="Search address..." 
            value={address} 
            onChangeText={setAddress}
            icon={<MapPin size={18} color={COLORS.textLight} />}
          />
          <FormInput 
            label="Price / Hour*" 
            placeholder="0.00" 
            value={price} 
            onChangeText={setPrice}
            keyboardType="numeric"
            icon={<DollarSign size={18} color={COLORS.textLight} />}
          />

          {/* Vehicle Type */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Vehicle Type Accepted*</Text>
            <View style={styles.vehicleRow}>
              {['Bike', 'Car', 'Both'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setVehicleType(type)}
                  style={[
                    styles.vehicleBtn,
                    vehicleType === type && styles.vehicleBtnActive
                  ]}
                >
                  <Text style={[
                    styles.vehicleBtnText,
                    vehicleType === type && styles.vehicleBtnTextActive
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Zones */}
          <View style={styles.section}>
            <SectionHeader title="Zones & Spaces" subtitle={`Total Capacity: ${totalSlots}`} />
            
            {zones.map((zone, index) => (
              <View key={zone.id} style={styles.zoneRow}>
                <View style={styles.zoneInputWrapper}>
                  <Text style={styles.zoneLabel}>Name</Text>
                  <TextInput 
                    style={styles.zoneInput} 
                    placeholder="Zone A" 
                    value={zone.name}
                    onChangeText={(t) => updateZone(zone.id, 'name', t)}
                  />
                </View>
                <View style={[styles.zoneInputWrapper, { width: 80 }]}>
                  <Text style={styles.zoneLabel}>Capacity</Text>
                  <TextInput 
                    style={[styles.zoneInput, { textAlign: 'center' }]} 
                    placeholder="0" 
                    keyboardType="numeric"
                    value={zone.capacity}
                    onChangeText={(t) => updateZone(zone.id, 'capacity', t)}
                  />
                </View>
                 <View style={[styles.zoneInputWrapper, { width: 80 }]}>
                  <Text style={styles.zoneLabel}>Occupied</Text>
                  <TextInput 
                    style={[styles.zoneInput, { textAlign: 'center' }]} 
                    placeholder="0" 
                    keyboardType="numeric"
                    value={zone.occupied}
                    onChangeText={(t) => updateZone(zone.id, 'occupied', t)}
                  />
                </View>
                <TouchableOpacity onPress={() => removeZone(zone.id)} style={styles.removeZoneBtn}>
                  <X color={COLORS.danger} size={20} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addZoneBtn} onPress={addZone}>
              <Plus color={COLORS.primary} size={20} />
              <Text style={styles.addZoneText}>Add New Zone</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Info */}
          <View style={styles.section}>
            <SectionHeader title="Contact Info" />
            <FormInput 
              label="Contact Person" 
              placeholder="Full Name" 
              value={contactName}
              onChangeText={setContactName}
              icon={<User size={18} color={COLORS.textLight} />}
            />
            <FormInput 
              label="Email" 
              placeholder="email@example.com" 
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              icon={<Mail size={18} color={COLORS.textLight} />}
            />
            <FormInput 
              label="About" 
              placeholder="Describe your parking lot policies..." 
              multiline={true} 
              value={about}
              onChangeText={setAbout}
            />
          </View>

          {/* Availability */}
          <View style={styles.section}>
            <SectionHeader title="Weekly Availability" />
            {schedule.map((dayData, index) => (
              <DaySchedule 
                key={dayData.day} 
                dayData={dayData} 
                onUpdate={updateDaySchedule} 
              />
            ))}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  saveBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  iconBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 25,
  },
  tabInactive: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  tabTextInactive: { color: COLORS.textLight, fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Image Picker
  imagePicker: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: COLORS.secondary,
  },
  imagePickerText: {
    color: COLORS.primary,
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },

  // Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
  },
  textAreaContainer: { height: 100, alignItems: 'flex-start', paddingTop: 12 },
  inputIconWrapper: { marginRight: 10 },
  input: { flex: 1, color: COLORS.text, fontSize: 15 },
  textArea: { textAlignVertical: 'top' },

  // Section Headers
  section: { marginBottom: 30 },
  sectionHeaderContainer: { marginBottom: 16 },
  sectionHeader: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sectionSubtitle: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },

  // Vehicle Type
  vehicleRow: { flexDirection: 'row', gap: 12 },
  vehicleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  vehicleBtnActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  vehicleBtnText: { color: COLORS.textLight, fontWeight: '600' },
  vehicleBtnTextActive: { color: COLORS.primary, fontWeight: '700' },

  // Zones
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
    marginTop: 8,
    backgroundColor: COLORS.secondary,
  },
  addZoneText: { color: COLORS.primary, fontWeight: '700', marginLeft: 6 },

  // Day Schedule Card
  dayCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
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
  dayFooter: { marginTop: 12, alignItems: 'flex-start' },

  // Custom Toggle
  toggleWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleContainer: {
    width: 64,
    height: 32,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleInternal: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  toggleText: { fontSize: 10, fontWeight: '800' },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
});