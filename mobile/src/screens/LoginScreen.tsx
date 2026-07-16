import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';

export default function LoginScreen({
  onVerify,
  onDevBypass,
}: {
  onVerify: (empId: string) => void;
  onDevBypass?: (empId: string) => void;
}) {
  const [empId, setEmpId] = useState('');

  const handleVerify = () => {
    if (!empId.trim()) return;
    onVerify(empId.trim());
  };

  const handleDevBypass = () => {
    if (!empId.trim()) return;
    onDevBypass?.(empId.trim());
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>BAK Workforce</Text>
      <Text style={styles.subtitle}>Enter your Employee ID to continue</Text>
      <TextInput
        style={styles.input}
        placeholder="Employee ID"
        value={empId}
        onChangeText={setEmpId}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleVerify}
      />
      <TouchableOpacity
        style={[styles.button, !empId.trim() && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={!empId.trim()}
      >
        <Text style={styles.buttonText}>Verify</Text>
      </TouchableOpacity>
      {__DEV__ && onDevBypass && (
        <TouchableOpacity
          style={[styles.devButton, !empId.trim() && styles.buttonDisabled]}
          onPress={handleDevBypass}
          disabled={!empId.trim()}
        >
          <Text style={styles.devButtonText}>Dev: Skip Face Capture</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  devButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
  },
  devButtonText: { color: '#b45309', fontSize: 14, fontWeight: '600' },
});
