import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { splitSeriesWithGaps, type DailySeriesPoint } from '../../domain/evolution/evolution';
import { Button, Txt } from '../../shared/components/ui';
import { useTheme } from '../../shared/theme/theme';

export function TrendChart({
  points,
  unit,
  referenceLines = [],
}: {
  points: DailySeriesPoint[];
  unit: string;
  referenceLines?: { label: string; value: number }[];
}) {
  const { colors } = useTheme();
  const [showText, setShowText] = useState(false);

  if (points.length === 0) {
    return (
      <Txt kind="muted">
        Sem registros neste período. Os gráficos permanecem vazios até haver dados reais.
      </Txt>
    );
  }

  const values = [...points.map((p) => p.value), ...referenceLines.map((r) => r.value)];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = rawMax === rawMin ? 1 : (rawMax - rawMin) * 0.15;
  const minVal = rawMin - pad;
  const maxVal = rawMax + pad;

  const width = 300;
  const height = 140;
  const padX = 18;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const firstTs = Date.parse(`${points[0]!.localDate}T12:00:00Z`);
  const lastTs = Date.parse(`${points[points.length - 1]!.localDate}T12:00:00Z`);
  const spanTs = Math.max(lastTs - firstTs, 86400000);

  const toX = (date: string) =>
    points.length === 1
      ? width / 2
      : padX + ((Date.parse(`${date}T12:00:00Z`) - firstTs) / spanTs) * innerW;
  const toY = (val: number) => padY + innerH - ((val - minVal) / (maxVal - minVal || 1)) * innerH;

  const segments = splitSeriesWithGaps(points, 3);
  const latest = points[points.length - 1]!;
  const summaryLabel = `Gráfico com ${points.length} registro(s). Mínimo ${Math.min(...points.map((p) => p.value)).toLocaleString('pt-BR')} ${unit}, máximo ${Math.max(...points.map((p) => p.value)).toLocaleString('pt-BR')} ${unit}, último ${latest.value.toLocaleString('pt-BR')} ${unit} em ${latest.localDate}.`;

  return (
    <View style={{ gap: 10 }}>
      <View
        accessible
        accessibilityLabel={summaryLabel}
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 8,
          alignItems: 'center',
        }}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {referenceLines.map((ref) => {
            const y = toY(ref.value);
            return (
              <Line
                key={ref.label}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke={colors.border}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            );
          })}
          {segments.map((seg, idx) =>
            seg.length > 1 ? (
              <Polyline
                key={idx}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2.5}
                points={seg.map((pt) => `${toX(pt.localDate)},${toY(pt.value)}`).join(' ')}
              />
            ) : null,
          )}
          {points.map((pt) => (
            <Circle
              key={pt.entryId}
              cx={toX(pt.localDate)}
              cy={toY(pt.value)}
              r={4}
              fill={colors.accent}
            />
          ))}
          <SvgText x={padX} y={12} fontSize={10} fill={colors.secondary}>
            {`${Math.max(...points.map((p) => p.value)).toLocaleString('pt-BR')} ${unit}`}
          </SvgText>
          <SvgText x={padX} y={height - 4} fontSize={10} fill={colors.secondary}>
            {`${Math.min(...points.map((p) => p.value)).toLocaleString('pt-BR')} ${unit}`}
          </SvgText>
        </Svg>
      </View>
      <Txt kind="muted">
        Lacunas maiores que 3 dias não são ligadas por linha contínua; apenas dias com registro real
        são exibidos.
      </Txt>
      <Button
        secondary
        title={showText ? 'Ocultar alternativa textual' : 'Ver alternativa textual'}
        onPress={() => setShowText((v) => !v)}
      />
      {showText ? (
        <View style={{ gap: 4 }}>
          {[...points].reverse().map((pt) => (
            <Txt key={pt.entryId} kind="muted">
              {pt.localDate}: {pt.value.toLocaleString('pt-BR')} {unit}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}
