import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { logout } from '../../src/api/auth';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/state/auth-context';

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isoFromDate(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
}

function dateFromIso(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatRunDate(value: string) {
  const parsed = dateFromIso(value);
  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RunsScreen() {
  const { token, driver, clearSession } = useAuth();
  const [runDate, setRunDate] = useState(todayIso());
  const [pickerOpen, setPickerOpen] = useState(false);
  const isIOS = Platform.OS === 'ios';

  const title = useMemo(() => (driver ? `${driver.name} (${driver.device_code})` : 'Driver'), [driver]);

  useEffect(() => {
    if (!token) {
      router.replace('/(auth)/login');
    }
  }, [token]);

  async function onLogout() {
    if (token) {
      try {
        await logout(token);
      } catch {}
    }
    await clearSession();
    router.replace('/(auth)/login');
  }

  function openRunDate(selectedDate: Date) {
    const nextDate = isoFromDate(selectedDate);
    setRunDate(nextDate);
    router.push({
      pathname: '/(main)/daily-delivery',
      params: { runDate: nextDate }
    });
  }

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (!isIOS) {
      setPickerOpen(false);
    }

    if (event.type !== 'set' || !selectedDate) {
      return;
    }

    openRunDate(selectedDate);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topCard}>
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>Dispatch board</Text>
          </View>
          <View style={styles.topText}>
            <Text style={styles.kicker}>Daily Dispatch</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Choose a date from the calendar to open that day&apos;s delivery sheet and manage every assigned stop.</Text>
          </View>
          <Pressable onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.selectionCard}>
            <Text style={styles.dateLabel}>Selected delivery date</Text>
            <Text style={styles.dateValue}>{formatRunDate(runDate)}</Text>
            <Text style={styles.cardText}>
              {isIOS ? 'Tap a date below and the app will jump straight to the daily delivery page.' : 'Open the calendar below to choose the delivery date for this run sheet.'}
            </Text>

            {!isIOS && (
              <Pressable style={styles.calendarButton} onPress={() => setPickerOpen(true)}>
                <Text style={styles.calendarButtonText}>Choose date from calendar</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.quickRow}>
            <Pressable style={styles.quickChip} onPress={() => openRunDate(new Date())}>
              <Text style={styles.quickChipTitle}>Today</Text>
              <Text style={styles.quickChipText}>Open current dispatch</Text>
            </Pressable>
            <Pressable
              style={styles.quickChip}
              onPress={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                openRunDate(tomorrow);
              }}
            >
              <Text style={styles.quickChipTitle}>Tomorrow</Text>
              <Text style={styles.quickChipText}>Plan the next route</Text>
            </Pressable>
          </View>

          {(isIOS || pickerOpen) && (
            <View style={styles.calendarCard}>
              <DateTimePicker
                value={dateFromIso(runDate)}
                mode="date"
                display={isIOS ? 'inline' : 'default'}
                onChange={onDateChange}
              />
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Driver flow</Text>
            <View style={styles.flowList}>
              <View style={styles.flowStep}>
                <View style={styles.flowDot}>
                  <Text style={styles.flowDotText}>1</Text>
                </View>
                <Text style={styles.infoText}>Choose the date for the jobs you want to review.</Text>
              </View>
              <View style={styles.flowStep}>
                <View style={styles.flowDot}>
                  <Text style={styles.flowDotText}>2</Text>
                </View>
                <Text style={styles.infoText}>Open the daily delivery sheet and work through each stop.</Text>
              </View>
              <View style={styles.flowStep}>
                <View style={styles.flowDot}>
                  <Text style={styles.flowDotText}>3</Text>
                </View>
                <Text style={styles.infoText}>Capture proof and submit completion when the delivery is done.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f8ff' },
  scrollContent: { paddingBottom: 20 },
  topCard: {
    margin: 12,
    marginBottom: 0,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  topBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  topBadgeText: { color: '#dbeafe', fontWeight: '700', fontSize: 12 },
  topText: { gap: 6 },
  kicker: { color: '#93c5fd', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontWeight: '800', fontSize: 22, color: '#fff' },
  subtitle: { color: '#cbd5e1', lineHeight: 20 },
  logoutBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  content: { padding: 12, gap: 12 },
  selectionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 24,
    padding: 18,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  dateLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  dateValue: { color: '#0f172a', fontSize: 26, fontWeight: '800' },
  cardText: { color: '#475569', lineHeight: 21 },
  calendarButton: {
    marginTop: 4,
    backgroundColor: '#1d4ed8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  calendarButtonText: { color: '#fff', fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 4
  },
  quickChipTitle: { color: '#1d4ed8', fontWeight: '800' },
  quickChipText: { color: '#475569', lineHeight: 18 },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 10,
    overflow: 'hidden'
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 24,
    marginTop: 8,
    gap: 8,
    alignItems: 'flex-start'
  },
  infoTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  infoText: { color: '#475569', lineHeight: 22, flex: 1 },
  flowList: { gap: 12, width: '100%' },
  flowStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flowDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  flowDotText: { color: '#1d4ed8', fontWeight: '800' }
});
