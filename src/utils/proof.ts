import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Job } from '../types/api';

type Coords = { lat?: string; lng?: string };

export async function pickPhotoBase64(): Promise<string> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return '';
  }

  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true
  });
  if (res.canceled || !res.assets || !res.assets.length || !res.assets[0].base64) {
    return '';
  }

  const type = res.assets[0].mimeType || 'image/jpeg';
  return `data:${type};base64,${res.assets[0].base64}`;
}

export async function captureGpsOptional(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return {};
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: Number(pos.coords.latitude).toFixed(7),
    lng: Number(pos.coords.longitude).toFixed(7)
  };
}

export async function captureCurrentGps(): Promise<Coords> {
  return captureGpsOptional();
}

export async function estimateRouteEta(job: Job): Promise<{ startedAt: string; etaAt: string } | null> {
  const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY;
  if (!apiKey || !job.latitude || !job.longitude) {
    return null;
  }

  const origin = await captureCurrentGps();
  if (!origin.lat || !origin.lng) {
    return null;
  }

  const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/json', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coordinates: [
        [Number(origin.lng), Number(origin.lat)],
        [Number(job.longitude), Number(job.latitude)]
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const durationSeconds = Number(json?.routes?.[0]?.summary?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  const startedAt = new Date();
  const etaAt = new Date(startedAt.getTime() + (durationSeconds * 1000));

  return {
    startedAt: toMysqlDateTime(startedAt),
    etaAt: toMysqlDateTime(etaAt)
  };
}

function toMysqlDateTime(date: Date) {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 19).replace('T', ' ');
}

export function openMaps(job: Job) {
  const hasCoords = !!job.latitude && !!job.longitude;
  const destination = hasCoords
    ? `${job.latitude},${job.longitude}`
    : `${job.address_line}, ${job.suburb}, ${job.state} ${job.postal_code}`;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
}
