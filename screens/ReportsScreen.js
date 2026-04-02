import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function NavCard({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardLeft}>
        <Ionicons name={icon} size={20} color="#3EA0D1" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#888" />
    </TouchableOpacity>
  );
}

export default function ReportsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 20 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Create a report</Text>

      <NavCard
        icon="warning-outline"
        title="Incident / Damage report"
        subtitle="Aggression, vandalism, theft, injuries, etc."
        onPress={() => nav.navigate('IncidentReport')}
      />

      <NavCard
        icon="briefcase-outline"
        title="Lost / Found Property Report"
        subtitle="Log found items or claims"
        onPress={() => nav.navigate('LostFoundReport')}
      />

      <NavCard
        icon="construct-outline"
        title="Maintenance / Equipment Fault"
        subtitle="Escalators, gates, lighting"
        onPress={() => nav.navigate('MaintenanceReport')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#F6F7F9' },
  header: { color: '#2d2d2d', fontWeight: '700', marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    marginBottom: 10,
  },
  cardLeft: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#EAF6FC',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: '#1e1e1e', fontWeight: '700' },
  cardSub: { color: '#6b6b6b', fontSize: 12, marginTop: 2 },
});
