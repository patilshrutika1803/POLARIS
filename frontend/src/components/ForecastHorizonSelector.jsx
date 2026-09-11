import SourceTag from './SourceTag.jsx';

const FORECAST_HORIZONS = [
  { key: 'min20', label: '20 MIN' },
  { key: 'hr1', label: '1 HOUR' },
  { key: 'hr6', label: '6 HOURS' },
];

// The "20 MIN / 1 HOUR / 6 HOURS" control. Purely a selector — it
// doesn't compute anything, just tells the parent which forecast key
// to read out of the iceberg's existing `forecast` object.
export default function ForecastHorizonSelector({ horizon, onChange, iceberg }) {
  const selected = iceberg?.forecast?.[horizon];

  return (
    <div className="panel">
      <h4>Forecast Horizon<SourceTag>ML MODEL</SourceTag></h4>
      <div style={{ display: 'flex', gap: 6 }}>
        {FORECAST_HORIZONS.map((h) => (
          <button
            key={h.key}
            onClick={() => onChange(h.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              border: horizon === h.key ? '1px solid var(--cyan)' : '1px solid var(--panel-border)',
              background: horizon === h.key ? 'linear-gradient(180deg,#1391c4,#0c6a94)' : 'rgba(255,255,255,.03)',
              color: horizon === h.key ? '#fff' : 'var(--muted)',
            }}
          >
            {h.label}
          </button>
        ))}
      </div>

      {selected ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: 0.5 }}>
            SELECTED: {FORECAST_HORIZONS.find((h) => h.key === horizon)?.label}
          </div>
          <div className="row"><span>Predicted Lat</span><b>{selected.latitude.toFixed(5)}°</b></div>
          <div className="row"><span>Predicted Lon</span><b>{selected.longitude.toFixed(5)}°</b></div>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Select an iceberg with active tracking to view its predicted position.
        </div>
      )}
    </div>
  );
}
