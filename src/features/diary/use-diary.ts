import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { z } from 'zod';
import { useApp } from '../../shared/app-provider';
import type { Catalog } from '../../core/database/repositories/diary-repository';
import type { Meal, WaterEntry } from '../../domain/nutrition/nutrition';

export function useDiary() {
  const app = useApp();
  const { diary, snapshot, selectedDate, revision } = app;
  const [data, setData] = useState<{
    date: string;
    key: string;
    catalog: Catalog;
    meals: Meal[];
    water: WaterEntry[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profileId = snapshot?.profile.id;
  const queryKey = `${profileId}:${selectedDate}:${revision}:${attempt}`;
  useFocusEffect(
    useCallback(() => {
      // A versão e a tentativa invalidam esta leitura mesmo quando a data permanece igual.
      let current = true;
      setError(false);
      if (diary && profileId && selectedDate) {
        void Promise.all([diary.catalog(profileId), diary.day(profileId, selectedDate)])
          .then(([catalog, day]) => {
            if (current) setData({ date: selectedDate, key: queryKey, catalog, ...day });
          })
          .catch(() => {
            if (current) setError(true);
          });
      }
      return () => {
        current = false;
      };
    }, [diary, profileId, selectedDate, queryKey]),
  );
  return {
    ...app,
    data: data?.date === selectedDate && !error ? data : null,
    refreshing: data?.key !== queryKey,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function run(work: () => Promise<void>, success = 'Salvo neste dispositivo.') {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await work();
      setMessage(success);
      return true;
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof z.ZodError
          ? 'Revise os campos, as quantidades e os valores informados.'
          : 'Não foi possível concluir. Confira os campos e tente novamente.',
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { run, busy, message, failed };
}
