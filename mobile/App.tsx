import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import HomeScreen from './src/screens/HomeScreen';
import { getMe } from './src/api';
import { clearToken, loadToken, saveToken } from './src/storage';

type Screen = 'bootstrap' | 'login' | 'capture' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('bootstrap');
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

  const handleCaptureSuccess = async (jwt: string) => {
    await saveToken(jwt);
    setToken(jwt);
    setScreen('home');
  };

  const handleLogout = async () => {
    await clearToken();
    setToken(null);
    setEmpId('');
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
      {screen === 'login' && <LoginScreen onVerify={handleVerify} />}
      {screen === 'capture' && (
        <CaptureScreen empId={empId} onSuccess={handleCaptureSuccess} onCancel={() => setScreen('login')} />
      )}
      {screen === 'home' && token && <HomeScreen token={token} onLogout={handleLogout} />}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
