// screens/IncidentReportScreen.js
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text, TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { insertMedia, insertReport } from '../services/db';

const Pill = ({ text, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillOn]}>
    <Text style={[styles.pillText, active && styles.pillTextOn]}>{text}</Text>
  </TouchableOpacity>
);

// Accept extra props so we can pass autofill hints to TextInput
function LabeledInput({ label, value, onChangeText, multiline, placeholder, ...rest }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, multiline && { height: 110, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || ''}
          multiline={multiline}
          {...rest} // 👈 autofill/textContentType props flow through
        />
      </View>
    </View>
  );
}

function LabeledPicker({ label, selectedValue, onValueChange, items }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          dropdownIconColor="#3EA0D1"
        >
          {/* first empty option so user must choose */}
          <Picker.Item label="Select..." value="" />
          {items.map((it) => (
            <Picker.Item key={it} label={it} value={it} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function LabeledDateRow({ label, valueText, onPick, rightRender }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, { justifyContent: 'space-between' }]}>
        <Text style={styles.valueText}>{valueText || ''}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {rightRender || null}
          <TouchableOpacity style={styles.pickBtn} onPress={onPick}>
            <Ionicons name="calendar" size={16} color="#fff" />
            <Text style={styles.pickBtnText}>Pick</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function LabeledTimeRow({ label, valueText, onPick, rightRender }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, { justifyContent: 'space-between' }]}>
        <Text style={styles.valueText}>{valueText || ''}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {rightRender || null}
          <TouchableOpacity style={styles.pickBtn} onPress={onPick}>
            <Ionicons name="time" size={16} color="#fff" />
            <Text style={styles.pickBtnText}>Pick</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function IncidentReportScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // fixed fields
  const [status] = useState('Open');

  // who
  const [reporterName, setReporterName] = useState('');
  const [rank, setRank] = useState('');

  // when (store both display string and native objects)
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [timeObj, setTimeObj] = useState(new Date());

  // where
  const [station, setStation] = useState('');
  const [locationMore, setLocationMore] = useState('');

  // what
  const [incidentType, setIncidentType] = useState('');
  const [injuryType, setInjuryType] = useState('');
  const [details, setDetails] = useState('');
  const [offenderDesc, setOffenderDesc] = useState(''); // big textarea

  // police
  const [policeCalled, setPoliceCalled] = useState(null); // true | false | null
  const [policeNumber, setPoliceNumber] = useState('');

  // media (multiple)
  const [photos, setPhotos] = useState([]);

  // geo
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [address, setAddress] = useState('');

  // remember toggle
  const [rememberDefaults, setRememberDefaults] = useState(true);

  // options
  const rankOptions = ['Security Guard', 'Team leader', 'Area Supervisor'];
  const incidentOptions = [
    'Aggressive behavior',
    'Physical assault',
    'Verbal abuse / threats',
    'Fare evasion',
    'Crossing the tracks / trespassing',
    'Vandalism / tagging',
    'Damage to property',
    'Theft / pickpocketing',
    'Lost property',
    'Suspicious package / suspicious behavior',
    'Intoxication / drug use',
    'Medical emergency',
    'Slip, trip, or fall',
    'Fire / smoke hazard',
    'Equipment malfunction (gates, escalator, elevator)',
    'Obstruction of train doors or platform edge',
    'Overcrowding / disorderly conduct',
  ];
  const injuryOptions = ['no injury', 'minor injury', 'critical injury', 'emergency', 'death'];

  useEffect(() => {
    // Prefill name/rank from existing defaults
    (async () => {
      try {
        const n = await AsyncStorage.getItem('defaultName');
        const r = await AsyncStorage.getItem('defaultRank');
        if (n && !reporterName) setReporterName(n);
        if (r && rankOptions.includes(r) && !rank) setRank(r);
      } catch {}
    })();
  }, []);

  // quick fills
  const quickToday = () => {
    const d = new Date();
    setDateObj(d);
    setDateStr(d.toLocaleDateString());
  };
  const quickNow = () => {
    const t = new Date();
    setTimeObj(t);
    setTimeStr(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // date/time pickers
  const onDateChange = (e, selected) => {
    if (Platform.OS === 'android') setShowDate(false);
    if (selected) {
      setDateObj(selected);
      setDateStr(selected.toLocaleDateString());
    }
  };
  const onTimeChange = (e, selected) => {
    if (Platform.OS === 'android') setShowTime(false);
    if (selected) {
      setTimeObj(selected);
      setTimeStr(selected.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  async function useCurrentLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location permission is required.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);

    try {
      const rev = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      });
      if (rev && rev[0]) {
        const a = rev[0];
        const line = [a.name, a.street, a.subregion, a.city, a.region, a.country]
          .filter(Boolean).join(', ');
        setAddress(line);
        if (!locationMore) setLocationMore(line);
      }
    } catch {}
  }

  async function addPhotoFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false });
    if (!res.canceled) setPhotos((p) => [...p, res.assets[0].uri]);
  }

  function removePhoto(uri) {
    setPhotos((p) => p.filter((x) => x !== uri));
  }

  function validate() {
    const missing = [];
    if (!reporterName.trim()) missing.push('Reporter name');
    if (!dateStr.trim()) missing.push('Date of incident');
    if (!timeStr.trim()) missing.push('Time of incident');
    if (!details.trim()) missing.push('Incident details');
    if (missing.length) {
      Alert.alert('Missing info', 'Please fill: ' + missing.join(', '));
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;

    const id = 'r_' + Date.now();
    const createdAt = Date.now();

    await insertReport({
      id,
      type: 'Incident / Damage report',
      status,
      reporterName,
      rank,
      dateStr,
      timeStr,
      station,
      locationMore,
      incidentType,
      injuryType,
      details,
      offenderDesc,
      lastSeen: '',             // unchanged from previous form
      policeCalled: policeCalled === true,
      policeNumber,
      createdAt,
      lat,
      lng,
      address,
    });

    if (photos.length > 0) {
      for (const uri of photos) {
        await insertMedia({
          id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
          reportId: id,
          localUri: uri,
          createdAt: Date.now(),
        });
      }
    }

    // Save defaults if requested
    try {
      if (rememberDefaults) {
        await AsyncStorage.setItem('defaultName', reporterName || '');
        await AsyncStorage.setItem('defaultRank', rank || '');
      }
    } catch {}

    Alert.alert('Saved', 'Saved locally. Will sync on Wi-Fi.');
    navigation.goBack();
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 32 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.formTitle}>Incident / Damage report</Text>
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Pill text={status} active />
        </View>
      </View>

      {/* Remember toggle */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, color: '#666' }}>Remember my name & rank</Text>
        <Switch value={rememberDefaults} onValueChange={setRememberDefaults} />
      </View>

      {/* Reporting Person */}
      <Text style={styles.section}>Reporting Person</Text>
      <LabeledInput
        label="Name of the person reporting"
        value={reporterName}
        onChangeText={setReporterName}
        placeholder="Name..."
        autoComplete="name"
        textContentType={Platform.OS === 'ios' ? 'name' : 'name'}
        autoCapitalize="words"
      />

      <LabeledPicker
        label="Rank"
        selectedValue={rank}
        onValueChange={(v) => setRank(v)}
        items={rankOptions}
      />

      {/* Date & Time */}
      <Text style={styles.section}>Date & Time</Text>

      <LabeledDateRow
        label="Date of Incident"
        valueText={dateStr}
        rightRender={<Pill text="TODAY" active onPress={quickToday} />}
        onPick={() => setShowDate(true)}
      />
      {showDate && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onDateChange}
        />
      )}

      <LabeledTimeRow
        label="Time of Incident"
        valueText={timeStr}
        rightRender={<Pill text="NOW" active onPress={quickNow} />}
        onPick={() => setShowTime(true)}
      />
      {showTime && (
        <DateTimePicker
          value={timeObj}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}

      {/* Location */}
      <Text style={styles.section}>Incident Location</Text>
      <LabeledInput
        label="Name of Station where Incident Occurred"
        value={station}
        onChangeText={setStation}
        autoComplete="organization"
        textContentType={Platform.OS === 'ios' ? 'organizationName' : 'organizationName'}
      />
      <LabeledInput
        label="Location (Refined, where?)"
        value={locationMore}
        onChangeText={setLocationMore}
        placeholder="Location..."
        autoComplete="address-line1"
        textContentType={Platform.OS === 'ios' ? 'fullStreetAddress' : 'streetAddressLine1'}
      />
      <TouchableOpacity style={styles.useLocBtn} onPress={useCurrentLocation}>
        <Ionicons name="locate" size={16} color="#222" />
        <Text style={styles.useLocText}>Use current</Text>
      </TouchableOpacity>
      {address ? <Text style={styles.hint}>Detected: {address}</Text> : null}

      {/* Details */}
      <Text style={styles.section}>Incident Details</Text>
      <LabeledPicker
        label="Incident Type"
        selectedValue={incidentType}
        onValueChange={setIncidentType}
        items={incidentOptions}
      />
      <LabeledPicker
        label="Injury Type"
        selectedValue={injuryType}
        onValueChange={setInjuryType}
        items={injuryOptions}
      />
      <LabeledInput
        label="Details of incident (who, what, when, where, why)"
        value={details}
        onChangeText={setDetails}
        multiline
      />
      <LabeledInput
        label="Offender Description"
        value={offenderDesc}
        onChangeText={setOffenderDesc}
        multiline
      />

      {/* Police */}
      <Text style={styles.section}>Were the Police called?</Text>
      <View style={styles.choiceRow}>
        <Pill text="YES" active={policeCalled === true} onPress={() => setPoliceCalled(true)} />
        <Pill text="NO" active={policeCalled === false} onPress={() => setPoliceCalled(false)} />
      </View>
      {policeCalled === true && (
        <LabeledInput
          label="If YES - Police Incident Number"
          value={policeNumber}
          onChangeText={setPoliceNumber}
          keyboardType="phone-pad"
          textContentType={Platform.OS === 'ios' ? 'telephoneNumber' : 'telephoneNumber'}
          autoComplete="tel"
        />
      )}

      {/* Upload (multiple) */}
      <Text style={styles.section}>Image / Video Upload (Optional)</Text>
      <TouchableOpacity style={styles.uploadBtn} onPress={addPhotoFromCamera}>
        <Ionicons name="image" size={18} color="#3EA0D1" />
        <Text style={{ marginLeft: 8, color: '#3EA0D1', fontWeight: '600' }}>Add Attachment (Camera)</Text>
      </TouchableOpacity>

      {photos.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <View style={styles.gallery}>
            {photos.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(uri)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>{photos.length} attachment(s)</Text>
        </View>
      )}

      {/* Footer buttons */}
      <View style={[styles.footerBtns, { marginBottom: 8 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#cfd6dc' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.actionText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#3EA0D1' }]}
          onPress={handleSubmit}
        >
          <Text style={[styles.actionText, { color: '#fff' }]}>SUBMIT</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 8 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 12,  paddingBottom: 40, backgroundColor: '#F6F7F9' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  statusBox: { alignItems: 'flex-end' },
  statusLabel: { fontSize: 12, color: '#666', marginBottom: 4 },

  section: { marginTop: 14, marginBottom: 6, color: '#4b4b4b', fontWeight: '700' },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#E1E4E8', paddingHorizontal: 10,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 14 },

  pickerWrap: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E1E4E8',
  },

  valueText: { color: '#222', fontSize: 14, paddingVertical: 10 },

  pill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: '#3EA0D1', backgroundColor: '#fff',
  },
  pillOn: { backgroundColor: '#3EA0D1', borderColor: '#3EA0D1' },
  pillText: { color: '#3EA0D1', fontWeight: '700', fontSize: 12 },
  pillTextOn: { color: '#fff' },

  hint: { marginTop: 6, color: '#6b6b6b', fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },

  pickBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#3EA0D1', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  pickBtnText: { color: '#fff', fontWeight: '700' },

  useLocBtn: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#d7d7d7', marginTop: 6 },
  useLocText: { color: '#222', fontWeight: '700' },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#3EA0D1', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#EAF6FC',
  },

  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },

  footerBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionText: { fontWeight: '700', color: '#1e1e1e' },
});
