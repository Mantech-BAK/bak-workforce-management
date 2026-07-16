import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Task, getMyTasks, updateTaskStatus } from '../api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const handleAdvance = async (task: Task, nextStatus: 'in_progress' | 'completed') => {
    setBusyId(task.id);
    const result = await updateTaskStatus(token, task.id, nextStatus);
    setBusyId(null);
    if (!result.ok) {
      Alert.alert('Update Failed', result.error);
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
        tasks.map((task) => (
          <View key={task.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatDate(task.task_date)}</Text>
              {task.priority ? <Text style={styles.priority}>{task.priority.toUpperCase()}</Text> : null}
            </View>
            <Text style={styles.description}>{task.description}</Text>
            {task.location ? <Text style={styles.location}>{task.location}</Text> : null}
            {task.remarks ? <Text style={styles.remarks}>{task.remarks}</Text> : null}

            <View style={styles.cardFooter}>
              <Text style={styles.status}>{STATUS_LABEL[task.status] ?? task.status}</Text>
              {task.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton, busyId === task.id && styles.buttonDisabled]}
                  onPress={() => handleAdvance(task, 'in_progress')}
                  disabled={busyId === task.id}
                >
                  {busyId === task.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionButtonText}>Start</Text>
                  )}
                </TouchableOpacity>
              )}
              {task.status === 'in_progress' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton, busyId === task.id && styles.buttonDisabled]}
                  onPress={() => handleAdvance(task, 'completed')}
                  disabled={busyId === task.id}
                >
                  {busyId === task.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionButtonText}>Complete</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  status: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  startButton: { backgroundColor: '#111827' },
  completeButton: { backgroundColor: '#059669' },
  buttonDisabled: { opacity: 0.5 },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
