"use client";

import type { ReactElement } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BanditResult } from "@/lib/types";

const C = {
  blue: "#007A92", // teal (primary)
  emerald: "#006B34", // green (positive)
  amber: "#B25100", // warning
  rose: "#D3003B", // coral (risk)
  slate: "#C7C2C3", // neutral comparison bar
  axis: "#696365",
};

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E0DEDF",
  borderRadius: 8,
  fontSize: 12,
  color: "#302D2E",
  boxShadow: "0 4px 8px rgba(0,0,0,.06)",
};

/**
 * Recharts renders bare SVG with no accessible name, and its tooltips are pointer-only —
 * so a screen-reader user gets nothing at all. Wrap every chart in a labelled figure that
 * states the finding in words, and hide the decorative SVG beneath it.
 */
function ChartFigure({ label, height, children }: { label: string; height: number; children: ReactElement }) {
  return (
    <figure className="m-0" role="img" aria-label={label}>
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/**
 * Treatment vs holdout conversion (the evidence behind a lift).
 *
 * Both rates arrive in PERCENT units (e.g. `13.07` for 13.07%) — see the unit conventions
 * in `lib/format.ts`. Do NOT multiply by 100 here; doing so is what once rendered
 * "1306.8% vs 1299.9%" and flattened a 2.1x effect into two identical bars.
 */
export function TreatmentControlBar({ treatmentRate, controlRate }: { treatmentRate: number; controlRate: number }) {
  const data = [
    { name: "Holdout", rate: controlRate, fill: C.slate },
    { name: "Treatment", rate: treatmentRate, fill: C.emerald },
  ];
  return (
    <ChartFigure
      height={160}
      label={`Conversion rate: treatment ${treatmentRate.toFixed(1)} percent, holdout ${controlRate.toFixed(1)} percent.`}
    >
      <BarChart data={data} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#8F8A8B", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E0DEDF" }} />
        {/* width fits a three-digit tick ("100%") without clipping the leading digit */}
        <YAxis tick={{ fill: "#696365", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={48} />
        <Tooltip cursor={{ fill: "#0000000a" }} contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "conversion"]} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={64} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
          <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#4B494A" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartFigure>
  );
}

/** Bandit vs baselines — conversion rate by strategy. Rates arrive as FRACTIONS. */
export function BanditChart({ bandit }: { bandit: BanditResult }) {
  const data = [
    { name: "Random", rate: bandit.randomRate * 100, fill: C.slate },
    { name: "Human", rate: bandit.globalBestRate * 100, fill: C.amber },
    { name: "Bandit", rate: bandit.banditRate * 100, fill: C.emerald },
    { name: "Oracle", rate: bandit.oracleRate * 100, fill: C.blue },
  ];
  return (
    <ChartFigure
      height={170}
      label={`Conversion rate by strategy: ${data.map((d) => `${d.name} ${d.rate.toFixed(1)} percent`).join(", ")}.`}
    >
      <BarChart data={data} margin={{ left: 0, right: 12, top: 14, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#8F8A8B", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E0DEDF" }} />
        <YAxis tick={{ fill: "#696365", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={48} />
        <Tooltip cursor={{ fill: "#0000000a" }} contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "conversion"]} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={48} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
          <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#4B494A" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartFigure>
  );
}
