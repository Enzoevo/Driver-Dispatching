import { login } from '../../src/api/auth';
import { useAuth } from '../../src/state/auth-context';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

function hasValidSessionPayload(value: unknown): value is { token: string; driver: { id: number; name: string; device_code: string } } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const driver = candidate.driver;
  return (
    typeof candidate.token === 'string' &&
    !!driver &&
    typeof driver === 'object' &&
    typeof (driver as Record<string, unknown>).id === 'number' &&
    typeof (driver as Record<string, unknown>).name === 'string' &&
    typeof (driver as Record<string, unknown>).device_code === 'string'
  );
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function LoginScreen() {
  const { token, setSession } = useAuth();
  const [deviceCode, setDeviceCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shiftLabel = useMemo(() => todayLabel(), []);

  useEffect(() => {
    if (token) {
      router.replace('/(main)/runs');
    }
  }, [token]);

  async function onLogin() {
    setLoading(true);
    setError('');
    try {
      const res = await login(deviceCode.trim());
      if (!res.success) {
        setError(res.error.message || 'Login failed');
        return;
      }
      if (!hasValidSessionPayload(res.data)) {
        setError('Login response was missing token or driver details.');
        return;
      }

      await setSession(res.data.token, res.data.driver);
      router.replace('/(main)/runs');
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{shiftLabel}</Text>
            </View>
            <View style={[styles.heroBadge, styles.heroBadgeAlt]}>
              <Text style={styles.heroBadgeText}>Ready for dispatch</Text>
            </View>
          </View>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Driver Portal</Text>
            <Text style={styles.title}>MWB Driver</Text>
            <Text style={styles.subtitle}>Sign in with your assigned device code to continue to your delivery schedule.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Secure sign in</Text>
            <Text style={styles.cardSubtitle}>Use the device code linked to this driver handset.</Text>
          </View>

          <Text style={styles.label}>Device code</Text>
          <TextInput
            value={deviceCode}
            onChangeText={setDeviceCode}
            placeholder="Enter device code"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.btn, loading && styles.disabled]} onPress={onLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </Pressable>

          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Need access?</Text>
            <Text style={styles.supportText}>If this device does not have a code yet, contact dispatch or admin before starting your shift.</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#edf4ff' },
  backgroundOrbTop: {
    position: 'absolute',
    top: -100,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: '#bfdbfe'
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: '#dbeafe'
  },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 18 },
  heroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 22,
    gap: 18
  },
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: {
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  heroBadgeAlt: { backgroundColor: '#1e293b' },
  heroBadgeText: { color: '#dbeafe', fontWeight: '700', fontSize: 12 },
  hero: { gap: 8 },
  eyebrow: { color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 34, fontWeight: '800', color: '#fff' },
  subtitle: { color: '#cbd5e1', fontSize: 16, lineHeight: 23 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#cfe0ff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  cardHeader: { gap: 4, marginBottom: 2 },
  cardTitle: { color: '#0f172a', fontWeight: '800', fontSize: 20 },
  cardSubtitle: { color: '#64748b', lineHeight: 20 },
  label: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  input: {
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#0f172a'
  },
  btn: { backgroundColor: '#1d4ed8', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.65 },
  error: { color: '#b91c1c', lineHeight: 20 },
  supportCard: {
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  supportTitle: { color: '#1e3a8a', fontWeight: '800' },
  supportText: { color: '#475569', lineHeight: 19 }
});
