import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Driver } from '../types/api';

type AuthState = {
  token: string;
  driver: Driver | null;
  ready: boolean;
  setSession: (token: string, driver: Driver) => Promise<void>;
  clearSession: () => Promise<void>;
};

const KEY_TOKEN = 'mwb_driver_token';
const KEY_DRIVER = 'mwb_driver_driver';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedToken, savedDriver] = await Promise.all([
        AsyncStorage.getItem(KEY_TOKEN),
        AsyncStorage.getItem(KEY_DRIVER)
      ]);
      if (savedToken) {
        setToken(savedToken);
      }
      if (savedDriver) {
        try {
          setDriver(JSON.parse(savedDriver));
        } catch {
          setDriver(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      driver,
      ready,
      setSession: async (nextToken, nextDriver) => {
        setToken(nextToken);
        setDriver(nextDriver);
        await Promise.all([
          AsyncStorage.setItem(KEY_TOKEN, nextToken),
          AsyncStorage.setItem(KEY_DRIVER, JSON.stringify(nextDriver))
        ]);
      },
      clearSession: async () => {
        setToken('');
        setDriver(null);
        await Promise.all([AsyncStorage.removeItem(KEY_TOKEN), AsyncStorage.removeItem(KEY_DRIVER)]);
      }
    }),
    [driver, ready, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
