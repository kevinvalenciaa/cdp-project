"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BanditResult, Opportunity } from "@/lib/types";
import { moneyCompact, monthlyImpact } from "@/lib/format";

const C = {
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#475569",
  axis: "#64748b",
};

const tooltipStyle = {
  background: "#0b1220",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

/** Horizontal ranking of accepted opportunities by estimated monthly impact. */
export function RankingBar({ opportunities }: { opportunities: Opportunity[] }) {
  const data = opportunities.map((o) => ({ name: o.title, impact: Math.round(monthlyImpact(o)) }));
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 56)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={200}
          tick={{ fill: "#cbd5e1", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "#1e293b55" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [`${moneyCompact(Number(v))}/mo`, "est. impact"]}
        />
        <Bar dataKey="impact" fill={C.blue} radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
          <LabelList dataKey="impact" position="right" formatter={(v) => `${moneyCompact(Number(v))}/mo`} fill="#94a3b8" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Treatment vs control conversion (the evidence behind a lift). */
export function TreatmentControlBar({ treatmentRate, controlRate }: { treatmentRate: number; controlRate: number }) {
  const data = [
    { name: "Control", rate: controlRate * 100, fill: C.slate },
    { name: "Treatment", rate: treatmentRate * 100, fill: C.emerald },
  ];
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#1e293b" }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={36} />
        <Tooltip cursor={{ fill: "#1e293b55" }} contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "conversion"]} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={64} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
          <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#cbd5e1" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Bandit vs baselines — conversion rate by strategy. */
export function BanditChart({ bandit }: { bandit: BanditResult }) {
  const data = [
    { name: "Random", rate: bandit.randomRate * 100, fill: C.slate },
    { name: "Human", rate: bandit.globalBestRate * 100, fill: C.amber },
    { name: "Bandit", rate: bandit.banditRate * 100, fill: C.emerald },
    { name: "Oracle", rate: bandit.oracleRate * 100, fill: C.blue },
  ];
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 14, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#1e293b" }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={36} />
        <Tooltip cursor={{ fill: "#1e293b55" }} contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "conversion"]} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={48} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
          <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#cbd5e1" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
