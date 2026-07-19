import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import {
  type EmployeeMe,
  type PunchStatus,
  getMe,
  getPunchStatus,
  getTodayTaskCount,
  punchIn,
  punchOut,
  reportLocation,
} from '../api';

const LOCATION_REPORT_INTERVAL_MS = 75000;

const STATUS_LABEL: Record<PunchStatus['status'], string> = {
  not_started: 'Not Clocked In',
  clocked_in: 'Clocked In',
  clocked_out: 'Clocked Out',
};

async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  await Location.requestBackgroundPermissionsAsync();
  return true;
}

async function captureLocation(): Promise<{ lat: number; lng: number } | null> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    const granted = await requestLocationPermissions();
    if (!granted) return null;
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

export default function HomeScreen({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [me, setMe] = useState<EmployeeMe | null>(null);
  const [punch, setPunch] = useState<PunchStatus | null>(null);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

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
    requestLocationPermissions();
  }, [load]);

  useEffect(() => {
    if (punch?.status !== 'clocked_in') return;

    const interval = setInterval(async () => {
      const location = await captureLocation();
      if (!location) return;
      await reportLocation(token, location);
    }, LOCATION_REPORT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [punch?.status, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePunchIn = async () => {
    setBusy(true);
    const location = await captureLocation();
    if (!location) {
      setBusy(false);
      Alert.alert('Punch In', 'Location permission is required to punch in.');
      return;
    }
    const result = await punchIn(token, location);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Punch In Failed', result.error);
      return;
    }
    await load();
  };

  const handlePunchOut = async () => {
    setBusy(true);
    const location = await captureLocation();
    if (!location) {
      setBusy(false);
      Alert.alert('Punch Out', 'Location permission is required to punch out.');
      return;
    }
    const result = await punchOut(token, location);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Punch Out Failed', result.error);
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const canPunchIn = punch?.status !== 'clocked_in';

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

      {canPunchIn ? (
        <TouchableOpacity
          style={[styles.punchButton, styles.punchInButton, busy && styles.buttonDisabled]}
          onPress={handlePunchIn}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.punchButtonText}>Punch In</Text>}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.punchButton, styles.punchOutButton, busy && styles.buttonDisabled]}
          onPress={handlePunchOut}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.punchButtonText}>Punch Out</Text>}
        </TouchableOpacity>
      )}

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
  punchButton: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  punchInButton: { backgroundColor: '#111827' },
  punchOutButton: { backgroundColor: '#dc2626' },
  buttonDisabled: { opacity: 0.5 },
  punchButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutButton: { marginTop: 24, alignItems: 'center', padding: 12 },
  logoutText: { color: '#dc2626', fontWeight: '600' },
});
