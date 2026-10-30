import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PELINDO R4 PortDash – Monitoring Kinerja Pelabuhan",
  description: "Aplikasi monitoring, konsolidasi, analisis, dan penyajian kinerja Regional 4 serta seluruh cabang pelabuhan.",
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
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('portsight_theme');
                  if (saved === 'light' || saved === 'dark') {
                    document.documentElement.setAttribute('data-theme', saved);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
