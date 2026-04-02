import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAllReports, updateReportStatus } from '../services/db';
import { runSyncOnce } from '../services/sync';

function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillOn]}>
      <Text style={[styles.pillText, active && styles.pillTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [syncBusy, setSyncBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await getAllReports();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('load home:', e?.message || e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const shown = useMemo(() => {
    return items.filter((it) => {
      const s = (it.status || 'Open').toLowerCase();
      if (statusFilter === 'open' && s !== 'open') return false;
      if (statusFilter === 'closed' && s !== 'closed') return false;
      return true;
    });
  }, [items, statusFilter]);

  async function handleSyncNow() {
    try {
      setSyncBusy(true);
      await runSyncOnce();
      setLastSyncAt(new Date());
      await load();
      Alert.alert('Sync complete', 'Local changes have been pushed when possible.');
    } catch (e) {
      console.warn('sync now:', e?.message || e);
      Alert.alert('Sync failed', 'Please check your network (Wi-Fi required).');
    } finally {
      setSyncBusy(false);
    }
  }

  async function toggleStatus(item) {
    try {
      const next = (item.status || 'Open') === 'Open' ? 'Closed' : 'Open';
      await updateReportStatus(item.id, next);
      await load();
    } catch (e) {
      Alert.alert('Error', 'Could not update status.');
    }
  }

  const renderItem = ({ item }) => {
    const isClosed = (item.status || 'Open') === 'Closed';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ReportDetail', { id: item.id })}
      >
        <View style={styles.rowTop}>
          <Text style={styles.title} numberOfLines={1}>
            {item.type || 'Report'}
          </Text>
          <View style={[styles.badge, isClosed ? styles.badgeClosed : styles.badgeOpen]}>
            <Text style={styles.badgeText}>{item.status || 'Open'}</Text>
          </View>
        </View>

        <Text style={styles.sub}>
          {(item.dateStr || '')} {(item.timeStr || '')}
          {item.synced ? ' • Synced' : ' • Local'}
        </Text>
        {!!item.address && <Text style={styles.subSmall}>{item.address}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => toggleStatus(item)}
            style={[styles.btn, { borderColor: '#3EA0D1' }]}
          >
            <Ionicons name="sync-outline" size={16} color="#3EA0D1" />
            <Text style={[styles.btnText, { color: '#3EA0D1' }]}>
              {isClosed ? 'Mark Open' : 'Mark Closed'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ReportDetail', { id: item.id })}
            style={[styles.btn, { borderColor: '#555' }]}
          >
            <Ionicons name="open-outline" size={16} color="#555" />
            <Text style={[styles.btnText, { color: '#555' }]}>View</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.meta}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Title + Sync */}
      <View style={styles.headerWrap}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Report History</Text>
          <Text style={styles.metaSmall}>
            {lastSyncAt ? `Last sync: ${lastSyncAt.toLocaleTimeString()}` : 'Not synced yet'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSyncNow}
          style={[styles.syncBtn, syncBusy && { opacity: 0.6 }]}
          disabled={syncBusy}
        >
          <Ionicons name="cloud-upload" size={16} color="#fff" />
          <Text style={styles.syncBtnText}>{syncBusy ? 'Syncing…' : 'Sync now'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Pill label="All" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
        <Pill label="Open" active={statusFilter === 'open'} onPress={() => setStatusFilter('open')} />
        <Pill
          label="Closed"
          active={statusFilter === 'closed'}
          onPress={() => setStatusFilter('closed')}
        />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item, idx) => String(item?.id ?? idx)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No reports to show.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },

  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1f1f1f' },
  metaSmall: { fontSize: 12, color: '#6b6b6b', marginTop: 2 },

  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3EA0D1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncBtnText: { color: '#fff', fontWeight: '700' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3EA0D1',
    backgroundColor: '#fff',
  },
  pillOn: { backgroundColor: '#3EA0D1', borderColor: '#3EA0D1' },
  pillText: { color: '#3EA0D1', fontWeight: '700', fontSize: 12 },
  pillTextOn: { color: '#fff' },

  listContent: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 24, 
  },

  card: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 16, color: '#2d2d2d', fontWeight: '700', flex: 1, paddingRight: 10 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeOpen: { backgroundColor: '#3EA0D1' },
  badgeClosed: { backgroundColor: '#6b6b6b' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  sub: { color: '#6b6b6b', fontSize: 12, marginTop: 6 },
  subSmall: { color: '#8a8a8a', fontSize: 11, marginTop: 2 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: { fontWeight: '700' },

  meta: { color: '#6b6b6b', fontSize: 12, marginTop: 10 },
  empty: { textAlign: 'center', color: '#666', marginTop: 24 },
});
