import { useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { SimulationJob } from "../lib/api";
import { downloadChartSvg, downloadCsv } from "../lib/utils";

type PlotSeries = {
  key: string;
  label: string;
  color: string;
  fill: string;
  unit: string;
};

export function PlotCard({
  jobName,
  metrics,
  series,
  stageFilter,
}: {
  jobName: string;
  metrics: SimulationJob["metrics"];
  series: PlotSeries;
  stageFilter: string;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(`${series.label} Trace`);
  const [scaleMode, setScaleMode] = useState("auto");
  const [styleMode, setStyleMode] = useState("area");
  const [showGrid, setShowGrid] = useState(true);
  const [showPoints, setShowPoints] = useState(false);
  const [showEqLine, setShowEqLine] = useState(false);
  const [color, setColor] = useState(series.color);
  const [exportBg, setExportBg] = useState("transparent");
  const xKey = metrics.some((metric) => Number.isFinite(Number(metric.timePs)))
    ? "timePs"
    : metrics.some((metric) => Number.isFinite(Number(metric.sample)))
      ? "sample"
      : "progress";
  const xLabel =
    xKey === "timePs"
      ? "Time (ps)"
      : xKey === "sample"
        ? "Sample"
        : "Progress (%)";
  const chartData: SimulationJob["metrics"] = metrics
    .filter((metric) => Number.isFinite(Number(metric[series.key])))
    .map((metric, index) => ({
      ...metric,
      sample: metric.sample ?? index + 1,
    }));
  const values = chartData
    .map((metric) => Number(metric[series.key]))
    .filter((value) => Number.isFinite(value));
  const latest = values.length ? values[values.length - 1] : null;
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const mean = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
  const yDomain: [number | string, number | string] =
    scaleMode === "zero"
      ? [0, "auto"]
      : scaleMode === "tight" && min !== null && max !== null
        ? [Math.floor(min), Math.ceil(max)]
        : ["auto", "auto"];
  const palette = [
    "#0891b2",
    "#10b981",
    "#f59e0b",
    "#7c3aed",
    "#ef4444",
    "#334155",
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <input
            className="mb-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label={`${series.label} plot title`}
          />
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
              stage: {stageFilter}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
              points: {chartData.length}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
              latest:{" "}
              {latest === null ? "n/a" : `${latest.toFixed(2)} ${series.unit}`}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
              range:{" "}
              {min === null || max === null
                ? "n/a"
                : `${min.toFixed(2)}-${max.toFixed(2)}`}
            </span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 2xl:min-w-[360px]">
          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {["area", "line"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStyleMode(mode)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold ${
                  styleMode === mode
                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800 h-9"
            value={scaleMode}
            onChange={(event) => setScaleMode(event.target.value)}
            aria-label={`${series.label} y scale`}
          >
            <option value="auto">auto scale</option>
            <option value="tight">tight scale</option>
            <option value="zero">zero baseline</option>
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className={`h-5 w-5 rounded-full border-2 ${
                  color === swatch
                    ? "border-slate-900 dark:border-white"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: swatch }}
                aria-label={`Use ${swatch}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowGrid((value) => !value)}
              className={`rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 h-9 flex-1 ${
                showGrid
                  ? "border-ocean-400 text-ocean-700 dark:border-ocean-500 dark:text-ocean-400"
                  : ""
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setShowPoints((value) => !value)}
              className={`rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 h-9 flex-1 ${
                showPoints
                  ? "border-ocean-400 text-ocean-700 dark:border-ocean-500 dark:text-ocean-400"
                  : ""
              }`}
            >
              Points
            </button>
            <button
              type="button"
              onClick={() => setShowEqLine((value) => !value)}
              className={`rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 h-9 flex-1 whitespace-nowrap ${
                showEqLine
                  ? "border-ocean-400 text-ocean-700 dark:border-ocean-500 dark:text-ocean-400"
                  : ""
              }`}
            >
              Eq Line
            </button>
          </div>
        </div>
      </div>
      <div
        ref={chartRef}
        className={`h-72 rounded-lg border border-slate-100 p-2 dark:border-slate-800 transition-colors ${
          exportBg === "transparent" ? "bg-white dark:bg-slate-950" : ""
        }`}
        style={{
          backgroundColor: exportBg === "transparent" ? undefined : exportBg,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 35, left: 55 }}
          >
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            )}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -20,
                fontSize: 12,
                style: { textAnchor: "middle" },
              }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={yDomain as any}
              label={{
                value: `${series.label} (${series.unit})`,
                angle: -90,
                position: "insideLeft",
                offset: -35,
                fontSize: 12,
                style: { textAnchor: "middle" },
              }}
            />
            <Tooltip
              formatter={(value) => [
                `${Number(value).toFixed(3)} ${series.unit}`,
                title,
              ]}
              labelFormatter={(label) => `${xLabel}: ${label}`}
            />
            {showEqLine && mean !== null && (
              <ReferenceLine
                y={mean}
                stroke={color}
                strokeDasharray="3 3"
                opacity={0.7}
                label={{
                  position: "insideTopLeft",
                  value: `Avg: ${mean.toFixed(2)}`,
                  fill: color,
                  fontSize: 11,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={series.key}
              stroke={color}
              fill={color}
              fillOpacity={styleMode === "area" ? 0.18 : 0}
              strokeWidth={2.4}
              dot={showPoints ? { r: 2.5 } : false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2 items-center">
        <div className="mr-auto text-xs text-slate-500 dark:text-slate-400">
          Source: {stageFilter}-metrics.csv
        </div>
        <select
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
          value={exportBg}
          onChange={(e: any) => setExportBg(e.target.value)}
          aria-label="Export background color"
        >
          <option value="transparent">Transparent Bg</option>
          <option value="#ffffff">White Bg</option>
          <option value="#0f172a">Dark Bg</option>
        </select>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          onClick={() =>
            downloadCsv(
              `${jobName}-${series.key}-${stageFilter}.csv`,
              chartData,
              series.key,
            )
          }
        >
          Export CSV
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          onClick={() =>
            downloadChartSvg(
              `${jobName}-${series.key}-${stageFilter}.svg`,
              chartRef.current,
              exportBg,
              title
            )
          }
        >
          Export SVG
        </button>
      </div>
    </div>
  );
}
