import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SplitCuenta — Dividí la cuenta fácil',
  description: 'Dividí la cuenta del restaurante entre amigos. Escaneá el ticket o ingresá los ítems manualmente.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#FAF7F2]">
        {children}
      </body>
    </html>
  );
}
