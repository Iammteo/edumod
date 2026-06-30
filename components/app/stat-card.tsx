"use client";

import React from "react";

// Admin-style stat card (icon tile + big value + meta/trend + faint watermark), shared so the staff
// overview matches the admin dashboard. Renders as a button when `onClick` is given, else a plain card.
const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;

export type StatCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  meta?: string;
  trend?: { up: boolean; pct: string; note: string } | null;
  onClick?: () => void;
};

export function StatCard({ label, value, icon, color, meta, trend, onClick }: StatCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`group relative overflow-hidden rounded-2xl border border-border-soft bg-white p-4 text-left transition ${onClick ? "hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]" : ""}`}>
      {onClick && <span className="absolute right-3 top-3 text-ink-soft/40 transition group-hover:translate-x-0.5 group-hover:text-brand-blue">{I(<path d="m9 18 6-6-6-6" />)}</span>}
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}>{I(icon)}</span>
        <div className="min-w-0 pr-4">
          <strong className="block break-words font-display text-[clamp(19px,5vw,25px)] font-bold leading-none" style={{ color }}>{value}</strong>
          <small className="mt-1.5 block font-bold text-ink">{label}</small>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-extrabold">
            {trend && <span className={trend.up ? "text-brand-green" : "text-danger"}>{trend.up ? "↑" : "↓"} {trend.pct}</span>}
            {(trend || meta) && <span className="text-ink-soft">{trend ? trend.note : meta}</span>}
          </div>
        </div>
      </div>
      <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-2 opacity-[0.06]" style={{ color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="size-20">{icon}</svg></span>
    </Tag>
  );
}
