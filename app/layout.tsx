import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const gowunDodum = localFont({
  src: "./fonts/GowunDodum-Regular.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-gowun-dodum",
});

export const metadata: Metadata = {
  title: "차곡",
  description: "발견한 정보를 차곡차곡.",
  icons: { icon: "/chagok-note.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={gowunDodum.variable}>
      <body>{children}</body>
    </html>
  );
}
