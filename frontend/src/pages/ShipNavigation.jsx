import { useState } from 'react';
import { analyzeRoute, NavigationValidationError } from '../api/polarisApi.js';
import { useNavigationAnalysis } from '../context/NavigationAnalysisContext.jsx';
import { formatCoordinate, formatNumber, formatPercent } from '../utils/formatters.js';

const FIELD = { width: '100%', background: '#0a1c28', border: '1px solid var(--panel-border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 12.5, fontFamily: 'var(--font-mono)', marginTop: 4 };
const LABEL = { fontSize: 11, color: 'var(--muted)' };

export default function ShipNavigation() {
  const [start, setStart] = useState({ lat: -60.25, lon: 151.00001525878906 });
  const [destination, setDestination] = useState({ lat: -60.5, lon: 154.41668701171875 });
  const [vessel, setVessel] = useState({ type: 'Ice-strengthened Vessel', iceCapability: 'PC6', speedKn: 12, maxSpeedKn: 16, maxSeaIceConcentration: 0.4, headingDeg: null });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setAnalysis } = useNavigationAnalysis();

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeRoute({
        start,
        destination,
        vessel,
      });
      setResult(res);
      setAnalysis(res);
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof NavigationValidationError
        ? requestError.message
        : requestError.message || 'Navigation analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ship-nav-grid">
      <div className="panel">
        <h4>Start</h4>
        <label style={LABEL}>Latitude
          <input style={FIELD} type="number" value={start.lat} onChange={(e) => setStart({ ...start, lat: +e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Longitude
          <input style={FIELD} type="number" value={start.lon} onChange={(e) => setStart({ ...start, lon: +e.target.value })} />
        </label>

        <div className="divider" />

        <h4>Destination</h4>
        <label style={LABEL}>Latitude
          <input style={FIELD} type="number" value={destination.lat} onChange={(e) => setDestination({ ...destination, lat: +e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Longitude
          <input style={FIELD} type="number" value={destination.lon} onChange={(e) => setDestination({ ...destination, lon: +e.target.value })} />
        </label>

        <div className="divider" />

        <h4>Vessel</h4>
        <label style={LABEL}>Vessel Type
          <input style={FIELD} value={vessel.type} onChange={(e) => setVessel({ ...vessel, type: e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Ice Capability
          <input style={FIELD} value={vessel.iceCapability} onChange={(e) => setVessel({ ...vessel, iceCapability: e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Current Speed (kn)
          <input style={FIELD} type="number" value={vessel.speedKn} onChange={(e) => setVessel({ ...vessel, speedKn: +e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Maximum Speed (kn)
          <input style={FIELD} type="number" value={vessel.maxSpeedKn} onChange={(e) => setVessel({ ...vessel, maxSpeedKn: +e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Max Acceptable Sea-Ice Concentration
          <input style={FIELD} type="number" step="0.05" value={vessel.maxSeaIceConcentration} onChange={(e) => setVessel({ ...vessel, maxSeaIceConcentration: +e.target.value })} />
        </label>
        <label style={{ ...LABEL, display: 'block', marginTop: 10 }}>Heading (degrees, optional)
          <input style={FIELD} type="number" min="0" max="360" value={vessel.headingDeg ?? ''} onChange={(e) => setVessel({ ...vessel, headingDeg: e.target.value === '' ? null : +e.target.value })} />
        </label>

        <button className="btn-main" style={{ marginTop: 14 }} onClick={handleAnalyze} disabled={loading}>
          {loading ? 'ANALYZING…' : 'ANALYZE ROUTE'}
        </button>
      </div>

      <div className="ship-nav-map">
        {error && <div className="panel" style={{ color: 'var(--red)' }} role="alert">{error}</div>}

        {result && (
          <div className="panel" style={{ marginTop: 12 }}>
            <h4>Route Status</h4>
            <div className="row"><span>Status</span><b style={{ color: result.route.route_status === 'INFEASIBLE' ? 'var(--red)' : 'var(--green)' }}>{result.route.route_status}</b></div>
            <div className="row"><span>Distance</span><b>{formatNumber(result.route.total_distance_km)} km</b></div>
            <div className="row"><span>Estimated Travel Time</span><b>{formatNumber(result.route.estimated_hours)} hr</b></div>
            <div className="row"><span>Minimum Clearance</span><b>{formatNumber(result.route.iceberg_min_clearance_km)} km</b></div>
            <div className="row"><span>Waypoints</span><b>{result.route.waypoints?.length ?? 0}</b></div>
            <div className="divider" />
            <div className="row"><span>Start</span><b>{formatCoordinate(result.request?.start?.latitude)}, {formatCoordinate(result.request?.start?.longitude)}</b></div>
            <div className="row"><span>Destination</span><b>{formatCoordinate(result.request?.destination?.latitude)}, {formatCoordinate(result.request?.destination?.longitude)}</b></div>
            <div className="row"><span>Speed</span><b>{formatNumber(result.request?.vessel_info?.speed_knots, 2)} kn</b></div>
            <div className="row"><span>Heading</span><b>{Number.isFinite(result.vessel.headingDeg) ? `${formatNumber(result.vessel.headingDeg, 1)}°` : 'N/A — not provided'}</b></div>
            <div className="row"><span>Ice Capability</span><b>{vessel.iceCapability || 'N/A'}</b></div>
            <div className="row"><span>Maximum Speed</span><b>{formatNumber(vessel.maxSpeedKn, 2)} kn</b></div>
            <div className="row"><span>Max Sea-Ice Concentration</span><b>{formatPercent(vessel.maxSeaIceConcentration)}</b></div>
            <div className="divider" />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>ROUTE WAYPOINTS</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {result.route.waypoints?.map((wp, index) => (
                <span key={`${wp.latitude}-${wp.longitude}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>
                  WP-{index + 1}: {formatCoordinate(wp.latitude)}, {formatCoordinate(wp.longitude)}
                </span>
              ))}
            </div>
            {result.route.route_status === 'INFEASIBLE' && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13, fontWeight: 700 }}>NO SAFE ROUTE</div>}
            {result.route.route_status === 'INFEASIBLE' && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 12 }}>No safe feasible route was found. {result.route.reason}</div>}
          </div>
        )}
      </div>

      <style>{`
        .ship-nav-grid{display:grid;grid-template-columns:minmax(240px,280px) minmax(0,1fr);gap:12px;align-items:start;}
        @media (max-width:700px){.ship-nav-grid{grid-template-columns:1fr;}}
      `}</style>
    </div>
  );
}
