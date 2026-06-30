import React from "react";

// Shared UI primitives — the single source of truth for buttons, alerts, inputs and badges so
// colours, radii, sizing and weights stay consistent across the whole app. Prefer these over
// hand-rolled className strings.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50";

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-[12px]",
  md: "min-h-10 px-4 text-[13px]",
  lg: "min-h-11 px-5 text-[14px]",
};

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-blue text-white hover:bg-brand-dark",
  secondary: "border border-border-soft bg-white text-ink-soft hover:border-brand-blue hover:text-brand-blue",
  danger: "border border-danger-line bg-danger-soft text-danger hover:bg-danger-soft/60",
  success: "bg-brand-green text-white hover:opacity-90",
  ghost: "text-ink-soft hover:bg-brand-soft hover:text-brand-blue",
};

// Class-string helper for cases where a plain <button>/<a> is needed (e.g. extra layout classes,
// anchors, or third-party components). For most buttons use <Button> below.
export function btn(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return cn(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[variant], extra);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={btn(variant, size, className)} {...rest} />;
}

export type AlertTone = "error" | "warn" | "success" | "info";

const ALERT_TONE: Record<AlertTone, string> = {
  error: "border-danger-line bg-danger-soft text-danger",
  warn: "border-warn-line bg-warn-soft text-warn",
  success: "border-success-line bg-success-soft text-success",
  info: "border-brand-blue/30 bg-brand-soft text-brand-dark",
};

// Inline status/feedback banner. Use for form errors, warnings and success confirmations.
export function Alert({ tone = "info", className = "", children }: { tone?: AlertTone; className?: string; children: React.ReactNode }) {
  if (!children) return null;
  return <div className={cn("rounded-[10px] border px-3 py-2 text-[12px] font-bold", ALERT_TONE[tone], className)}>{children}</div>;
}

// Shared form-control classes so inputs and selects look identical everywhere.
export const inputCls =
  "min-h-10 w-full rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none transition focus:border-brand-blue focus:bg-white";
export const selectCls = inputCls + " disabled:opacity-60";

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export type PillTone = "green" | "red" | "amber" | "blue" | "purple";

const PILL_TONE: Record<PillTone, string> = {
  green: "bg-success-soft text-success",
  red: "bg-danger-soft text-danger",
  amber: "bg-warn-soft text-warn",
  blue: "bg-brand-soft text-brand-dark",
  purple: "bg-accent-purple-soft text-accent-purple",
};

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold", PILL_TONE[tone])}>{children}</span>;
}
