import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import { devLogin, getMe } from './src/api';
import { clearToken, loadToken, saveToken } from './src/storage';

type Screen = 'bootstrap' | 'login' | 'capture' | 'home';
type HomeTab = 'home' | 'tasks';

export default function App() {
  const [screen, setScreen] = useState<Screen>('bootstrap');
  const [homeTab, setHomeTab] = useState<HomeTab>('home');
  const [empId, setEmpId] = useState('');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
  
    (async () => {
      const stored = await loadToken();
      if (stored) {
        const me = await getMe(stored);
        if (me) {
          setToken(stored);
          setScreen('home');
          return;
        }
        await clearToken();
      }
      setScreen('login');
    })();
  }, []);
  const handleVerify = (id: string) => {
    setEmpId(id);
    setScreen('capture');
  };

  const handleDevBypass = async (id: string) => {
    const result = await devLogin(id);
    if (!result.ok) {
      Alert.alert('Dev Login Failed', result.error);
      return;
    }
    await saveToken(result.token);
    setEmpId(id);
    setToken(result.token);
    setScreen('home');
  };

  const handleCaptureSuccess = async (jwt: string) => {
    await saveToken(jwt);
    setToken(jwt);
    setScreen('home');
  };

  const handleLogout = async () => {
    await clearToken();
    setToken(null);
    setEmpId('');
    setHomeTab('home');
    setScreen('login');
  };

  if (screen === 'bootstrap') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      {screen === 'login' && (
        <LoginScreen onVerify={handleVerify} onDevBypass={__DEV__ ? handleDevBypass : undefined} />
      )}
      {screen === 'capture' && (
        <CaptureScreen empId={empId} onSuccess={handleCaptureSuccess} onCancel={() => setScreen('login')} />
      )}
      {screen === 'home' && token && (
        <View style={styles.homeContainer}>
          <View style={styles.tabContent}>
            {homeTab === 'home' ? (
              <HomeScreen token={token} onLogout={handleLogout} />
            ) : (
              <TasksScreen token={token} />
            )}
          </View>
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tabButton} onPress={() => setHomeTab('home')}>
              <Text style={[styles.tabLabel, homeTab === 'home' && styles.tabLabelActive]}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => setHomeTab('tasks')}>
              <Text style={[styles.tabLabel, homeTab === 'tasks' && styles.tabLabelActive]}>Tasks</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  homeContainer: { flex: 1 },
  tabContent: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabLabelActive: { color: '#111827' },
});