import Game from '@/components/Game';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Link
        href="/about"
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          padding: '8px 16px',
          background: 'rgba(20, 20, 25, 0.9)',
          border: '1px solid #505060',
          color: '#b0b0a0',
          fontFamily: 'monospace',
          fontSize: 12,
          textDecoration: 'none',
          zIndex: 1000,
          cursor: 'pointer',
        }}
      >
        ABOUT ME
      </Link>
      <Game />
    </>
  );
}
