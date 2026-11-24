import { localDateAt, isLocalDate } from '../../core/date-time/local-date';
import { syntheticSetup } from '../../test/fixtures';
import { parseOptionalNumber, setupSchema, unusualProfileValues } from './profile';

describe('perfil e datas', () => {
  it('permite começar sem idade ou medidas opcionais', () => {
    expect(setupSchema.safeParse(syntheticSetup()).success).toBe(true);
  });
  it('entende decimal pt-BR, separa vazio de zero e recusa ambiguidades', () => {
    expect(parseOptionalNumber('85,50')).toBe(85.5);
    expect(parseOptionalNumber('')).toBeNull();
    expect(parseOptionalNumber('0')).toBe(0);
    expect(parseOptionalNumber('1.000,5')).toBeNaN();
    expect(parseOptionalNumber('1e2')).toBeNaN();
  });
  it.each([NaN, Infinity, -1, 0])('recusa medida inválida %s', (heightCm) => {
    const data = syntheticSetup();
    data.profile.heightCm = heightCm;
    expect(setupSchema.safeParse(data).success).toBe(false);
  });
  it('pede revisão de valor atípico sem proibir medida humana', () => {
    const data = syntheticSetup();
    data.profile.heightCm = 245;
    expect(setupSchema.safeParse(data).success).toBe(true);
    expect(unusualProfileValues(data.profile)).toBe(true);
  });
  it('valida horário, volumes inteiros e fuso', () => {
    const data = syntheticSetup();
    data.preferences.sleepEnd = '25:70';
    expect(setupSchema.safeParse(data).success).toBe(false);
    data.preferences.sleepEnd = '08:00';
    data.preferences.quickWaterAmounts = [0, 2.5];
    expect(setupSchema.safeParse(data).success).toBe(false);
    data.preferences.quickWaterAmounts = [250];
    data.profile.timezone = 'Invalid/Test';
    expect(setupSchema.safeParse(data).success).toBe(false);
  });
  it('às 23h50 em São Paulo mantém data civil, mesmo com UTC no dia seguinte', () => {
    expect(localDateAt(new Date('2026-04-08T02:50:00Z'), 'America/Sao_Paulo')).toBe('2026-04-07');
    expect(localDateAt(new Date('2026-04-08T02:50:00Z'), 'Asia/Tokyo')).toBe('2026-04-08');
  });
  it('valida calendário real e ano bissexto', () => {
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-2-3')).toBe(false);
  });
});
