import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PELINDO R4 PortDash – Monitoring Kinerja Pelabuhan",
  description: "Aplikasi monitoring, konsolidasi, analisis, dan penyajian kinerja Regional 4 serta seluruh cabang pelabuhan.",
  keywords: ["Pelabuhan", "Dashboard Eksekutif", "Monitoring Kinerja", "Regional", "Pelindo", "Port Analytics"],
  authors: [{ name: "Regional Port Authority" }],
  icons: {
    icon: [
      { url: '/favicon.ico?v=2' },
      { url: '/pelindo-logo.png?v=2', type: 'image/png', sizes: '256x256' },
      { url: '/favicon-32x32.png?v=2', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png?v=2', type: 'image/png', sizes: '16x16' },
    ],
    shortcut: '/favicon.ico?v=2',
    apple: [
      { url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' },
    ],
  },
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
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" href="/pelindo-logo.png?v=2" type="image/png" sizes="256x256" />
        <link rel="icon" href="/favicon-32x32.png?v=2" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png?v=2" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
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
