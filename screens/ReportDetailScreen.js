import { Ionicons } from '@expo/vector-icons';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { deleteReport, getMediaForReport, getReportById, updateReportBasic, updateReportStatus } from '../services/db';
import { auth, db } from '../services/firebase';

const ADMIN_EMAILS = ['admin@example.com'];

function Row({ label, value }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export default function ReportDetailScreen({ route, navigation }) {
  const { id } = route.params;

  const [src, setSrc] = useState('local'); 
  const [local, setLocal] = useState(null);
  const [localMedia, setLocalMedia] = useState([]);
  const [cloud, setCloud] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editVals, setEditVals] = useState({
    incidentType: '',
    injuryType: '',
    details: '',
    locationMore: '',
    policeCalled: null,
    policeNumber: '',
  });

  const isAdmin = !!auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email || '');

  const loadLocal = useCallback(async () => {
    const r = await getReportById(id);
    const m = await getMediaForReport(id);
    setLocal(r || null);
    setLocalMedia(m || []);
  }, [id]);

  const loadCloud = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'reports', id));
      if (snap.exists()) {
        setCloud(snap.data());
        setSrc('cloud');
      } else {
        setCloud(null);
        setSrc('local');
        Alert.alert('Cloud', 'No cloud copy found.');
      }
    } catch (e) {
      console.warn('cloud load:', e?.message || e);
      Alert.alert('Cloud', 'Failed to load from cloud.');
    }
  }, [id]);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const r = src === 'cloud' && cloud ? cloud : local;
  if (!r) {
    return (
      <View style={styles.center}>
        <Text>Report not found.</Text>
      </View>
    );
  }

  const localUris = localMedia.map(x => x.cloudUrl || x.localUri).filter(Boolean);
  const cloudUris = Array.isArray(cloud?.mediaUrls) ? cloud.mediaUrls : [];
  const gallery = src === 'cloud' ? cloudUris : localUris;

  const openMap = () => {
    if (r.lat && r.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
      Linking.openURL(url);
    }
  };

  async function toggleStatus() {
    const next = (r.status || 'Open') === 'Open' ? 'Closed' : 'Open';
    await updateReportStatus(id, next);
    await loadLocal();
    try {
      await setDoc(doc(db, 'reports', id), { status: next, serverTime: serverTimestamp() }, { merge: true });
      if (src === 'cloud') await loadCloud();
      Alert.alert('Status', `Marked as ${next}.`);
    } catch (e) {
      console.warn('cloud status:', e?.message || e);
      Alert.alert('Status', `Local updated to ${next}. Cloud update will sync later.`);
    }
  }

  function startEdit() {
    setEditVals({
      incidentType: r.incidentType || '',
      injuryType: r.injuryType || '',
      details: r.details || '',
      locationMore: r.locationMore || '',
      policeCalled: typeof r.policeCalled === 'boolean' ? r.policeCalled : null,
      policeNumber: r.policeNumber || '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    await updateReportBasic(id, editVals);
    await loadLocal();
    try {
      await setDoc(doc(db, 'reports', id), { ...editVals, serverTime: serverTimestamp() }, { merge: true });
      if (src === 'cloud') await loadCloud();
      Alert.alert('Saved', 'Changes saved.');
    } catch (e) {
      console.warn('cloud save:', e?.message || e);
      Alert.alert('Saved', 'Local changes saved. Cloud will sync later.');
    }
    setEditing(false);
  }

  async function confirmDelete() {
    Alert.alert(
      'Delete Report',
      'Do you want to delete this report locally or also remove the cloud copy?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Local only',
          style: 'destructive',
          onPress: async () => {
            await deleteReport(id);
            Alert.alert('Deleted', 'Removed locally.');
            navigation.goBack();
          },
        },
        {
          text: 'Local + Cloud',
          style: 'destructive',
          onPress: async () => {
            try { await deleteDoc(doc(db, 'reports', id)); } catch {}
            await deleteReport(id);
            Alert.alert('Deleted', 'Removed locally and from cloud.');
            navigation.goBack();
          },
        },
      ]
    );
  }

  const statusNow = r.status || 'Open';

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.status}>
          <Text style={styles.statusText}>{statusNow}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => setSrc('local')} style={[styles.toggle, src === 'local' && styles.toggleOn]}>
            <Text style={[styles.toggleText, src === 'local' && styles.toggleTextOn]}>Local</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadCloud} style={[styles.toggle, src === 'cloud' && styles.toggleOn]}>
            <Text style={[styles.toggleText, src === 'cloud' && styles.toggleTextOn]}>Cloud</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Admin only controls */}
      {isAdmin && (
        <View style={styles.adminBar}>
          <TouchableOpacity style={[styles.barBtn, { backgroundColor: '#EAF6FC', borderColor: '#3EA0D1' }]} onPress={toggleStatus}>
            <Ionicons name="swap-horizontal" size={16} color="#3EA0D1" />
            <Text style={[styles.barText, { color: '#3EA0D1' }]}>{statusNow === 'Open' ? 'Mark Closed' : 'Reopen'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.barBtn, { backgroundColor: '#ffecec', borderColor: '#e19b9b' }]} onPress={confirmDelete}>
            <Ionicons name="trash" size={16} color="#b00020" />
            <Text style={[styles.barText, { color: '#b00020' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Everyone: Edit / Save / Cancel */}
      <View style={[styles.adminBar, { marginTop: isAdmin ? 0 : 10 }]}>
        {!editing ? (
          <TouchableOpacity style={[styles.barBtn, { backgroundColor: '#fff', borderColor: '#d7d7d7' }]} onPress={startEdit}>
            <Ionicons name="create-outline" size={16} color="#222" />
            <Text style={[styles.barText, { color: '#222' }]}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.barBtn, { backgroundColor: '#cfd6dc', borderColor: '#cfd6dc' }]} onPress={() => setEditing(false)}>
              <Ionicons name="close" size={16} color="#222" />
              <Text style={[styles.barText, { color: '#222' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.barBtn, { backgroundColor: '#3EA0D1', borderColor: '#3EA0D1' }]} onPress={saveEdit}>
              <Ionicons name="save" size={16} color="#fff" />
              <Text style={[styles.barText, { color: '#fff' }]}>Save</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.title}>{r.type || 'Report'}</Text>

      {/* Basic info */}
      <View style={styles.card}>
        <Row label="Reporter" value={r.reporterName} />
        <Row label="Rank" value={r.rank} />
        <Row label="Date" value={r.date || r.dateStr} />
        <Row label="Time" value={r.time || r.timeStr} />
        <Row label="Station" value={r.station} />

        {!editing ? (
          <>
            <Row label="Location (refined)" value={r.locationMore} />
          </>
        ) : (
          <>
            <Text style={styles.editLabel}>Location (refined)</Text>
            <TextInput
              style={styles.editInput}
              value={editVals.locationMore}
              onChangeText={(t) => setEditVals((v) => ({ ...v, locationMore: t }))}
              placeholder="e.g., Lobby – Level 2"
            />
          </>
        )}

        {(r.lat && r.lng) ? (
          <TouchableOpacity onPress={openMap} style={styles.mapBtn}>
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={styles.mapBtnText}>Open in Maps</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Details */}
      <View style={styles.card}>
        {!editing ? (
          <>
            <Row label="Incident type" value={r.incidentType} />
            <Row label="Injury type" value={r.injuryType} />
            <Row label="Details" value={r.details} />
            <Row label="Offender description" value={r.offenderDesc} />
            <Row label="Last seen" value={r.lastSeen} />
            <Row
              label="Police called"
              value={r.policeCalled === true ? 'Yes' : r.policeCalled === false ? 'No' : ''}
            />
            {r.policeCalled ? <Row label="Police Incident #" value={r.policeNumber} /> : null}
          </>
        ) : (
          <>
            <Text style={styles.editLabel}>Incident type</Text>
            <TextInput
              style={styles.editInput}
              value={editVals.incidentType}
              onChangeText={(t) => setEditVals((v) => ({ ...v, incidentType: t }))}
              placeholder="e.g., Theft"
            />
            <Text style={styles.editLabel}>Injury type</Text>
            <TextInput
              style={styles.editInput}
              value={editVals.injuryType}
              onChangeText={(t) => setEditVals((v) => ({ ...v, injuryType: t }))}
              placeholder="e.g., Minor"
            />
            <Text style={styles.editLabel}>Details</Text>
            <TextInput
              style={[styles.editInput, { height: 100, textAlignVertical: 'top' }]}
              multiline
              value={editVals.details}
              onChangeText={(t) => setEditVals((v) => ({ ...v, details: t }))}
              placeholder="Short description…"
            />

            <Text style={styles.editLabel}>Police called</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setEditVals((v) => ({ ...v, policeCalled: true }))}
                style={[styles.pill, editVals.policeCalled === true && styles.pillOn]}
              >
                <Text style={[styles.pillText, editVals.policeCalled === true && styles.pillTextOn]}>YES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditVals((v) => ({ ...v, policeCalled: false }))}
                style={[styles.pill, editVals.policeCalled === false && styles.pillOn]}
              >
                <Text style={[styles.pillText, editVals.policeCalled === false && styles.pillTextOn]}>NO</Text>
              </TouchableOpacity>
            </View>

            {editVals.policeCalled === true && (
              <>
                <Text style={styles.editLabel}>Police Incident #</Text>
                <TextInput
                  style={styles.editInput}
                  value={editVals.policeNumber}
                  onChangeText={(t) => setEditVals((v) => ({ ...v, policeNumber: t }))}
                  placeholder="e.g., P012345678"
                />
              </>
            )}
          </>
        )}
      </View>

      {/* Media */}
      {gallery.length > 0 && (
        <View style={styles.card}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Attachments</Text>
          <View style={styles.gallery}>
            {gallery.map((uri, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, backgroundColor: '#F6F7F9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { backgroundColor: '#3EA0D1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#3EA0D1', backgroundColor: '#fff' },
  toggleOn: { backgroundColor: '#3EA0D1' },
  toggleText: { color: '#3EA0D1', fontWeight: '700', fontSize: 12 },
  toggleTextOn: { color: '#fff' },

  title: { fontSize: 18, fontWeight: '700', color: '#222', marginTop: 10, marginBottom: 8 },

  adminBar: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 8 },
  barBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  barText: { fontWeight: '700' },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E1E4E8' },
  row: { marginBottom: 6 },
  rowLabel: { color: '#666', fontSize: 12 },
  rowValue: { color: '#222', fontSize: 14, marginTop: 2 },

  editLabel: { color: '#666', fontSize: 12, marginTop: 6, marginBottom: 6 },
  editInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E1E4E8', borderRadius: 10, padding: 10 },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#3EA0D1', marginTop: 6, backgroundColor: '#fff' },
  pillOn: { backgroundColor: '#3EA0D1', borderColor: '#3EA0D1' },
  pillText: { color: '#3EA0D1', fontWeight: '700', fontSize: 12 },
  pillTextOn: { color: '#fff' },

  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee' },
  thumb: { width: '100%', height: '100%' },

  mapBtn: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#3EA0D1', borderRadius: 8 },
  mapBtnText: { color: '#fff', fontWeight: '700' },

  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionText: { fontWeight: '700', color: '#1e1e1e' },
});
