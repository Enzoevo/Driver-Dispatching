import SignatureCapture from '../../../src/components/SignatureCapture';
import { getRuns, updateRun } from '../../../src/api/runs';
import { useAuth } from '../../../src/state/auth-context';
import { Job } from '../../../src/types/api';
import { captureGpsOptional, pickPhotoBase64 } from '../../../src/utils/proof';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function nowMysql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
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

export default function JobDetailScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ assignmentId?: string; runDate?: string }>();
  const assignmentId = Number(firstParam(params.assignmentId) || 0);
  const initialDate = firstParam(params.runDate) || new Date().toISOString().slice(0, 10);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [signatureData, setSignatureData] = useState('');
  const [signatureInteracting, setSignatureInteracting] = useState(false);
  const [photoData, setPhotoData] = useState('');
  const [gps, setGps] = useState<{ lat?: string; lng?: string }>({});

  const title = useMemo(() => (job ? `${job.customer_name} #${job.run_order}` : `Job #${assignmentId}`), [assignmentId, job]);
  const tone = useMemo(() => statusTone(job?.assignment_status), [job?.assignment_status]);

  useEffect(() => {
    if (!token) {
      router.replace('/(auth)/login');
    }
  }, [token]);

  async function loadJob(date: string) {
    if (!token || assignmentId <= 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await getRuns(token, date);
      if (!res.success) {
        setError(res.error.message || 'Could not load runs');
        return;
      }
      const found = (res.data.jobs || []).find((x) => Number(x.assignment_id) === assignmentId) || null;
      if (!found) {
        setError('Job not found in selected date');
      }
      setJob(found);
    } catch (e: any) {
      setError(e?.message || 'Could not load runs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJob(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, token]);

  async function submitCompleted() {
    if (!token || !job) return;
    if (!signatureData) {
      setError('Signature is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await updateRun(token, {
        assignment_id: job.assignment_id,
        status: 'completed',
        proof_signature_data: signatureData,
        proof_photo_data: photoData || undefined,
        proof_latitude: gps.lat,
        proof_longitude: gps.lng,
        proof_captured_at: nowMysql()
      });
      if (!res.success) {
        setError(res.error.message || 'Complete failed');
        return;
      }
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Complete failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap} scrollEnabled={!signatureInteracting}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Completion desk</Text>
          </View>
          <Pressable onPress={() => router.back()} style={styles.backChip}>
            <Text style={styles.backChipText}>Back to daily delivery</Text>
          </Pressable>

          <Text style={styles.kicker}>Proof Of Delivery</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Review the stop details, collect the required proof, and submit completion once the delivery is finished.</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaLabel}>Run date</Text>
              <Text style={styles.heroMetaValue}>{formatRunDate(initialDate)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text style={[styles.statusBadgeText, { color: tone.text }]}>{formatStatus(job?.assignment_status)}</Text>
            </View>
          </View>
        </View>

        {loading && !job && (
          <View style={styles.noticeCard}>
            <ActivityIndicator color="#1d4ed8" />
            <Text style={styles.noticeTitle}>Loading job details</Text>
            <Text style={styles.noticeText}>Fetching the selected delivery record and proof requirements.</Text>
          </View>
        )}

        {job && (
          <View style={styles.card}>
            <Text style={styles.head}>{job.customer_name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipLabel}>Service</Text>
                <Text style={styles.metaChipValue}>{job.service_name}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipLabel}>ETA</Text>
                <Text style={styles.metaChipValue}>{formatTime(job.eta_time)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipLabel}>Phone</Text>
                <Text style={styles.metaChipValue}>{job.customer_phone}</Text>
              </View>
            </View>

            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>Delivery address</Text>
              <Text style={styles.addressText}>{`${job.address_line}, ${job.suburb}, ${job.state} ${job.postal_code}`}</Text>
            </View>
          </View>
        )}

        {!loading && !job && !error && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Job not available</Text>
            <Text style={styles.noticeText}>This assignment could not be found for the selected run date.</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.checklistRow}>
            <View style={[styles.checklistChip, signatureData ? styles.checklistChipDone : styles.checklistChipPending]}>
              <Text style={[styles.checklistChipText, signatureData ? styles.checklistChipDoneText : styles.checklistChipPendingText]}>Signature</Text>
            </View>
            <View style={[styles.checklistChip, photoData ? styles.checklistChipDone : styles.checklistChipPending]}>
              <Text style={[styles.checklistChipText, photoData ? styles.checklistChipDoneText : styles.checklistChipPendingText]}>Photo</Text>
            </View>
            <View style={[styles.checklistChip, gps.lat && gps.lng ? styles.checklistChipDone : styles.checklistChipPending]}>
              <Text style={[styles.checklistChipText, gps.lat && gps.lng ? styles.checklistChipDoneText : styles.checklistChipPendingText]}>GPS</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Customer signature</Text>
          <Text style={styles.sectionText}>A signature is required before this delivery can be marked complete.</Text>
          <SignatureCapture value={signatureData} onChange={setSignatureData} onInteractionChange={setSignatureInteracting} />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTextWrap}>
              <Text style={styles.sectionTitle}>Delivery photo</Text>
              <Text style={styles.sectionText}>Optional photo proof for the completed stop.</Text>
            </View>
            <View style={[styles.stateBadge, photoData ? styles.stateComplete : styles.statePending]}>
              <Text style={[styles.stateBadgeText, photoData ? styles.stateCompleteText : styles.statePendingText]}>{photoData ? 'Captured' : 'Optional'}</Text>
            </View>
          </View>

          <Pressable
            style={styles.secondaryAction}
            onPress={async () => {
              const data = await pickPhotoBase64();
              setPhotoData(data);
            }}
          >
            <Text style={styles.secondaryActionText}>{photoData ? 'Retake Photo' : 'Capture Photo'}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTextWrap}>
              <Text style={styles.sectionTitle}>GPS location</Text>
              <Text style={styles.sectionText}>Optional location record for proof of delivery.</Text>
            </View>
            <View style={[styles.stateBadge, gps.lat && gps.lng ? styles.stateComplete : styles.statePending]}>
              <Text style={[styles.stateBadgeText, gps.lat && gps.lng ? styles.stateCompleteText : styles.statePendingText]}>
                {gps.lat && gps.lng ? 'Captured' : 'Optional'}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.secondaryAction}
            onPress={async () => {
              const point = await captureGpsOptional();
              setGps(point);
            }}
          >
            <Text style={styles.secondaryActionText}>{gps.lat && gps.lng ? `${gps.lat}, ${gps.lng}` : 'Capture GPS'}</Text>
          </Pressable>
        </View>

        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to complete this stop</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.footerCard}>
          <Text style={styles.footerText}>Signature is required. Photo and GPS are optional and can be added when available.</Text>
          <Pressable onPress={submitCompleted} style={[styles.doneBtn, (submitting || !job || loading) && styles.disabledBtn]} disabled={submitting || !job || loading}>
            <Text style={styles.doneText}>{submitting ? 'Submitting...' : 'Submit Completion'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f8ff' },
  wrap: { padding: 14, gap: 12, paddingBottom: 28 },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 26,
    padding: 18,
    gap: 10
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  heroBadgeText: { color: '#dbeafe', fontWeight: '700', fontSize: 12 },
  backChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  backChipText: { color: '#fff', fontWeight: '700' },
  kicker: { color: '#93c5fd', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontWeight: '800', fontSize: 22, color: '#fff' },
  subtitle: { color: '#cbd5e1', lineHeight: 20 },
  heroMetaRow: { gap: 10 },
  heroMetaCard: {
    backgroundColor: '#172554',
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  heroMetaLabel: { color: '#93c5fd', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroMetaValue: { color: '#fff', fontWeight: '800', fontSize: 16 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusBadgeText: { fontWeight: '800', fontSize: 12 },
  noticeCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 20,
    padding: 18,
    gap: 8,
    alignItems: 'center'
  },
  noticeTitle: { color: '#0f172a', fontWeight: '800', fontSize: 18, textAlign: 'center' },
  noticeText: { color: '#475569', textAlign: 'center', lineHeight: 21 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 22,
    padding: 16,
    gap: 12
  },
  head: { fontWeight: '800', color: '#0f172a', fontSize: 20 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
  metaChipLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaChipValue: { color: '#0f172a', fontWeight: '700' },
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
  sectionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 22,
    padding: 16,
    gap: 10
  },
  checklistRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  checklistChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  checklistChipPending: { backgroundColor: '#e2e8f0' },
  checklistChipDone: { backgroundColor: '#dcfce7' },
  checklistChipText: { fontWeight: '800', fontSize: 12 },
  checklistChipPendingText: { color: '#334155' },
  checklistChipDoneText: { color: '#166534' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  sectionTextWrap: { flex: 1, gap: 4 },
  sectionTitle: { fontWeight: '800', color: '#0f172a', fontSize: 17 },
  sectionText: { color: '#475569', lineHeight: 21 },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statePending: { backgroundColor: '#e2e8f0' },
  stateComplete: { backgroundColor: '#dcfce7' },
  stateBadgeText: { fontWeight: '800', fontSize: 12 },
  statePendingText: { color: '#334155' },
  stateCompleteText: { color: '#166534' },
  secondaryAction: {
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  secondaryActionText: { color: '#0f172a', fontWeight: '700', textAlign: 'center' },
  errorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 14,
    gap: 4
  },
  errorTitle: { color: '#991b1b', fontWeight: '800' },
  errorText: { color: '#b91c1c', lineHeight: 20 },
  footerCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 22,
    padding: 16,
    gap: 12
  },
  footerText: { color: '#475569', lineHeight: 21 },
  doneBtn: { backgroundColor: '#15803d', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  doneText: { color: '#fff', fontWeight: '800' },
  disabledBtn: { opacity: 0.6 }
});
