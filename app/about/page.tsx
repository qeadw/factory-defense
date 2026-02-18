import Link from 'next/link';

export default function About() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c0c10',
      color: '#b0b0a0',
      fontFamily: 'monospace',
      padding: 40,
    }}>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: 30,
          padding: '8px 16px',
          background: 'rgba(20, 20, 25, 0.9)',
          border: '1px solid #505060',
          color: '#b0b0a0',
          textDecoration: 'none',
        }}
      >
        &larr; BACK TO GAME
      </Link>

      <h1 style={{
        color: '#d0d0c0',
        fontSize: 32,
        marginBottom: 20,
        borderBottom: '2px solid #404050',
        paddingBottom: 10,
      }}>
        ABOUT ME
      </h1>

      <div style={{
        maxWidth: 800,
        background: 'rgba(20, 20, 25, 0.8)',
        border: '1px solid #404050',
        padding: 30,
        marginBottom: 30,
      }}>
        <p style={{ color: '#808080', fontSize: 14, lineHeight: 1.8 }}>
          This page is under construction. Check back soon!
        </p>
        <p style={{ color: '#606060', fontSize: 12, marginTop: 20 }}>
          // TODO: Add personal info, projects, and contact links
        </p>
      </div>
    </div>
  );
}
