import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    deleteReport as deleteLocal,
    getAllReports,
    updateReportStatus,
} from '../services/db';

import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { runSyncOnce } from '../services/sync';

function Pill({ label, active, onPress }) {
    return (
        <TouchableOpacity
        onPress={onPress}
        style={[styles.pill, active && styles.pillOn]}
        >
        <Text style={[styles.pillText, active && styles.pillTextOn]}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function AdminReviewScreen() {
    const nav = useNavigation();
    const [items, setItems] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // new: filters + search + last sync
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'closed'
    const [q, setQ] = useState('');
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [syncBusy, setSyncBusy] = useState(false);

    const load = useCallback(async () => {
        try {
        const rows = await getAllReports();
        setItems(rows);
        } catch (e) {
        console.warn('load admin:', e);
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

    async function toggleStatus(item) {
        const next = (item.status || 'Open') === 'Open' ? 'Closed' : 'Open';
        await updateReportStatus(item.id, next);
        await load();

        try {
        await setDoc(
            doc(db, 'reports', item.id),
            { status: next, serverTime: serverTimestamp() },
            { merge: true }
        );
        } catch (e) {
        console.warn('cloud status:', e?.message || e);
        }
    }

    function confirmDelete(item) {
        Alert.alert(
        'Delete Report',
        'Remove locally or also delete cloud copy?',
        [
            { text: 'Cancel', style: 'cancel' },
            {
            text: 'Local only',
            style: 'destructive',
            onPress: async () => {
                await deleteLocal(item.id);
                await load();
                Alert.alert('Deleted', 'Removed locally.');
            },
            },
            {
            text: 'Local + Cloud',
            style: 'destructive',
            onPress: async () => {
                try { await deleteDoc(doc(db, 'reports', item.id)); } catch {}
                await deleteLocal(item.id);
                await load();
                Alert.alert('Deleted', 'Removed locally and from cloud.');
            },
            },
        ]
        );
    }

    // derived: filtered + searched items
    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return items.filter((it) => {
        // status filter
        const s = (it.status || 'Open').toLowerCase();
        if (statusFilter === 'open' && s !== 'open') return false;
        if (statusFilter === 'closed' && s !== 'closed') return false;

        // text search across a few fields
        if (!needle) return true;
        const hay = [
            it.reporterName,
            it.station,
            it.locationMore,
            it.incidentType,
            it.details,
            it.id,
        ].map((v) => (v || '').toString().toLowerCase());
        return hay.some((v) => v.includes(needle));
        });
    }, [items, statusFilter, q]);

    async function doSyncNow() {
        try {
        setSyncBusy(true);
        await runSyncOnce();
        setLastSyncAt(new Date());
        await load();
        } catch (e) {
        console.warn('sync now:', e?.message || e);
        } finally {
        setSyncBusy(false);
        }
    }

    const renderItem = ({ item }) => (
        <View style={styles.card}>
        <View style={styles.rowTop}>
            <Text style={styles.title} numberOfLines={1}>
            {item.type || 'Report'}
            </Text>
            <View style={[styles.badge, item.status === 'Closed' ? styles.badgeClosed : styles.badgeOpen]}>
            <Text style={styles.badgeText}>{item.status || 'Open'}</Text>
            </View>
        </View>

        <Text style={styles.sub}>
            {item.dateStr || ''} {item.timeStr || ''} • {item.reporterName || '—'}
        </Text>
        {!!item.station && <Text style={styles.subSmall} numberOfLines={1}>Station: {item.station}</Text>}
        {!!item.locationMore && <Text style={styles.subSmall} numberOfLines={1}>{item.locationMore}</Text>}

        <View style={styles.actions}>
            <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#EAF6FC', borderColor: '#3EA0D1' }]}
            onPress={() => nav.navigate('ReportDetail', { id: item.id })}
            >
            <Ionicons name="create-outline" size={16} color="#3EA0D1" />
            <Text style={[styles.btnText, { color: '#3EA0D1' }]}>View / Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#fff', borderColor: '#d7d7d7' }]}
            onPress={() => toggleStatus(item)}
            >
            <Ionicons name="swap-horizontal" size={16} color="#222" />
            <Text style={[styles.btnText, { color: '#222' }]}>
                {(item.status || 'Open') === 'Open' ? 'Mark Closed' : 'Reopen'}
            </Text>
            </TouchableOpacity>

            <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#ffecec', borderColor: '#e19b9b' }]}
            onPress={() => confirmDelete(item)}
            >
            <Ionicons name="trash" size={16} color="#b00020" />
            <Text style={[styles.btnText, { color: '#b00020' }]}>Delete</Text>
            </TouchableOpacity>
        </View>
        </View>
    );

    return (
        <View style={styles.wrap}>
        {/* Toolbar: search + filters + sync */}
        <View style={styles.toolbar}>
            <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#666" />
            <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search by reporter, station, type…"
                style={styles.searchInput}
                placeholderTextColor="#999"
            />
            {!!q && (
                <TouchableOpacity onPress={() => setQ('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
            )}
            </View>

            <View style={styles.filterRow}>
            <Pill label="All" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            <Pill label="Open" active={statusFilter === 'open'} onPress={() => setStatusFilter('open')} />
            <Pill label="Closed" active={statusFilter === 'closed'} onPress={() => setStatusFilter('closed')} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={doSyncNow} style={[styles.syncBtn, syncBusy && { opacity: 0.6 }]}>
                <Ionicons name="cloud-upload" size={16} color="#fff" />
                <Text style={styles.syncBtnText}>{syncBusy ? 'Syncing…' : 'Sync now'}</Text>
            </TouchableOpacity>
            </View>

            <Text style={styles.meta}>
            {lastSyncAt ? `Last sync: ${lastSyncAt.toLocaleTimeString()}` : 'Not synced yet'}
            </Text>
        </View>

        <FlatList
            data={shown}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text style={styles.empty}>No matching reports.</Text>}
        />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#EDEFF2' },

    toolbar: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, backgroundColor: '#EDEFF2' },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E1E4E8',
        paddingHorizontal: 10, height: 40,
    },
    searchInput: { flex: 1, paddingLeft: 6, color: '#222' },

    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    pill: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
        borderWidth: 1, borderColor: '#3EA0D1', backgroundColor: '#fff',
    },
    pillOn: { backgroundColor: '#3EA0D1', borderColor: '#3EA0D1' },
    pillText: { color: '#3EA0D1', fontWeight: '700', fontSize: 12 },
    pillTextOn: { color: '#fff' },

    syncBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#3EA0D1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    syncBtnText: { color: '#fff', fontWeight: '700' },
    meta: { marginTop: 6, color: '#6b6b6b', fontSize: 12 },

    card: {
        backgroundColor: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginHorizontal: 12,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E1E4E8',
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 16, color: '#2d2d2d', fontWeight: '600', flex: 1, marginRight: 8 },

    badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    badgeOpen: { backgroundColor: '#3EA0D1' },
    badgeClosed: { backgroundColor: '#6b6b6b' },
    badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    sub: { color: '#6b6b6b', fontSize: 12, marginTop: 6 },
    subSmall: { color: '#8a8a8a', fontSize: 11, marginTop: 2 },

    actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
    btn: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    btnText: { fontWeight: '700' },

    empty: { textAlign: 'center', color: '#666', marginTop: 24 },
});
