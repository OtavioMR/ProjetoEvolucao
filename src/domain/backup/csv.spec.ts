import { buildCsv, escapeCsvCell } from './csv';

describe('csv export', () => {
  it('escapa células RFC 4180 e mitiga injeção de fórmulas em textos', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(escapeCsvCell('-cmd|calc')).toBe("'-cmd|calc");
    expect(escapeCsvCell('@IMPORTXML')).toBe("'@IMPORTXML");
    expect(escapeCsvCell('\t=HYPERLINK()')).toBe("'\t=HYPERLINK()");
    expect(escapeCsvCell('  =1+1')).toBe("'  =1+1");
    expect(escapeCsvCell('Arroz, "cozido"')).toBe('"Arroz, ""cozido"""');
    expect(escapeCsvCell('Linha 1\nLinha 2')).toBe('"Linha 1\nLinha 2"');
  });

  it('preserva números negativos reais e nulos sem prefixo indevido', () => {
    expect(escapeCsvCell(-4.5)).toBe('-4.5');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(Number.NaN)).toBe('');
  });

  it('gera CSV UTF-8 com BOM e CRLF', () => {
    const csv = buildCsv(['data_local', 'peso_kg', 'observacoes'], [['2026-04-08', 85.5, 'Jejum']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFdata_local,peso_kg,observacoes\r\n2026-04-08,85.5,Jejum\r\n');
  });
});
