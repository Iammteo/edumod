import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edumod | Modern school management",
  description: "Modern school management, built for the future.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
