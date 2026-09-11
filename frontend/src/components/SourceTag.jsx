// Small traceability label — shows evaluators which backend component
// a piece of data came from (ML model, GLORYS12, Dijkstra, etc).
export default function SourceTag({ children }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: 0.6,
        color: 'var(--muted2)',
        border: '1px solid rgba(80,180,220,.25)',
        borderRadius: 4,
        padding: '2px 6px',
        marginLeft: 8,
      }}
    >
      {children}
    </span>
  );
}
