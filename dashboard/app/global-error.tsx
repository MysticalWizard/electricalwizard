'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          background: '#1e1f22',
          color: '#dbdee1',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 style={{ color: '#ed4245', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#949ba4', fontSize: 14, marginBottom: 24 }}>
            {error.message || 'A critical error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#5865f2',
              color: '#fff',
              border: 'none',
              padding: '8px 24px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
