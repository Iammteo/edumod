export const navLinks = [
  ["Why Edumod", "/#why"],
  ["Features", "/#platform"],
  ["About us", "/#about"],
  ["Contact us", "/contact"],
];

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return <span className="inline-flex items-center gap-2.5 font-display text-[22px] font-semibold tracking-tight"><span aria-hidden className="grid size-6 rotate-45 place-items-center border-2 border-brand-green"><i className="size-[7px] border-2 border-brand-green" /></span><span>Edumod<small className={`mt-0.5 block font-ui text-[9px] font-bold tracking-normal ${inverse ? "text-blue-100" : "text-ink-soft"}`}>by Klavoir Technology</small></span></span>;
}
