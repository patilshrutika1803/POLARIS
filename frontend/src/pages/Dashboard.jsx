import { useState } from 'react';
import MapView, { DEFAULT_LAYERS } from '../components/MapView.jsx';
import VesselPanel from '../components/VesselPanel.jsx';
import NavStatusPanel from '../components/NavStatusPanel.jsx';
import RiskPanel from '../components/RiskPanel.jsx';
import OceanConditionsPanel from '../components/OceanConditionsPanel.jsx';
import SeaIcePanel from '../components/SeaIcePanel.jsx';
import MapLayersPanel from '../components/MapLayersPanel.jsx';
import NavigationAlerts from '../components/NavigationAlerts.jsx';
import { useNavigationAnalysis } from '../context/NavigationAnalysisContext.jsx';
import { formatCoordinate, formatHours, formatNumber, formatPercent } from '../utils/formatters.js';

export default function Dashboard() {
  const { analysis } = useNavigationAnalysis();
  const [focusMode, setFocusMode] = useState(false);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);

  function toggleLayer(key) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (!analysis) {
    return <div className="panel" style={{ color: 'var(--muted)' }}>Run a navigation analysis to load mission data.</div>;
  }

  const { vessel, status, scene, route, risk, icebergs, oceanCurrent, seaIce } = analysis;

  const trackedIceberg = icebergs.find((b) => b.forecast);

  return (
    <div>
      <div className="dash-grid">
        {!focusMode && (
          <div className="dash-left">
            <VesselPanel vessel={{ ...vessel, maxSeaIceConcentration: analysis.request?.vessel_info?.max_acceptable_siconc }} />
            <MapLayersPanel layers={layers} onToggle={toggleLayer} />
          </div>
        )}

        <div className="dash-center" style={{ gridColumn: focusMode ? '1 / span 2' : 'auto' }}>
          {focusMode && (
            <button className="btn-back" onClick={() => setFocusMode(false)}>
              &larr; Back to Dashboard
            </button>
          )}
          <MapView
            scene={scene}
            routeStatus={route.route_status}
            focusMode={focusMode}
            layers={layers}
            seaIce={seaIce}
            oceanCurrent={oceanCurrent}
            selectedIceberg={trackedIceberg}
            horizon="hr1"
          />
          {!focusMode && route.route_status !== 'INFEASIBLE' && (
            <button className="btn-main" onClick={() => setFocusMode(true)}>
              VIEW RECOMMENDED ROUTE →
            </button>
          )}
        </div>

        <div className="dash-right">
          {focusMode ? <RiskPanel route={route} risk={risk} /> : (
            <>
              <NavStatusPanel status={status} />
              <NavigationAlerts />
            </>
          )}
        </div>
      </div>

      <div className="dash-cards">
        <div className="panel">
          <h4>Iceberg Forecast</h4>
          {trackedIceberg ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[['CURRENT', { latitude: trackedIceberg.latitude, longitude: trackedIceberg.longitude }], ['20 MIN', trackedIceberg.forecast?.min20], ['1 HOUR', trackedIceberg.forecast?.hr1], ['6 HOURS', trackedIceberg.forecast?.hr6]].map(([label, prediction]) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,.02)', borderRadius: 7, padding: '8px 4px' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 3 }}>{prediction ? `${formatCoordinate(prediction.latitude)}, ${formatCoordinate(prediction.longitude)}` : 'Unavailable'}</div>
                </div>
              ))}
            </div>
          ) : <p className="data-note">No ML trajectory prediction available.</p>}
        </div>

        <OceanConditionsPanel current={oceanCurrent} />
        <SeaIcePanel seaIce={seaIce} />

        <div className="panel">
          <h4>Route Summary</h4>
          <div className="row"><span>Distance</span><b>{route.route_status === 'INFEASIBLE' ? 'N/A' : `${formatNumber(route.total_distance_km)} km`}</b></div>
          <div className="row"><span>Estimated Travel Time</span><b>{route.route_status === 'INFEASIBLE' ? 'N/A' : formatHours(route.estimated_hours)}</b></div>
          <div className="row"><span>Minimum Clearance</span><b>{formatNumber(route.iceberg_min_clearance_km)} km</b></div>
          <div className="row"><span>Waypoints</span><b>{route.waypoints?.length ?? 0}</b></div>
          <div className="row"><span>Status</span><b style={{ color: route.route_status === 'INFEASIBLE' ? 'var(--red)' : 'var(--green)' }}>{route.route_status}</b></div>
          <div className="row"><span>Destination</span><b>{formatCoordinate(scene.destination.latitude)}, {formatCoordinate(scene.destination.longitude)}</b></div>
        </div>
      </div>

      <style>{`
        .dash-grid{display:grid;grid-template-columns:minmax(220px,250px) minmax(0,1fr) minmax(230px,270px);gap:12px;align-items:start;}
        .dash-left{display:flex;flex-direction:column;gap:12px;}
        .dash-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;}
        @media (max-width: 1100px){ .dash-grid{grid-template-columns:220px minmax(0,1fr) 230px;} .dash-cards{grid-template-columns:repeat(2,1fr);} }
        @media (max-width: 900px){ .dash-grid{grid-template-columns:1fr;} .dash-right{order:3;} .dash-center{order:2;} .dash-left{order:1;} }
      `}</style>
    </div>
  );
}
