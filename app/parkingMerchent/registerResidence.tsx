import React, { useState, useMemo } from 'react';
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
import { ArrowLeft, Camera, Plus, X, DollarSign, MapPin, User, Mail, Phone } from 'lucide-react-native';
import { useRouter } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  primary: '#F59E0B',
  secondary: '#FFF7ED',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#10B981',
};

const SectionHeader = ({ title, subtitle }: any) => (
  <View style={styles.sectionHeaderContainer}>
    <Text style={styles.sectionHeader}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
  </View>
);

const CustomToggle = ({ value, onToggle, label, activeLabel = 'YES', inactiveLabel = 'NO' }: any) => (
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

const FormInput = ({ label, value, onChangeText, placeholder, icon, multiline, keyboardType = 'default' }: any) => (
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

const DaySchedule = ({ dayData, onUpdate }: any) => {
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

export default function RegisterResidence() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [about, setAbout] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [imageCount, setImageCount] = useState(0);

  const [buildings, setBuildings] = useState([
    { id: '1', name: 'Building A', capacity: '20', price: '50.00' },
    { id: '2', name: 'Building B', capacity: '25', price: '50.00' },
  ]);

  const initialSchedule = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => ({
    day,
    isOpen: true, // Residences typically open all days
    openTime: '00:00',
    closeTime: '23:59',
    is24Hours: true,
  }));
  const [schedule, setSchedule] = useState(initialSchedule);

  const totalSlots = useMemo(() => {
    return buildings.reduce((acc, building) => acc + (parseInt(building.capacity) || 0), 0);
  }, [buildings]);

  const addBuilding = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newId = (buildings.length + 1).toString() + Date.now();
    setBuildings([...buildings, { id: newId, name: '', capacity: '', price: '' }]);
  };

  const removeBuilding = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBuildings(buildings.filter(b => b.id !== id));
  };

  const updateBuilding = (id: string, field: string, value: string) => {
    setBuildings(buildings.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const updateDaySchedule = (updatedDay: any) => {
    setSchedule(schedule.map(d => d.day === updatedDay.day ? updatedDay : d));
  };

  const handleSave = () => {
    const payload = {
      name, address, price, about, contactName, contactPhone, email,
      buildings, totalSlots, schedule
    };
    
    if(!name || !price) {
      Alert.alert('Missing Fields', 'Please fill in Residence Name and Monthly Price.');
      return;
    }

    console.log(JSON.stringify(payload, null, 2));
    Alert.alert('Success', 'Residence Registered Successfully!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft color={COLORS.primary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Residence</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.tabsContainer}>
            <View style={styles.tabInactive}><Text style={styles.tabTextInactive}>Location</Text></View>
            <View style={styles.tabActive}><Text style={styles.tabTextActive}>Residence Info</Text></View>
            <View style={styles.tabInactive}><Text style={styles.tabTextInactive}>Photos</Text></View>
          </View>

          <TouchableOpacity 
            style={styles.imagePicker} 
            onPress={() => setImageCount(prev => Math.min(prev + 1, 5))}
          >
            <Camera color={COLORS.primary} size={32} />
            <Text style={styles.imagePickerText}>
              {imageCount > 0 ? `${imageCount} Images Selected` : 'Tap to Upload Images (0/5)'}
            </Text>
          </TouchableOpacity>

          <FormInput 
            label="Residence Name*" 
            placeholder="e.g. Green Valley Apartments" 
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
            label="Base Price / Month*" 
            placeholder="0.00" 
            value={price} 
            onChangeText={setPrice}
            keyboardType="numeric"
            icon={<DollarSign size={18} color={COLORS.textLight} />}
          />

          <View style={styles.section}>
            <SectionHeader title="Buildings & Parking Spaces" subtitle={`Total Capacity: ${totalSlots}`} />
            
            {buildings.map((building) => (
              <View key={building.id} style={styles.zoneRow}>
                <View style={styles.zoneInputWrapper}>
                  <Text style={styles.zoneLabel}>Building Name</Text>
                  <TextInput 
                    style={styles.zoneInput} 
                    placeholder="Building A" 
                    value={building.name}
                    onChangeText={(t) => updateBuilding(building.id, 'name', t)}
                  />
                </View>
                <View style={[styles.zoneInputWrapper, { width: 70 }]}>
                  <Text style={styles.zoneLabel}>Slots</Text>
                  <TextInput 
                    style={[styles.zoneInput, { textAlign: 'center' }]} 
                    placeholder="0" 
                    keyboardType="numeric"
                    value={building.capacity}
                    onChangeText={(t) => updateBuilding(building.id, 'capacity', t)}
                  />
                </View>
                <View style={[styles.zoneInputWrapper, { width: 70 }]}>
                  <Text style={styles.zoneLabel}>Price</Text>
                  <TextInput 
                    style={[styles.zoneInput, { textAlign: 'center' }]} 
                    placeholder="0" 
                    keyboardType="numeric"
                    value={building.price}
                    onChangeText={(t) => updateBuilding(building.id, 'price', t)}
                  />
                </View>
                <TouchableOpacity onPress={() => removeBuilding(building.id)} style={styles.removeZoneBtn}>
                  <X color={COLORS.danger} size={20} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addZoneBtn} onPress={addBuilding}>
              <Plus color={COLORS.primary} size={20} />
              <Text style={styles.addZoneText}>Add New Building</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Contact Information" />
            <FormInput 
              label="Contact Person" 
              placeholder="Full Name" 
              value={contactName}
              onChangeText={setContactName}
              icon={<User size={18} color={COLORS.textLight} />}
            />
            <FormInput 
              label="Phone Number" 
              placeholder="+1 234 567 8900" 
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
              icon={<Phone size={18} color={COLORS.textLight} />}
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
              label="About Residence" 
              placeholder="Describe your residential parking facilities and policies..." 
              multiline={true} 
              value={about}
              onChangeText={setAbout}
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Access Hours" />
            {schedule.map((dayData) => (
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
  container: { flex: 1, backgroundColor: COLORS.background },
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  saveBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  iconBtn: { padding: 4 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 25,
  },
  tabInactive: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
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
  imagePickerText: { color: COLORS.primary, marginTop: 8, fontSize: 14, fontWeight: '600' },
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
  section: { marginBottom: 30 },
  sectionHeaderContainer: { marginBottom: 16 },
  sectionHeader: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sectionSubtitle: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
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
  dayFooter: { marginTop: 12, alignItems: 'flex-start' },
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