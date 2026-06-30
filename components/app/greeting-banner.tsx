"use client";

import React, { useEffect, useState } from "react";

// Time-aware greeting banner shared by the admin and staff dashboards. Uses the school's day / night
// illustrations (public/banner/*) as the background, switching by the viewer's local time: morning &
// afternoon -> day, evening -> night. Falls back to a tinted gradient if the image isn't present.
const BANNER_SCENES = {
  day: { img: "/banner/day.png", base: "linear-gradient(120deg,#2159e8,#6f9bf2)", scrim: "linear-gradient(90deg,rgba(13,47,117,.72),rgba(13,47,117,.30) 45%,rgba(13,47,117,0) 72%)" },
  night: { img: "/banner/night.png", base: "linear-gradient(120deg,#2a2766,#4a3f8c)", scrim: "linear-gradient(90deg,rgba(20,18,64,.85),rgba(20,18,64,.45) 45%,rgba(20,18,64,0) 72%)" },
};

// Names are often stored with an honorific ("Miss Naomi udoma", "Mr TJ"); show the actual first name
// in the greeting rather than the title.
const HONORIFICS = new Set(["mr", "mrs", "miss", "ms", "dr", "prof", "master", "mallam", "alhaji", "alhaja", "chief", "sir", "madam", "rev", "pastor", "engr", "barr"]);
function firstName(full: string): string {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && HONORIFICS.has(parts[0].toLowerCase().replace(/\.$/, ""))) return parts[1];
  return parts[0] || "there";
}

// `control` renders below the subtitle (e.g. the admin's session/term switcher); omit it for a
// read-only greeting. The content layer is not clipped, so a `control` dropdown can overflow.
export function GreetingBanner({ userName, subtitle, control }: { userName: string; subtitle: React.ReactNode; control?: React.ReactNode }) {
  const [hour, setHour] = useState<number | null>(null);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => { const set = () => setHour(new Date().getHours()); set(); const t = setInterval(set, 60_000); return () => clearInterval(t); }, []);
  const h = hour ?? 9; // stable default for SSR / first paint (morning), corrected on mount
  const isNight = h >= 17 || h < 5;
  const word = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening";
  const scene = isNight ? BANNER_SCENES.night : BANNER_SCENES.day;

  return (
    <div className="relative mb-[18px] min-h-[200px] rounded-3xl sm:min-h-[230px]" style={{ background: scene.base }}>
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        {imgOk && <img key={scene.img} src={scene.img} alt="" aria-hidden onError={() => setImgOk(false)} className="absolute inset-0 size-full object-cover object-right" />}
        <div className="absolute inset-0" style={{ background: scene.scrim }} />
      </div>
      <div className="relative p-6 sm:p-8">
        <h1 className="font-display text-[clamp(26px,5.4vw,40px)] font-extrabold leading-[1.06] tracking-[-.02em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,.25)]">{word}, {firstName(userName)} {isNight ? "🌙" : "☀️"}</h1>
        <p className="mt-2.5 max-w-[62%] text-[14px] leading-relaxed text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.25)]">{subtitle}</p>
        {control && <div className="relative mt-4 inline-block">{control}</div>}
      </div>
    </div>
  );
}
