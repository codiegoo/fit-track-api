import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FitTracker Simple API',
  description: 'API para comidas, rachas y notificaciones (JWT).',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
