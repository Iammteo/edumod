"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// Opens the phone's rear camera and scans for the kiosk QR. The QR encodes `${origin}/clock-in?t=TOKEN`
// (or a bare token); we extract the token and hand it back. Camera needs a secure context (HTTPS/localhost).
export function QrScanModal({ onToken, onClose }: { onToken: (token: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream; await v.play();
        tick();
      } catch {
        setErr("Camera unavailable. Allow camera access (needs HTTPS), or use “Clock in here”.");
      }
    }
    function tick() {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c || doneRef.current) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          let token = code.data;
          try { token = new URL(code.data).searchParams.get("t") || code.data; } catch { /* bare token */ }
          doneRef.current = true;
          onToken(token);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    start();
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [onToken]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-[min(380px,100%)] rounded-3xl bg-white p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between"><h3 className="font-display text-[16px] font-semibold">Scan the terminal QR</h3><button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper">✕</button></div>
        <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/80" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {err ? <p className="mt-3 text-[12px] font-bold text-danger">{err}</p> : <p className="mt-3 text-[12px] text-ink-soft">Point your camera at the rotating code on the staff terminal.</p>}
      </div>
    </div>
  );
}
