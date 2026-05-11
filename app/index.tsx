import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '../src/state/auth-context';

export default function Index() {
  const { token, ready } = useAuth();
  if (!ready) {
    return null;
  }
  return <Redirect href={token ? '/(main)/runs' : '/(auth)/login'} />;
}
