import React, { useState } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import focusLockService from '../services/focusLockService';

export default function FocusLockTest() {
  const [status, setStatus] = useState('Ready to test');
  const [isAvailable, setIsAvailable] = useState(focusLockService.isAvailable());
  
  const testAuthorization = async () => {
    setStatus('Requesting authorization...');
    const granted = await focusLockService.requestAuthorization();
    setStatus(granted ? '✅ Authorized!' : '❌ Authorization denied');
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Focus Lock Test</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.info}>
        Module available: {isAvailable ? '✅' : '❌'}
      </Text>
      <Button 
        title="1. Request Authorization" 
        onPress={testAuthorization}
      />
      <Text style={styles.note}>
        Note: Must test on physical device
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  status: { fontSize: 18, marginBottom: 20, color: '#333' },
  info: { fontSize: 14, marginBottom: 20, color: '#666' },
  note: { fontSize: 12, marginTop: 20, fontStyle: 'italic', color: '#999' },
});
