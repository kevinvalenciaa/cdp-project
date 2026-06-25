"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BanditResult, Opportunity } from "@/lib/types";
import { moneyCompact, monthlyImpact } from "@/lib/format";

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
          tick={{ fill: "#4B494A", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "#0000000a" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [`${moneyCompact(Number(v))}/mo`, "est. impact"]}
        />
        <Bar dataKey="impact" fill={C.blue} radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
          <LabelList dataKey="impact" position="right" formatter={(v) => `${moneyCompact(Number(v))}/mo`} fill="#8F8A8B" fontSize={11} />
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
        <XAxis dataKey="name" tick={{ fill: "#8F8A8B", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E0DEDF" }} />
        <YAxis tick={{ fill: "#696365", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={36} />
        <Tooltip cursor={{ fill: "#0000000a" }} contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "conversion"]} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={64} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
          <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#4B494A" fontSize={11} />
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
        <XAxis dataKey="name" tick={{ fill: "#8F8A8B", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E0DEDF" }} />
        <YAxis tick={{ fill: "#696365", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={36} />
        <Tooltip cursor={{ fill: "#0000000a" }} contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "conversion"]} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={48} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
          <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#4B494A" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
