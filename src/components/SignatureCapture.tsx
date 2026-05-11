import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  value: string;
  onChange: (dataUrl: string) => void;
  onInteractionChange?: (active: boolean) => void;
};

export default function SignatureCapture({ value, onChange, onInteractionChange }: Props) {
  const ref = useRef<WebView>(null);

  const source = useMemo(
    () => ({
      html: `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
        touch-action: none;
      }

      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="signature-pad"></canvas>
    <script>
      const canvas = document.getElementById('signature-pad');
      const context = canvas.getContext('2d');
      let drawing = false;
      let hasInk = false;

      function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(ratio, ratio);
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#111827';
      }

      function pointFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
      }

	      function postValue() {
	        const payload = hasInk ? canvas.toDataURL('image/png') : '';
	        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'value', data: payload }));
	      }

	      function postInteraction(active) {
	        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interaction', data: active }));
	      }

	      function startDraw(event) {
	        event.preventDefault();
	        const point = pointFromEvent(event);
	        drawing = true;
	        hasInk = true;
	        context.beginPath();
	        context.moveTo(point.x, point.y);
	        postInteraction(true);
	      }

      function moveDraw(event) {
        if (!drawing) {
          return;
        }

        event.preventDefault();
        const point = pointFromEvent(event);
        context.lineTo(point.x, point.y);
        context.stroke();
      }

      function endDraw(event) {
        if (!drawing) {
          return;
        }

	        event.preventDefault();
	        drawing = false;
	        postInteraction(false);
	        postValue();
	      }

	      function clearCanvas() {
	        context.clearRect(0, 0, canvas.width, canvas.height);
	        hasInk = false;
	        drawing = false;
	        postInteraction(false);
	        postValue();
	      }

      canvas.addEventListener('pointerdown', startDraw);
	      canvas.addEventListener('pointermove', moveDraw);
	      canvas.addEventListener('pointerup', endDraw);
	      canvas.addEventListener('pointerleave', endDraw);
	      canvas.addEventListener('pointercancel', endDraw);
	      window.addEventListener('resize', resizeCanvas);
	      resizeCanvas();
	      window.clearSignature = clearCanvas;
	    </script>
  </body>
</html>`
    }),
    []
  );

  function clearSignature() {
    ref.current?.injectJavaScript('window.clearSignature(); true;');
    onInteractionChange?.(false);
    onChange('');
  }

  function onMessage(data: string) {
    try {
      const parsed = JSON.parse(data) as { type?: string; data?: unknown };

      if (parsed.type === 'interaction') {
        onInteractionChange?.(Boolean(parsed.data));
        return;
      }

      if (parsed.type === 'value') {
        onChange(typeof parsed.data === 'string' ? parsed.data : '');
        return;
      }
    } catch {}

    onChange(data);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Signature (required)</Text>
        <View style={[styles.statePill, value ? styles.stateReady : styles.statePending]}>
          <Text style={[styles.statePillText, value ? styles.stateReadyText : styles.statePendingText]}>{value ? 'Captured' : 'Pending'}</Text>
        </View>
      </View>
      <Text style={styles.helper}>Ask the customer to sign inside the panel below before submitting completion.</Text>
      <View style={styles.padHintBar}>
        <Text style={styles.padHintText}>Please sign clearly within the box</Text>
      </View>
      <View style={styles.pad}>
        <WebView
          ref={ref}
          source={source}
          onMessage={(event) => onMessage(event.nativeEvent.data)}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
          style={styles.webview}
        />
      </View>
      <View style={styles.row}>
        <Pressable onPress={clearSignature} style={styles.btn}>
          <Text style={styles.btnText}>Clear signature</Text>
        </Pressable>
        <Text style={styles.state}>{value ? 'Ready to submit' : 'Required before completion'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontWeight: '800', color: '#0f172a', fontSize: 16 },
  helper: { color: '#475569', lineHeight: 20 },
  padHintBar: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  padHintText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  pad: { height: 190, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff' },
  webview: { backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  btn: { backgroundColor: '#e2e8f0', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  btnText: { color: '#0f172a', fontWeight: '700' },
  state: { color: '#64748b', flex: 1, textAlign: 'right' },
  statePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  statePending: { backgroundColor: '#e2e8f0' },
  stateReady: { backgroundColor: '#dcfce7' },
  statePillText: { fontWeight: '800', fontSize: 12 },
  statePendingText: { color: '#334155' },
  stateReadyText: { color: '#166534' }
});
