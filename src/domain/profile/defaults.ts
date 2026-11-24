import { privateOnboardingPreset } from '../../generated/private-onboarding';
import { setupSchema, type SetupInput } from './profile';

const neutral: SetupInput = {
  profile: {
    displayName: 'Meu perfil',
    ageAtSetup: null,
    heightCm: null,
    referenceWeightKg: null,
    targetWeightKg: null,
    timezone: 'America/Sao_Paulo',
  },
  preferences: {
    theme: 'dark',
    locale: 'pt-BR',
    visibility: { calories: false, macros: false, weight: true, measurements: true, sleep: true },
    quickWaterAmounts: [250, 500],
    meals: [
      { name: 'Café da manhã', time: '09:00' },
      { name: 'Almoço', time: '12:00' },
      { name: 'Lanche', time: '15:30' },
      { name: 'Jantar', time: '17:15' },
      { name: 'Ceia', time: '22:30' },
      { name: 'Outras', time: '12:00' },
    ],
    availableDays: [1, 3, 5],
    weekStart: 1,
    trainingTime: '10:00',
    sleepStart: '00:30',
    sleepEnd: '08:30',
  },
  goals: {
    water: null,
    energy: null,
    protein: null,
    carbs: null,
    fat: null,
    sleep: null,
    cardio: null,
  },
};

export function onboardingDefaults(): SetupInput {
  const preset = setupSchema.safeParse(privateOnboardingPreset);
  return setupSchema.parse(preset.success ? preset.data : neutral);
}
