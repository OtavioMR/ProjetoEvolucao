import type { SetupInput } from '../domain/profile/profile.ts';

/** Dados exclusivamente sintéticos. Não importar em produção. */
export function syntheticSetup(): SetupInput {
  return {
    profile: {
      displayName: 'Pessoa de teste',
      ageAtSetup: null,
      heightCm: null,
      referenceWeightKg: null,
      targetWeightKg: null,
      timezone: 'America/Sao_Paulo',
    },
    preferences: {
      theme: 'dark',
      locale: 'pt-BR',
      visibility: {
        calories: false,
        macros: false,
        weight: false,
        measurements: true,
        sleep: true,
      },
      quickWaterAmounts: [250, 500],
      meals: [{ name: 'Refeição teste', time: '12:00' }],
      availableDays: [1, 3, 5],
      weekStart: 1,
      trainingTime: '10:00',
      sleepStart: '00:30',
      sleepEnd: '08:30',
    },
    goals: {
      water: 2000,
      energy: null,
      protein: null,
      carbs: null,
      fat: null,
      sleep: 8,
      cardio: null,
    },
  };
}
