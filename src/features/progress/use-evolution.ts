import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { MonthActivityMap } from '../../core/database/repositories/evolution-repository';
import {
  monthRange,
  type BodyMilestone,
  type Habit,
  type HabitLog,
  type MeasurementEntry,
  type PeriodReportInput,
  type SleepEntry,
  type WeeklyReview,
  type WeightEntry,
} from '../../domain/evolution/evolution';
import { useApp } from '../../shared/app-provider';

export function useEvolution() {
  const app = useApp();
  const { evolution, snapshot, selectedDate, revision } = app;
  const [data, setData] = useState<{
    key: string;
    date: string;
    weights: WeightEntry[];
    measurements: MeasurementEntry[];
    milestones: BodyMilestone[];
    daySleep: SleepEntry[];
    allSleep: SleepEntry[];
    habits: Habit[];
    dayHabitLogs: HabitLog[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profileId = snapshot?.profile.id;
  const queryKey = `${profileId}:${selectedDate}:${revision}:${attempt}`;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(false);
      if (evolution && profileId && selectedDate) {
        void Promise.all([
          evolution.listWeights(profileId),
          evolution.listMeasurements(profileId),
          evolution.listMilestones(profileId),
          evolution.listSleep(profileId, selectedDate),
          evolution.listSleep(profileId),
          evolution.listHabits(profileId, true),
          evolution.listHabitLogs(profileId, selectedDate),
        ])
          .then(([weights, measurements, milestones, daySleep, allSleep, habits, dayHabitLogs]) => {
            if (active) {
              setData({
                key: queryKey,
                date: selectedDate,
                weights,
                measurements,
                milestones,
                daySleep,
                allSleep,
                habits,
                dayHabitLogs,
              });
            }
          })
          .catch(() => {
            if (active) setError(true);
          });
      }
      return () => {
        active = false;
      };
    }, [evolution, profileId, selectedDate, queryKey]),
  );

  return {
    ...app,
    data: data?.date === selectedDate && !error ? data : null,
    refreshing: data?.key !== queryKey,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function useCalendarMonth(yearMonth: string) {
  const app = useApp();
  const { evolution, snapshot, revision } = app;
  const [activity, setActivity] = useState<{ key: string; map: MonthActivityMap } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profileId = snapshot?.profile.id;
  const queryKey = `${profileId}:${yearMonth}:${revision}:${attempt}`;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(false);
      if (evolution && profileId && yearMonth) {
        const { startDate, endDate } = monthRange(yearMonth);
        void evolution
          .monthActivity(profileId, startDate, endDate)
          .then((map) => {
            if (active) setActivity({ key: queryKey, map });
          })
          .catch(() => {
            if (active) setError(true);
          });
      }
      return () => {
        active = false;
      };
    }, [evolution, profileId, yearMonth, queryKey]),
  );

  return {
    ...app,
    map: !error && activity ? activity.map : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function usePeriodReview(startDate: string, endDate: string, weekKey: string) {
  const app = useApp();
  const { evolution, snapshot, revision } = app;
  const [data, setData] = useState<{
    key: string;
    report: PeriodReportInput;
    review: WeeklyReview | null;
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profileId = snapshot?.profile.id;
  const visibility = snapshot?.preferences.visibility;
  const queryKey = `${profileId}:${startDate}:${endDate}:${weekKey}:${revision}:${attempt}`;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(false);
      if (evolution && profileId && visibility) {
        void Promise.all([
          evolution.periodReport(profileId, startDate, endDate, visibility),
          evolution.getWeeklyReview(profileId, weekKey),
        ])
          .then(([report, review]) => {
            if (active) setData({ key: queryKey, report, review });
          })
          .catch(() => {
            if (active) setError(true);
          });
      }
      return () => {
        active = false;
      };
    }, [evolution, profileId, startDate, endDate, weekKey, visibility, queryKey]),
  );

  return {
    ...app,
    data: !error && data?.key === queryKey ? data : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
