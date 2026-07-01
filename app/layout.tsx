import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDATSUKA — Generation Studio",
  description: "AI image generation platform by IDATSUKA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
