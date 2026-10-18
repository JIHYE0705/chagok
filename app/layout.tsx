import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const nanumSquareRound = localFont({
  src: [
    { path: "./fonts/NanumSquareRound-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/NanumSquareRound-Bold.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-nanum-square-round",
});

export const metadata: Metadata = {
  title: "차곡",
  description: "발견한 정보를 차곡차곡.",
  icons: { icon: "/chagok-note.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={nanumSquareRound.variable}>
      <body>{children}</body>
    </html>
  );
}
