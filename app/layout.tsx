import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Factory Defense',
  description: 'A factory building and tower defense game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
