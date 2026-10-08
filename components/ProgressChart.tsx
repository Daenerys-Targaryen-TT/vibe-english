"use client";

import * as React from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface StackedBarPoint {
  label: string;
  typing: number;
  reading: number;
  writing: number;
  translation: number;
}

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export function LineChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart />;
  }
  const w = 600;
  const h = 220;
  const padX = 40;
  const padY = 24;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (w - padX * 2) / Math.max(1, data.length - 1);
  const px = (i: number) => padX + i * stepX;
  const py = (v: number) => h - padY - (v / max) * (h - padY * 2);

  const points = data.map((d, i) => `${px(i)},${py(d.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} className="stroke-border" strokeWidth="1" />
      <line x1={padX} y1={padY} x2={padX} y2={h - padY} className="stroke-border" strokeWidth="1" />
      <polyline points={points} fill="none" stroke={COLORS[0]} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(d.value)} r="3" fill={COLORS[0]} />
          {(data.length <= 12 || i % Math.ceil(data.length / 8) === 0) && (
            <text x={px(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({ data }: { data: StackedBarPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart />;
  }
  const w = 600;
  const h = 240;
  const padX = 30;
  const padY = 24;
  const max = Math.max(
    ...data.map((d) => d.typing + d.reading + d.writing + d.translation),
    1
  );
  const barW = Math.min(40, (w - padX * 2) / data.length - 8);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} className="stroke-border" strokeWidth="1" />
      {data.map((d, i) => {
        const x = padX + i * ((w - padX * 2) / data.length) + ((w - padX * 2) / data.length - barW) / 2;
        let y = h - padY;
        const segs = [
          { k: "typing" as const, c: COLORS[0] },
          { k: "reading" as const, c: COLORS[1] },
          { k: "writing" as const, c: COLORS[2] },
          { k: "translation" as const, c: COLORS[3] },
        ];
        return (
          <g key={i}>
            {segs.map((s) => {
              const val = d[s.k];
              if (val <= 0) return null;
              const segH = (val / max) * (h - padY * 2);
              const rectY = y - segH;
              y = rectY;
              return (
                <rect
                  key={s.k}
                  x={x}
                  y={rectY}
                  width={barW}
                  height={segH}
                  fill={s.c}
                />
              );
            })}
            {(data.length <= 10 || i % Math.ceil(data.length / 8) === 0) && (
              <text x={x + barW / 2} y={h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <EmptyChart />;
  }
  const size = 200;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44">
        <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-border" strokeWidth="20" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circumference;
          const seg = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return seg;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground" fontSize="20" fontWeight="bold">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground" fontSize="11">
          总时长(分)
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span>{d.label}</span>
            <span className="text-muted-foreground">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      暂无数据，先去练习吧！
    </div>
  );
}
