import { logout } from '../../src/api/auth';
import { getRuns, updateRun } from '../../src/api/runs';
import { useAuth } from '../../src/state/auth-context';
import { Job } from '../../src/types/api';
import { estimateRouteEta, openMaps } from '../../src/utils/proof';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from 'react-native';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatRunDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(value: string | undefined) {
  return String(value || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value: string | null | undefined) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 5) : '--';
}

function displayStartTime(job: Job) {
  return job.driver_start_time || job.scheduled_start_time || job.start_time || '';
}

function etaFromStartTime(value: string | null | undefined) {
  const text = String(value || '').trim();
  if (!text) {
    return '--';
  }

  const [hoursText, minutesText] = text.slice(0, 5).split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return '--';
  }

  const totalMinutes = (hours * 60) + minutes + 60;
  const nextHours = String(Math.floor((totalMinutes / 60) % 24)).padStart(2, '0');
  const nextMinutes = String(totalMinutes % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

function statusTone(status: string | undefined) {
  switch (status) {
    case 'completed':
      return { bg: '#dcfce7', border: '#86efac', text: '#166534' };
    case 'failed':
      return { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' };
    case 'arrived':
      return { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' };
    case 'on_route':
      return { bg: '#fef3c7', border: '#fcd34d', text: '#b45309' };
    default:
      return { bg: '#e2e8f0', border: '#cbd5e1', text: '#334155' };
  }
}

const TIMELINE_STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'on_route', label: 'On route' },
  { key: 'arrived', label: 'At stop' },
  { key: 'completed', label: 'Complete' }
];

function progressStage(status: string | undefined) {
  switch (status) {
    case 'completed':
      return 3;
    case 'failed':
      return 2;
    case 'arrived':
      return 2;
    case 'on_route':
      return 1;
    default:
      return 0;
  }
}

function progressPercent(status: string | undefined) {
  switch (status) {
    case 'completed':
      return 100;
    case 'failed':
      return 72;
    case 'arrived':
      return 72;
    case 'on_route':
      return 46;
    default:
      return 18;
  }
}

function progressAccent(status: string | undefined) {
  switch (status) {
    case 'completed':
      return '#15803d';
    case 'failed':
      return '#b91c1c';
    case 'arrived':
      return '#2563eb';
    case 'on_route':
      return '#b45309';
    default:
      return '#0f172a';
  }
}

function progressMessage(status: string | undefined) {
  switch (status) {
    case 'completed':
      return 'Proof submitted and delivery completed.';
    case 'failed':
      return 'Stop marked as failed. Dispatch may follow up.';
    case 'arrived':
      return 'Driver has arrived and is ready to complete the stop.';
    case 'on_route':
      return 'Driver is heading to the customer now.';
    default:
      return 'Stop is assigned and waiting for departure.';
  }
}

function timelineStepMode(status: string | undefined, index: number) {
  const stage = progressStage(status);
  if (status === 'failed') {
    if (index < stage) return 'done';
    if (index === stage) return 'failed';
    return 'upcoming';
  }
  if (index < stage) return 'done';
  if (index === stage) return 'current';
  return 'upcoming';
}

export default function DailyDeliveryScreen() {
  const { token, driver, clearSession } = useAuth();
  const params = useLocalSearchParams<{ runDate?: string }>();
  const runDate = firstParam(params.runDate) || new Date().toISOString().slice(0, 10);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const title = useMemo(() => (driver ? `${driver.name} (${driver.device_code})` : 'Driver'), [driver]);
  const completedCount = useMemo(() => jobs.filter((job) => job.assignment_status === 'completed').length, [jobs]);
  const pendingCount = useMemo(() => jobs.filter((job) => job.assignment_status !== 'completed').length, [jobs]);
  const dayProgressPercent = useMemo(() => {
    if (!jobs.length) return 0;
    return Math.round((completedCount / jobs.length) * 100);
  }, [completedCount, jobs.length]);
  const dayStage = useMemo(() => {
    if (!jobs.length) return 0;
    if (completedCount === jobs.length) return 3;
    if (jobs.some((job) => job.assignment_status === 'arrived')) return 2;
    if (jobs.some((job) => job.assignment_status === 'on_route')) return 1;
    return 0;
  }, [completedCount, jobs]);

  useEffect(() => {
    if (!token) {
      router.replace('/(auth)/login');
    }
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await getRuns(token, runDate);
      if (!res.success) {
        setError(res.error.message || 'Failed to load runs');
        return;
      }
      const nextJobs = [...(res.data.jobs || [])].sort((a, b) => a.run_order - b.run_order);
      setJobs(nextJobs);
    } catch (e: any) {
      setError(e?.message || 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, [runDate, token]);

  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        void refresh();
      }
    }, [refresh, token])
  );

  async function onLogout() {
    if (token) {
      try {
        await logout(token);
      } catch {}
    }
    await clearSession();
    router.replace('/(auth)/login');
  }

  async function onStatusChange(assignmentId: number, status: 'on_route' | 'arrived' | 'failed') {
    if (!token) return;
    setUpdatingId(assignmentId);
    setError('');
    try {
      const res = await updateRun(token, { assignment_id: assignmentId, status });
      if (!res.success) {
        setError(res.error.message || 'Failed to update run');
        return;
      }
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to update run');
    } finally {
      setUpdatingId(null);
    }
  }

  async function onNavigate(job: Job) {
    if (!token) {
      openMaps(job);
      return;
    }

    if (job.assignment_status === 'on_route' || job.assignment_status === 'arrived' || job.assignment_status === 'completed') {
      openMaps(job);
      return;
    }

    setUpdatingId(job.assignment_id);
    setError('');
    try {
      const routeEstimate = await estimateRouteEta(job);
      const res = await updateRun(token, {
        assignment_id: job.assignment_id,
        status: 'on_route',
        route_started_at: routeEstimate?.startedAt,
        route_eta_at: routeEstimate?.etaAt
      });
      if (!res.success) {
        setError(res.error.message || 'Failed to update run');
      } else {
        await refresh();
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update run');
    } finally {
      setUpdatingId(null);
    }
    openMaps(job);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topCard}>
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>Route board</Text>
        </View>
        <View style={styles.topText}>
          <Text style={styles.kicker}>Daily Delivery</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{formatRunDate(runDate)}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Change Date</Text>
          </Pressable>
          <Pressable onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryStops]}>
          <Text style={styles.summaryLabel}>Stops</Text>
          <Text style={styles.summaryValue}>{jobs.length}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryPendingCard]}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryAccent]}>
          <Text style={styles.summaryLabel}>Completed</Text>
          <Text style={styles.summaryValue}>{completedCount}</Text>
        </View>
      </View>

      <View style={styles.deliveryProgressCard}>
        <View style={styles.deliveryProgressHeader}>
          <View>
            <Text style={styles.deliveryProgressTitle}>Today&apos;s delivery progress</Text>
            <Text style={styles.deliveryProgressText}>
              {jobs.length
                ? `${completedCount} of ${jobs.length} stops completed`
                : 'No stops assigned for this date'}
            </Text>
          </View>
          <Text style={styles.deliveryProgressPercent}>{dayProgressPercent}%</Text>
        </View>
        <View style={styles.deliveryProgressTrack}>
          <View style={[styles.deliveryProgressFill, { width: `${dayProgressPercent}%` }]} />
        </View>
        <View style={styles.deliveryTimelineSteps}>
          {TIMELINE_STEPS.map((step, index) => {
            const isDone = index < dayStage || (index === dayStage && dayProgressPercent === 100);
            const isCurrent = index === dayStage && dayProgressPercent < 100;

            return (
              <View key={step.key} style={styles.deliveryTimelineStep}>
                <View
                  style={[
                    styles.deliveryTimelineDot,
                    isDone ? styles.deliveryTimelineDotDone : isCurrent ? styles.deliveryTimelineDotCurrent : styles.deliveryTimelineDotUpcoming
                  ]}
                >
                  <Text
                    style={[
                      styles.deliveryTimelineDotText,
                      isDone || isCurrent ? styles.deliveryTimelineDotTextActive : styles.deliveryTimelineDotTextUpcoming
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.deliveryTimelineLabel,
                    isDone || isCurrent ? styles.deliveryTimelineLabelActive : styles.deliveryTimelineLabelUpcoming
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load daily delivery</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.assignment_id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#1d4ed8" />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.emptyTitle}>Loading assigned services</Text>
              <Text style={styles.emptyText}>Fetching the latest delivery sheet for {runDate}.</Text>
            </View>
          ) : !error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No services scheduled</Text>
              <Text style={styles.emptyText}>There are no assigned deliveries for {runDate}. If you expected work today, please contact dispatch.</Text>
            </View>
          ) : null
        }
	        renderItem={({ item }) => {
	          const tone = statusTone(item.assignment_status);
	          const busy = updatingId === item.assignment_id;
	          const startTime = displayStartTime(item);
            const progressColor = progressAccent(item.assignment_status);
	
	          return (
	            <View style={[styles.card, { borderLeftColor: tone.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.stopBadge}>
                  <Text style={styles.stopBadgeText}>Stop #{item.run_order}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <Text style={[styles.statusBadgeText, { color: tone.text }]}>{formatStatus(item.assignment_status)}</Text>
                </View>
              </View>

              <Text style={styles.name}>{item.customer_name}</Text>
              <Text style={styles.jobLead}>Delivery for {item.service_name}</Text>

	              <View style={styles.infoRow}>
	                <View style={styles.infoChip}>
                  <Text style={styles.infoChipLabel}>Start</Text>
                  <Text style={styles.infoChipValue}>{formatTime(startTime)}</Text>
                </View>
                <View style={styles.infoChip}>
                  <Text style={styles.infoChipLabel}>ETA</Text>
                  <Text style={styles.infoChipValue}>{etaFromStartTime(startTime)}</Text>
                </View>
                <View style={styles.infoChip}>
                  <Text style={styles.infoChipLabel}>Service</Text>
                  <Text style={styles.infoChipValue}>{item.service_name}</Text>
	                </View>
	              </View>
                <View style={styles.stopProgressRow}>
                  <Text style={styles.stopProgressLabel}>Stop progress</Text>
                  <Text style={[styles.stopProgressValue, { color: progressColor }]}>{progressMessage(item.assignment_status)}</Text>
                </View>

	              <View style={styles.addressCard}>
	                <Text style={styles.addressLabel}>Delivery address</Text>
                <Text style={styles.addressText}>{`${item.address_line}, ${item.suburb}, ${item.state} ${item.postal_code}`}</Text>
                <Text style={styles.phoneText}>{item.customer_phone}</Text>
              </View>

              <Text style={styles.sectionLabel}>Quick updates</Text>

              <View style={styles.actions}>
                <Pressable onPress={() => onNavigate(item)} style={styles.neutralBtn} disabled={busy}>
                  <Text style={styles.neutralBtnText}>Navigate</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => onStatusChange(item.assignment_id, 'on_route')} style={[styles.neutralBtn, busy && styles.disabledBtn]}>
                  <Text style={styles.neutralBtnText}>On Route</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => onStatusChange(item.assignment_id, 'arrived')} style={[styles.neutralBtn, busy && styles.disabledBtn]}>
                  <Text style={styles.neutralBtnText}>Arrived</Text>
                </Pressable>
              </View>

              {busy && <Text style={styles.updatingText}>Saving status update...</Text>}

              <View style={styles.actions}>
                <Pressable disabled={busy} onPress={() => onStatusChange(item.assignment_id, 'failed')} style={[styles.failBtn, busy && styles.disabledBtn]}>
                  <Text style={styles.actionText}>Failed</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    router.push({
                      pathname: '/(main)/job/[assignmentId]',
                      params: { assignmentId: String(item.assignment_id), runDate }
                    })
                  }
                  style={[styles.doneBtn, busy && styles.disabledBtn]}
                >
                  <Text style={styles.actionText}>Complete</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f8ff' },
  topCard: {
    margin: 12,
    marginBottom: 0,
    backgroundColor: '#0f172a',
    borderRadius: 26,
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
  subtitle: { color: '#cbd5e1', lineHeight: 20, fontWeight: '600' },
  topActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  secondaryBtnText: { color: '#1d4ed8', fontWeight: '700' },
  logoutBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  summaryStops: { backgroundColor: '#eff6ff' },
  summaryPendingCard: { backgroundColor: '#fffbeb' },
  summaryAccent: { backgroundColor: '#f0fdf4' },
  summaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  summaryValue: { color: '#0f172a', fontSize: 24, fontWeight: '800', marginTop: 6 },
	  deliveryProgressCard: {
	    marginHorizontal: 12,
	    marginTop: 12,
	    backgroundColor: '#ffffff',
	    borderRadius: 18,
	    borderWidth: 1,
	    borderColor: '#dbeafe',
	    padding: 14,
	    gap: 10
	  },
	  deliveryProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
	  deliveryProgressTitle: { color: '#0f172a', fontWeight: '800' },
	  deliveryProgressText: { color: '#475569', lineHeight: 20, marginTop: 2 },
	  deliveryProgressPercent: { color: '#1d4ed8', fontWeight: '800', fontSize: 20 },
	  deliveryProgressTrack: {
	    height: 10,
	    borderRadius: 999,
	    backgroundColor: '#dbeafe',
	    overflow: 'hidden'
	  },
	  deliveryProgressFill: {
	    height: '100%',
	    borderRadius: 999,
	    backgroundColor: '#2563eb'
	  },
    deliveryTimelineSteps: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
    deliveryTimelineStep: { flex: 1, alignItems: 'center', gap: 6 },
    deliveryTimelineDot: {
      width: 26,
      height: 26,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1
    },
    deliveryTimelineDotDone: { backgroundColor: '#1d4ed8', borderColor: '#60a5fa' },
    deliveryTimelineDotCurrent: { backgroundColor: '#111827', borderColor: '#1d4ed8' },
    deliveryTimelineDotUpcoming: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
    deliveryTimelineDotText: { fontWeight: '800', fontSize: 11 },
    deliveryTimelineDotTextActive: { color: '#fff' },
    deliveryTimelineDotTextUpcoming: { color: '#1d4ed8' },
    deliveryTimelineLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
    deliveryTimelineLabelActive: { color: '#0f172a' },
    deliveryTimelineLabelUpcoming: { color: '#64748b' },
  errorCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 14,
    gap: 4
  },
  errorTitle: { color: '#991b1b', fontWeight: '800' },
  errorText: { color: '#b91c1c', lineHeight: 20 },
  listContent: { padding: 12, gap: 12, paddingBottom: 28, flexGrow: 1 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 24,
    marginTop: 8,
    gap: 10,
    alignItems: 'center'
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  emptyText: { color: '#475569', textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderLeftWidth: 5,
    padding: 16,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stopBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  stopBadgeText: { color: '#1d4ed8', fontWeight: '800' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  statusBadgeText: { fontWeight: '800', fontSize: 12 },
  name: { fontWeight: '800', color: '#0f172a', fontSize: 18 },
  jobLead: { color: '#475569', marginTop: -2 },
  infoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  infoChip: {
    minWidth: 92,
    flexGrow: 1,
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
	  infoChipLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
	  infoChipValue: { color: '#0f172a', fontWeight: '700' },
    stopProgressRow: {
      borderRadius: 18,
      backgroundColor: '#f8fbff',
      borderWidth: 1,
      borderColor: '#dbeafe',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4
    },
    stopProgressLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    stopProgressValue: { fontWeight: '700', lineHeight: 20 },
	  addressCard: {
	    borderRadius: 18,
	    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
    gap: 6
  },
  addressLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  addressText: { color: '#0f172a', lineHeight: 21, fontWeight: '600' },
  phoneText: { color: '#475569' },
  sectionLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  updatingText: { color: '#1d4ed8', fontWeight: '700', marginTop: -2 },
  actions: { flexDirection: 'row', gap: 8 },
  neutralBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center'
  },
  neutralBtnText: { color: '#0f172a', fontWeight: '700' },
  failBtn: { flex: 1, backgroundColor: '#b91c1c', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  doneBtn: { flex: 1, backgroundColor: '#15803d', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '800' },
  disabledBtn: { opacity: 0.6 }
});
