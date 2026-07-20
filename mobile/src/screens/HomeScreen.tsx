import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import {
  type EmployeeMe,
  type OtRequestWindow,
  type PunchStatus,
  getMe,
  getOtRequestWindow,
  getPunchStatus,
  getTodayTaskCount,
  isOtEligible,
  punchIn,
  punchOut,
  reportLocation,
  submitOtRequest,
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

function timeStringToMinutes(str: string): number {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function isNowWithinWindow(window: OtRequestWindow | null): boolean {
  if (!window) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= timeStringToMinutes(window.start) && nowMinutes < timeStringToMinutes(window.end);
}

export default function HomeScreen({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [me, setMe] = useState<EmployeeMe | null>(null);
  const [punch, setPunch] = useState<PunchStatus | null>(null);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otWindow, setOtWindow] = useState<OtRequestWindow | null>(null);
  const [showOtModal, setShowOtModal] = useState(false);
  const [otHours, setOtHours] = useState('');
  const [otReason, setOtReason] = useState('');
  const [otSubmitting, setOtSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [meData, punchData, tasksData, windowData] = await Promise.all([
      getMe(token),
      getPunchStatus(token),
      getTodayTaskCount(token),
      getOtRequestWindow(token),
    ]);

    if (!meData) {
      onLogout();
      return;
    }

    setMe(meData);
    setPunch(punchData);
    setTaskCount(tasksData?.count ?? 0);
    setOtWindow(windowData);
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

  const handleSubmitOtRequest = async () => {
    const hours = Number(otHours);
    if (!otHours || !Number.isFinite(hours) || hours <= 0) {
      Alert.alert('Request OT', 'Enter a valid number of hours.');
      return;
    }
    const maxHours = otWindow?.maxHours ?? 10;
    if (hours > maxHours) {
      Alert.alert('Request OT', `OT requests cannot exceed ${maxHours} hours. This is a hard policy cap.`);
      return;
    }
    setOtSubmitting(true);
    const result = await submitOtRequest(token, { hours_requested: hours, reason: otReason.trim() });
    setOtSubmitting(false);
    if (!result.ok) {
      Alert.alert('Request Failed', result.error);
      return;
    }
    setShowOtModal(false);
    setOtHours('');
    setOtReason('');
    Alert.alert('OT Requested', 'Your overtime request has been sent for approval.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const canPunchIn = punch?.status !== 'clocked_in';
  const otEligible = isOtEligible(me?.ot_eligible ?? null);
  const otWindowOpen = isNowWithinWindow(otWindow);

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

      {otEligible && (
        <TouchableOpacity
          style={[styles.otButton, !otWindowOpen && styles.buttonDisabled]}
          onPress={() => setShowOtModal(true)}
          disabled={!otWindowOpen}
        >
          <Text style={styles.otButtonText}>
            {otWindowOpen ? 'Request OT' : `Request OT (opens ${otWindow?.start ?? ''})`}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Modal visible={showOtModal} transparent animationType="fade" onRequestClose={() => setShowOtModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Overtime</Text>

            <Text style={styles.modalLabel}>Hours Requested (max {otWindow?.maxHours ?? 10})</Text>
            <TextInput
              value={otHours}
              onChangeText={setOtHours}
              keyboardType="numeric"
              placeholder="e.g. 3"
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>Reason</Text>
            <TextInput
              value={otReason}
              onChangeText={setOtReason}
              placeholder="Why is OT needed?"
              multiline
              numberOfLines={3}
              style={[styles.modalInput, styles.modalTextArea]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowOtModal(false)}
                disabled={otSubmitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, otSubmitting && styles.buttonDisabled]}
                onPress={handleSubmitOtRequest}
                disabled={otSubmitting}
              >
                {otSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  otButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#7c3aed',
  },
  otButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutButton: { marginTop: 24, alignItems: 'center', padding: 12 },
  logoutText: { color: '#dc2626', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: '600', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  modalTextArea: { minHeight: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: '#6b7280', fontWeight: '600' },
  modalSubmitButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: { color: '#fff', fontWeight: '600' },
});
