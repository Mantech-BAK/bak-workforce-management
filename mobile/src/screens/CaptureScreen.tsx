import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { faceLogin } from '../api';

type Phase = 'countdown' | 'capturing' | 'verifying' | 'enrolled' | 'error';

const CAPTURE_COUNTDOWN_SECONDS = 3;

export default function CaptureScreen({
  empId,
  onSuccess,
  onCancel,
}: {
  empId: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(CAPTURE_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      capture();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  const capture = async () => {
    if (!cameraRef.current) return;
    setPhase('capturing');

    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
    if (!photo?.base64) {
      setPhase('error');
      return;
    }

    setPhase('verifying');
    const result = await faceLogin(empId, photo.base64);

    if (!result.ok) {
      setPhase('error');
      return;
    }

    if (result.enrolled) {
      setPhase('enrolled');
      setTimeout(() => onSuccess(result.token), 1800);
    } else {
      onSuccess(result.token);
    }
  };

  const retry = () => {
    setCountdown(CAPTURE_COUNTDOWN_SECONDS);
    setPhase('countdown');
  };

  if (!permission || !permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>We need camera access to verify your identity.</Text>
        <Button title="Grant camera access" onPress={requestPermission} />
        <View style={styles.gap} />
        <Button title="Cancel" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <View style={styles.overlay}>
        {phase === 'countdown' && (
          <>
            <Text style={styles.title}>Verify your identity</Text>
            <Text style={styles.subtitle}>Blink and hold still — capturing in {countdown}...</Text>
          </>
        )}
        {(phase === 'capturing' || phase === 'verifying') && (
          <>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.subtitle}>{phase === 'capturing' ? 'Capturing...' : 'Verifying...'}</Text>
          </>
        )}
        {phase === 'enrolled' && <Text style={styles.title}>Enrolling your face for the first time</Text>}
        {phase === 'error' && (
          <>
            <Text style={styles.title}>Verification failed, please try again</Text>
            <View style={styles.row}>
              <Button title="Retry" onPress={retry} />
              <View style={styles.gap} />
              <Button title="Cancel" onPress={onCancel} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', marginTop: 8 },
  gap: { width: 12, height: 12 },
});
