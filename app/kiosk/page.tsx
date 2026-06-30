"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Camera, Loader2, CheckCircle2, XCircle, SmartphoneNfc, X } from "lucide-react";
import { getQrToken, getKioskTeachers, handleKioskPinClockIn } from "@/lib/actions/attendance";

type Teacher = { id: string; name: string; hasPin: boolean };
type Toast = { ok: boolean; msg: string } | null;

export default function KioskPage() {
  const [qr, setQr] = useState<string>("");
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [modal, setModal] = useState(false);

  // Rotate the QR every 5s from a fresh server-signed token. The terminal must be signed into the
  // school (getQrToken returns an error otherwise) so codes can't be minted by anyone.
  const refresh = useCallback(async () => {
    try {
      const res = await getQrToken();
      if ("error" in res) { setGateErr(res.error); setQr(""); return; }
      setGateErr(null);
      setQr(await QRCode.toDataURL(`${location.origin}/clock-in?t=${encodeURIComponent(res.token)}`, { width: 460, margin: 1, color: { dark: "#0d2f75", light: "#ffffff" } }));
    } catch { /* keep last QR */ }
  }, []);
  useEffect(() => { refresh(); const a = setInterval(refresh, 5000); const b = setInterval(() => setNow(new Date()), 1000); return () => { clearInterval(a); clearInterval(b); }; }, [refresh]);

  return (
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#0d2f75,#143a99,#1b4fd0)] p-6 text-white">
      <div className="w-[min(560px,100%)] text-center">
        <div className="mb-6"><div className="text-[13px] font-bold uppercase tracking-[.2em] text-blue-200">Staff attendance terminal</div><div suppressHydrationWarning className="font-display text-[40px] font-bold tabular-nums">{now.toLocaleTimeString()}</div><div suppressHydrationWarning className="text-[13px] text-blue-100">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div></div>

        <div className="mx-auto grid place-items-center rounded-3xl bg-white p-6 shadow-2xl">
          {qr ? <img src={qr} alt="Scan to clock in" className="size-[min(380px,72vw)]" /> : gateErr ? <div className="grid size-[min(380px,72vw)] place-items-center px-6 text-center text-[14px] font-bold text-ink-soft">{gateErr}</div> : <div className="grid size-[min(380px,72vw)] place-items-center text-ink-soft"><Loader2 className="size-10 animate-spin" /></div>}
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-[15px] font-bold text-blue-50"><QrCode className="size-5" /> Scan with your phone to clock in / out</p>
        <p className="mt-1 text-[12px] text-blue-200">The code refreshes every 5 seconds - screenshots won&rsquo;t work.</p>

        <button onClick={() => setModal(true)} className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-3 text-[15px] font-extrabold backdrop-blur transition hover:bg-white/20">
          <SmartphoneNfc className="size-5" /> Phone dead? Clock in with PIN
        </button>
      </div>

      {modal && <PinModal onClose={() => setModal(false)} />}
    </div>
  );
}

function PinModal({ onClose }: { onClose: () => void }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [camReady, setCamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { getKioskTeachers().then(setTeachers); }, []);

  // Front camera stream.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => { if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; } streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; setCamReady(true); } })
      .catch(() => setCamReady(false));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function captureSelfie(): string | null {
    const v = videoRef.current; if (!v || !v.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = Math.round((480 * v.videoHeight) / v.videoWidth);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }

  async function submit() {
    if (!teacherId) { setToast({ ok: false, msg: "Select your name." }); return; }
    if (!/^\d{6}$/.test(pin)) { setToast({ ok: false, msg: "Enter your 6-digit PIN." }); return; }
    const snapshot = captureSelfie();
    if (!snapshot) { setToast({ ok: false, msg: "Camera not ready - allow camera access." }); return; }
    setBusy(true); setToast(null);
    const r = await handleKioskPinClockIn({ teacherId, pin, snapshot });
    setBusy(false);
    if ("error" in r) { setToast({ ok: false, msg: r.error }); setPin(""); return; }
    setToast({ ok: true, msg: `${r.teacher} ${r.direction === "clock_in" ? "clocked in" : "clocked out"} ✓` });
    setPin(""); setTeacherId("");
    setTimeout(onClose, 1800);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-ink" onClick={onClose}>
      <div className="w-[min(440px,100%)] rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold">Clock in with PIN</h2><button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper"><X className="size-5" /></button></div>

        <div className="mb-4 grid place-items-center">
          <div className="relative size-28 overflow-hidden rounded-full border-4 border-brand-soft bg-paper">
            <video ref={videoRef} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
            {!camReady && <div className="absolute inset-0 grid place-items-center text-ink-soft"><Camera className="size-7" /></div>}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-soft">A snapshot is taken when you submit.</p>
        </div>

        <label className="grid gap-1.5"><span className="text-[12px] font-extrabold">Your name</span>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="min-h-11 rounded-xl border border-border-soft bg-paper/60 px-3 text-[14px] outline-none focus:border-brand-blue">
            <option value="">Select your name…</option>
            {teachers.map((t) => <option key={t.id} value={t.id} disabled={!t.hasPin}>{t.name}{t.hasPin ? "" : " (no PIN set)"}</option>)}
          </select>
        </label>

        <label className="mt-3 grid gap-1.5"><span className="text-[12px] font-extrabold">6-digit PIN</span>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" placeholder="••••••" className="min-h-12 rounded-xl border border-border-soft bg-paper/60 px-3 text-center text-[22px] font-bold tracking-[.4em] outline-none focus:border-brand-blue" />
        </label>

        {toast && <p className={`mt-3 flex items-center gap-1.5 text-[13px] font-bold ${toast.ok ? "text-brand-green" : "text-[#b3261e]"}`}>{toast.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{toast.msg}</p>}

        <button onClick={submit} disabled={busy} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue text-[15px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">
          {busy ? <><Loader2 className="size-5 animate-spin" /> Submitting…</> : <><Camera className="size-5" /> Capture & clock in</>}
        </button>
      </div>
    </div>
  );
}
