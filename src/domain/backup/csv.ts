export type CsvModule =
  | 'nutrition'
  | 'hydration'
  | 'training'
  | 'cardio'
  | 'weight'
  | 'measurements'
  | 'sleep'
  | 'habits';

export const csvModuleLabels: Record<CsvModule, string> = {
  nutrition: 'Alimentação (refeições e itens)',
  hydration: 'Hidratação e bebidas',
  training: 'Musculação (sessões e séries)',
  cardio: 'Cardio e atividade',
  weight: 'Peso corporal',
  measurements: 'Medidas corporais',
  sleep: 'Sono e cochilos',
  habits: 'Hábitos e registros',
};

export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapa célula conforme RFC 4180 e mitiga injeção de fórmulas em planilhas
 * para campos textuais controlados pelo usuário.
 */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'sim' : 'nao';
  }
  let text = String(value);
  if (FORMULA_PREFIX.test(text) || FORMULA_PREFIX.test(text.trimStart())) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
