import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Typography } from "./Typography";
import { formatCurrency } from "@/utils/formatters";
import { colors } from "../../../tailwind.config";

export interface PieChartDataItem {
  id: string;
  label: string;
  value: number;
  color: string;
  icon?: string;
  percentage?: number;
}

interface PieChartProps {
  data: PieChartDataItem[];
  size?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  allowToggleMode?: boolean;
  onSelectItem?: (item: PieChartDataItem | null) => void;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  // Si la porción abarca prácticamente los 360 grados, se divide en 2 para evitar colapso del arco SVG
  if (sweep >= 359.9) {
    const half1 = describeDonutSlice(
      cx,
      cy,
      outerRadius,
      innerRadius,
      startAngle,
      startAngle + 180,
    );
    const half2 = describeDonutSlice(
      cx,
      cy,
      outerRadius,
      innerRadius,
      startAngle + 180,
      endAngle,
    );
    return `${half1} ${half2}`;
  }

  const startOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = sweep <= 180 ? 0 : 1;

  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function describePieSlice(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.9) {
    const half1 = describePieSlice(cx, cy, radius, startAngle, startAngle + 180);
    const half2 = describePieSlice(cx, cy, radius, startAngle + 180, endAngle);
    return `${half1} ${half2}`;
  }

  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = sweep <= 180 ? 0 : 1;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function PieChart({
  data,
  size = 230,
  centerTitle = "Total",
  centerSubtitle,
  allowToggleMode = true,
  onSelectItem,
}: PieChartProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDonut, setIsDonut] = useState(true);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const center = size / 2;
  const outerRadius = size * 0.44;
  const innerRadius = isDonut ? size * 0.28 : 0;

  const handlePressItem = (item: PieChartDataItem) => {
    const nextId = selectedId === item.id ? null : item.id;
    setSelectedId(nextId);
    if (onSelectItem) {
      onSelectItem(nextId ? item : null);
    }
  };

  const selectedItem = data.find((d) => d.id === selectedId);

  // Genera porciones con ángulos acumulados de forma inmutable
  const slices = data
    .filter((d) => d.value > 0)
    .reduce<
      (PieChartDataItem & {
        startAngle: number;
        endAngle: number;
        pathData: string;
        isSelected: boolean;
        calculatedPercentage: number;
      })[]
    >((acc, item) => {
      const fraction = total > 0 ? item.value / total : 0;
      const angle = fraction * 360;
      const lastSlice = acc[acc.length - 1];
      const startAngle = lastSlice ? lastSlice.endAngle : 0;
      const endAngle = startAngle + angle;

      const isSelected = selectedId === item.id;
      const rOuter = isSelected ? outerRadius + 4 : outerRadius;
      const rInner = isDonut ? (isSelected ? innerRadius - 2 : innerRadius) : 0;

      const pathData = isDonut
        ? describeDonutSlice(center, center, rOuter, rInner, startAngle, endAngle)
        : describePieSlice(center, center, rOuter, startAngle, endAngle);

      acc.push({
        ...item,
        startAngle,
        endAngle,
        pathData,
        isSelected,
        calculatedPercentage: fraction * 100,
      });

      return acc;
    }, []);

  if (total === 0 || data.length === 0) {
    return (
      <View className="items-center py-6">
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={outerRadius}
            stroke={colors.surface[600]}
            strokeWidth={isDonut ? 16 : 2}
            fill={isDonut ? "transparent" : colors.surface[700]}
            strokeDasharray="6,6"
          />
        </Svg>
        <Typography variant="caption" muted className="mt-3">
          Sin datos para graficar
        </Typography>
      </View>
    );
  }

  return (
    <View className="items-center w-full">
      {/* Switcher Dona / Torta si está habilitado */}
      {allowToggleMode && (
        <View className="flex-row items-center self-end mb-2 bg-surface-700/60 p-1 rounded-xl">
          <Pressable
            onPress={() => setIsDonut(true)}
            className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 ${
              isDonut ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="circle-slice-8"
              size={13}
              color={isDonut ? colors.primary[500] : colors.text.muted}
            />
            <Typography
              className={`text-xs font-semibold ${
                isDonut ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Dona
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setIsDonut(false)}
            className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 ${
              !isDonut ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="chart-pie"
              size={13}
              color={!isDonut ? colors.primary[500] : colors.text.muted}
            />
            <Typography
              className={`text-xs font-semibold ${
                !isDonut ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Torta
            </Typography>
          </Pressable>
        </View>
      )}

      {/* SVG del Gráfico de Torta / Dona */}
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center relative"
      >
        <Svg width={size} height={size}>
          <G>
            {slices.map((slice) => (
              <Path
                key={slice.id}
                d={slice.pathData}
                fill={slice.color}
                opacity={selectedId ? (slice.isSelected ? 1 : 0.45) : 0.95}
                stroke={colors.surface[800]}
                strokeWidth={1.5}
                onPress={() => handlePressItem(slice)}
              />
            ))}
          </G>
        </Svg>

        {/* Centro de la dona (indicador interactivo) */}
        {isDonut && (
          <View
            pointerEvents="box-none"
            style={{
              width: innerRadius * 2,
              height: innerRadius * 2,
            }}
            className="absolute rounded-full items-center justify-center p-2"
          >
            {selectedItem ? (
              <View className="items-center">
                <Typography
                  numberOfLines={1}
                  className="text-xs font-medium text-text-secondary text-center"
                >
                  {selectedItem.label}
                </Typography>
                <Typography className="text-sm font-bold text-text-primary text-center">
                  {formatCurrency(selectedItem.value)}
                </Typography>
                <View
                  className="px-2 py-0.5 rounded-full mt-1"
                  style={{ backgroundColor: `${selectedItem.color}25` }}
                >
                  <Typography
                    className="text-[11px] font-bold"
                    style={{ color: selectedItem.color }}
                  >
                    {(selectedItem.percentage ??
                      (selectedItem.value / total) * 100
                    ).toFixed(1)}
                    %
                  </Typography>
                </View>
              </View>
            ) : (
              <View className="items-center">
                <Typography variant="caption" muted className="text-[11px]">
                  {centerTitle}
                </Typography>
                <Typography className="text-sm font-bold text-text-primary text-center">
                  {centerSubtitle || formatCurrency(total)}
                </Typography>
                <Typography
                  variant="caption"
                  muted
                  className="text-[10px] mt-0.5"
                >
                  {data.length} {data.length === 1 ? "rubro" : "rubros"}
                </Typography>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Leyenda interactiva rápida */}
      <View className="flex-row flex-wrap justify-center gap-2 mt-4 px-2">
        {data.slice(0, 6).map((item) => {
          const isSelected = selectedId === item.id;
          const pct = (
            item.percentage ??
            (total > 0 ? (item.value / total) * 100 : 0)
          ).toFixed(1);
          return (
            <Pressable
              key={item.id}
              onPress={() => handlePressItem(item)}
              className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                isSelected
                  ? "bg-surface-700 border-primary-500 shadow-sm"
                  : "bg-surface-800/80 border-surface-600/60"
              }`}
            >
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <Typography className="text-xs text-text-primary font-medium">
                {item.label}
              </Typography>
              <Typography variant="caption" muted className="text-[11px]">
                {pct}%
              </Typography>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
