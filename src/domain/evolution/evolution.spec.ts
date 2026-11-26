import {
  computeBmi,
  computeSleepInstants,
  dailyWeightSeries,
  formatReportMarkdown,
  habitStateForDate,
  mergeUtcIntervalsMinutes,
  monthGridDates,
  rollingAverage,
  splitSeriesWithGaps,
  summarizeSleepDay,
  weekRangeForDate,
  weightChangeFromReference,
  type SleepEntry,
  type WeightEntry,
} from './evolution.ts';

const baseWeight = (
  id: string,
  localDate: string,
  occurredAt: string,
  weightKg: number,
): WeightEntry => ({
  id,
  localDate,
  occurredAt,
  timezoneAtEntry: 'America/Sao_Paulo',
  weightKg,
  notes: '',
});

describe('Domínio de evolução', () => {
  it('seleciona a última pesagem do dia, calcula -4,5 kg / 5% e IMC', () => {
    const entries: WeightEntry[] = [
      baseWeight(
        '00000000-0000-4000-8000-000000000001',
        '2026-04-08',
        '2026-04-08T10:00:00.000Z',
        86.2,
      ),
      baseWeight(
        '00000000-0000-4000-8000-000000000002',
        '2026-04-08',
        '2026-04-08T22:00:00.000Z',
        85.5,
      ),
    ];
    const series = dailyWeightSeries(entries);
    expect(series).toHaveLength(1);
    expect(series[0]?.value).toBe(85.5);

    const change = weightChangeFromReference(85.5, 90);
    expect(change).toEqual({ deltaKg: -4.5, reductionKg: 4.5, reductionPct: 5 });
    expect(computeBmi(90, 170)).toBe(31.1);
  });

  it('calcula médias excluindo dias ausentes e retorna null sem dados', () => {
    expect(rollingAverage([], '2026-04-08', 7)).toEqual({
      average: null,
      count: 0,
      totalDays: 7,
    });
    const series = dailyWeightSeries([
      baseWeight(
        '00000000-0000-4000-8000-000000000001',
        '2026-04-02',
        '2026-04-02T12:00:00.000Z',
        90,
      ),
      baseWeight(
        '00000000-0000-4000-8000-000000000002',
        '2026-04-08',
        '2026-04-08T12:00:00.000Z',
        88,
      ),
    ]);
    expect(rollingAverage(series, '2026-04-08', 7)).toEqual({
      average: 89,
      count: 2,
      totalDays: 7,
    });
    expect(splitSeriesWithGaps(series, 3)).toHaveLength(2);
  });

  it('calcula sono de 23h30 às 07h30 como 8 h e une intervalos sobrepostos sem duplicar', () => {
    const { startAt, endAt } = computeSleepInstants(
      '2026-04-08',
      '23:30',
      '07:30',
      'America/Sao_Paulo',
    );
    const main: SleepEntry = {
      id: '00000000-0000-4000-8000-000000000010',
      startAt,
      endAt,
      wakeLocalDate: '2026-04-08',
      timezoneAtEntry: 'America/Sao_Paulo',
      isNap: false,
      quality: 4,
      notes: '',
    };
    const overlap = computeSleepInstants('2026-04-08', '06:30', '08:30', 'America/Sao_Paulo');
    const second: SleepEntry = {
      ...main,
      id: '00000000-0000-4000-8000-000000000011',
      startAt: overlap.startAt,
      endAt: overlap.endAt,
      quality: 5,
    };
    const nap = computeSleepInstants('2026-04-08', '14:00', '14:30', 'America/Sao_Paulo');
    const napEntry: SleepEntry = {
      ...main,
      id: '00000000-0000-4000-8000-000000000012',
      startAt: nap.startAt,
      endAt: nap.endAt,
      isNap: true,
      quality: null,
    };

    expect(mergeUtcIntervalsMinutes([main])).toBe(480);
    const summary = summarizeSleepDay([main, second, napEntry]);
    expect(summary.mainMinutes).toBe(540);
    expect(summary.napMinutes).toBe(30);
    expect(summary.totalMinutes).toBe(570);
    expect(summary.averageQuality).toBe(4.5);
  });

  it('controla estados de hábito, grade semanal/mensal e resumo copiável selecionável', () => {
    expect(habitStateForDate(undefined)).toBe('unrecorded');
    expect(
      habitStateForDate({
        id: '00000000-0000-4000-8000-000000000020',
        habitId: '00000000-0000-4000-8000-000000000021',
        localDate: '2026-04-08',
        status: 'not_applicable',
        notes: '',
      }),
    ).toBe('not_applicable');

    const week = weekRangeForDate('2026-04-08', 1);
    expect(week.weekStartDate).toBe('2026-04-06');
    expect(week.weekEndDate).toBe('2026-04-12');
    expect(monthGridDates('2026-04', 1).length % 7).toBe(0);

    const md = formatReportMarkdown(
      {
        startDate: '2026-04-06',
        endDate: '2026-04-12',
        totalDays: 7,
        daysWithAnyData: 3,
        completedWorkouts: 2,
        plannedWorkouts: 3,
        cardioMinutes: 45,
        weightAvgKg: 85.5,
        weightDays: 2,
        waistAvgCm: null,
        waistDays: 0,
        waterAvgMl: 2100,
        waterDays: 3,
        mealDays: 3,
        energyAvgKcal: null,
        energyCompleteDays: 0,
        proteinAvgG: null,
        proteinCompleteDays: 0,
        sleepAvgMinutes: 480,
        sleepDays: 2,
        topMealContexts: [{ context: 'rotina', count: 2 }],
      },
      null,
      {
        weight: false,
        measurements: false,
        nutrition: true,
        hydration: true,
        training: true,
        sleep: true,
        notes: false,
      },
    );
    expect(md).not.toContain('Peso médio');
    expect(md).toContain('Treinos concluídos: 2');
    expect(md).toContain('Sono médio: 8 h');
  });
});
