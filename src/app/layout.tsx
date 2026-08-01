import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import Marco from '@/components/Marco';

const inter = Inter({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600', '700'] });
const display = Inter({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700'] });
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Garantías · Ingresos y egresos',
  description: 'Consolidado mensual de reclamos facturados y compras de repuestos de garantía.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas">
        <Marco>{children}</Marco>
      </body>
    </html>
  );
}
