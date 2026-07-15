import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type EmployeeMe, type PunchStatus, getMe, getPunchStatus, getTodayTaskCount } from '../api';

const STATUS_LABEL: Record<PunchStatus['status'], string> = {
  not_started: 'Not Clocked In',
  clocked_in: 'Clocked In',
  clocked_out: 'Clocked Out',
};

export default function HomeScreen({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [me, setMe] = useState<EmployeeMe | null>(null);
  const [punch, setPunch] = useState<PunchStatus | null>(null);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [meData, punchData, tasksData] = await Promise.all([
      getMe(token),
      getPunchStatus(token),
      getTodayTaskCount(token),
    ]);

    if (!meData) {
      onLogout();
      return;
    }

    setMe(meData);
    setPunch(punchData);
    setTaskCount(tasksData?.count ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Welcome{me ? `, ${me.name}` : ''}</Text>
      <Text style={styles.subtitle}>
        {me?.designation || '—'} · {me?.department || '—'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Punch Status</Text>
        <Text style={styles.cardValue}>{punch ? STATUS_LABEL[punch.status] : '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Today&apos;s Tasks</Text>
        <Text style={styles.cardValue}>{taskCount}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 24 },
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  logoutButton: { marginTop: 24, alignItems: 'center', padding: 12 },
  logoutText: { color: '#dc2626', fontWeight: '600' },
});
