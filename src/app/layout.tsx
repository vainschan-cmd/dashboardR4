import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Executive Dashboard – Monitoring Kinerja Pelabuhan",
  description: "Aplikasi monitoring, konsolidasi, analisis, dan penyajian kinerja Regional serta seluruh cabang pelabuhan.",
  keywords: ["Pelabuhan", "Dashboard Eksekutif", "Monitoring Kinerja", "Regional", "Pelindo", "Port Analytics"],
  authors: [{ name: "Regional Port Authority" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
