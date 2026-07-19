import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Task, type TaskStatus, getMyTasks, rescheduleTaskTomorrow, updateTaskStatus } from '../api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  cannot_complete: 'Cannot Complete',
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const short = (t: string) => t.slice(0, 5);
  if (start && end) return `${short(start)}–${short(end)}`;
  return short(start || end || '');
}

export default function TasksScreen({ token }: { token: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const data = await getMyTasks(token);
    setTasks(data ?? []);
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

  const handleAdvance = async (task: Task, nextStatus: TaskStatus) => {
    setBusyId(task.id);
    const result = await updateTaskStatus(token, task.id, nextStatus);
    setBusyId(null);
    if (!result.ok) {
      Alert.alert('Update Failed', result.error);
      return;
    }
    await load();
  };

  const handleReschedule = async (task: Task) => {
    setBusyId(task.id);
    const result = await rescheduleTaskTomorrow(token, task.id);
    setBusyId(null);
    if (!result.ok) {
      Alert.alert('Reschedule Failed', result.error);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>My Tasks</Text>

      {tasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No open tasks</Text>
        </View>
      ) : (
        tasks.map((task) => {
          const timeRange = formatTimeRange(task.start_time, task.end_time);
          const busy = busyId === task.id;
          return (
            <View key={task.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>
                  {formatDate(task.task_date)}
                  {timeRange ? ` · ${timeRange}` : ''}
                </Text>
                {task.priority ? <Text style={styles.priority}>{task.priority.toUpperCase()}</Text> : null}
              </View>
              <Text style={styles.description}>{task.description}</Text>
              {task.location ? <Text style={styles.location}>{task.location}</Text> : null}
              {task.remarks ? <Text style={styles.remarks}>{task.remarks}</Text> : null}

              <Text style={styles.status}>{STATUS_LABEL[task.status] ?? task.status}</Text>

              {task.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton, busy && styles.buttonDisabled]}
                  onPress={() => handleAdvance(task, 'in_progress')}
                  disabled={busy}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionButtonText}>Start</Text>}
                </TouchableOpacity>
              )}

              {task.status === 'in_progress' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton, busy && styles.buttonDisabled]}
                    onPress={() => handleAdvance(task, 'completed')}
                    disabled={busy}
                  >
                    {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionButtonText}>Completed</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cannotCompleteButton, busy && styles.buttonDisabled]}
                    onPress={() => handleAdvance(task, 'cannot_complete')}
                    disabled={busy}
                  >
                    <Text style={styles.actionButtonText}>Cannot Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.tomorrowButton, busy && styles.buttonDisabled]}
                    onPress={() => handleReschedule(task)}
                    disabled={busy}
                  >
                    <Text style={styles.tomorrowButtonText}>Move to Tomorrow</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  emptyCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: '#6b7280', fontSize: 14 },
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' },
  priority: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  description: { fontSize: 16, fontWeight: '600', marginTop: 6 },
  location: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  remarks: { fontSize: 13, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  status: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: { backgroundColor: '#111827', minWidth: 90 },
  completeButton: { backgroundColor: '#059669' },
  cannotCompleteButton: { backgroundColor: '#dc2626' },
  tomorrowButton: { backgroundColor: '#e5e7eb' },
  buttonDisabled: { opacity: 0.5 },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tomorrowButtonText: { color: '#374151', fontSize: 13, fontWeight: '600' },
});
