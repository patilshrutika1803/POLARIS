import { useEffect, useState } from 'react';
import MapView, { DEFAULT_LAYERS } from '../components/MapView.jsx';
import ForecastHorizonSelector from '../components/ForecastHorizonSelector.jsx';
import SourceTag from '../components/SourceTag.jsx';
import { useNavigationAnalysis } from '../context/NavigationAnalysisContext.jsx';
import { formatCoordinate, formatNumber } from '../utils/formatters.js';

export default function IcebergAnalysis() {
  const { analysis } = useNavigationAnalysis();
  const [selectedId, setSelectedId] = useState(null);
  const [horizon, setHorizon] = useState('hr1');

  useEffect(() => {
    if (!selectedId && analysis?.icebergs?.length > 0) setSelectedId(analysis.icebergs[0].id);
  }, [analysis, selectedId]);

  if (!analysis) return <div className="panel" style={{ color: 'var(--muted)' }}>Run a navigation analysis to load iceberg predictions.</div>;
  const { icebergs, scene, seaIce, oceanCurrent } = analysis;

  const selected = icebergs.find((b) => b.id === selectedId) ?? icebergs[0];
  const trackedList = icebergs.filter((b) => b.forecast);

  return (
    <div className="iceberg-analysis-grid">
      <div className="ia-left">
        <div className="panel">
          <h4>Detected Icebergs</h4>
          <div className="data-note">{trackedList.length > 0 ? `${trackedList.length} TRAJECTORY` : 'NONE'}</div>
          {icebergs.length > 0 ? icebergs.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`ia-item ${b.id === selectedId ? 'active' : ''}`}
            >
              <span>{b.id}</span>
              <span className={`ia-risk ia-risk-${b.riskLevel}`}>{b.forecast ? 'AVAILABLE' : 'NONE'}</span>
            </button>
          )) : <p className="data-note">No ML trajectory prediction available.</p>}
        </div>
      </div>

      <div className="ia-center">
        <MapView
          scene={scene}
          routeStatus={analysis.route.route_status}
          layers={{ ...DEFAULT_LAYERS, recommendedRoute: false, waypoints: false }}
          seaIce={seaIce}
          oceanCurrent={oceanCurrent}
          selectedIceberg={selected}
          horizon={selected?.forecast ? horizon : null}
        />
      </div>

      <div className="ia-right">
        {selected && (
          <div className="panel">
            <h4>Iceberg Details</h4>
            <div className="row"><span>ID</span><b>{selected.id}</b></div>
            <div className="row"><span>Current</span><b>{formatCoordinate(selected.currentLat)}, {formatCoordinate(selected.currentLon)}</b></div>
            {[
              ['20 MIN', selected.forecast?.min20],
              ['1 HOUR', selected.forecast?.hr1],
              ['6 HOURS', selected.forecast?.hr6],
            ].map(([label, position]) => (
              <div className="row" key={label}><span>{label}</span><b>{position ? `${formatCoordinate(position.latitude)}, ${formatCoordinate(position.longitude)}` : 'Unavailable'}</b></div>
            ))}
            <div className="row"><span>Speed</span><b>{formatNumber(selected.speedKn, 2)} kn</b></div>
            <div className="row"><span>Bearing</span><b>{formatNumber(selected.bearingDeg, 1)}°</b></div>
            <div className="row"><span>Risk Level</span><b>{selected.riskLevel.toUpperCase()}</b></div>
          </div>
        )}

        {selected?.forecast ? (
          <div style={{ marginTop: 12 }}>
            <ForecastHorizonSelector horizon={horizon} onChange={setHorizon} iceberg={selected} />
          </div>
        ) : (
          <div className="panel" style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
            No ML trajectory prediction available.
          </div>
        )}

        <div className="panel" style={{ marginTop: 12 }}>
          <h4>Closest Approach<SourceTag>RISK MODEL</SourceTag></h4>
          <div className="row"><span>Clearance</span><b>{formatNumber(analysis.risk.cpaKm, 1)} km</b></div>
          <div className="row"><span>Risk Level</span><b>{analysis.risk.threatLevel ?? '—'}</b></div>
        </div>
      </div>

      <style>{`
        .iceberg-analysis-grid{display:grid;grid-template-columns:minmax(180px,200px) minmax(0,1fr) minmax(230px,260px);gap:12px;align-items:start;}
        .ia-item{width:100%;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.02);border:1px solid var(--panel-border);border-radius:7px;padding:8px 10px;margin-top:6px;color:var(--text);font-family:var(--font-mono);font-size:11.5px;cursor:pointer;}
        .ia-item.active{border-color:var(--cyan);box-shadow:0 0 0 1px var(--cyan) inset;}
        .ia-risk{font-size:9px;padding:2px 6px;border-radius:4px;}
        .ia-risk-high{background:rgba(255,92,92,.15);color:var(--red);}
        .ia-risk-medium{background:rgba(245,148,31,.15);color:var(--orange);}
        .ia-risk-none{background:rgba(62,230,138,.1);color:var(--green);}
        @media (max-width:900px){.iceberg-analysis-grid{grid-template-columns:1fr 1fr;}.ia-center{grid-column:1 / -1;grid-row:1;}.ia-left{grid-column:1;grid-row:2;}.ia-right{grid-column:2;grid-row:2;}}
        @media (max-width:600px){.iceberg-analysis-grid{grid-template-columns:1fr;}.ia-center,.ia-left,.ia-right{grid-column:auto;grid-row:auto;}}
      `}</style>
    </div>
  );
}
