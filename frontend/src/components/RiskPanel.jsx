import SourceTag from './SourceTag.jsx';
import { displayRiskStatus, displayRouteStatus, formatHours, formatNumber, formatTcpA } from '../utils/formatters.js';

export default function RiskPanel({ route, risk }) {
  const routeStatus = displayRouteStatus(route.route_status);
  const riskStatus = displayRiskStatus(risk.threatLevel);
  const hasLargeCpa = Number.isFinite(risk.cpaKm) && risk.cpaKm >= 1000;

  return (
    <>
      <div className="panel fade-enter">
        <h4>Route Status<SourceTag>RISK-WEIGHTED DIJKSTRA</SourceTag></h4>
        <span className={`badge ${routeStatus === 'INFEASIBLE' ? 'high-risk' : routeStatus === 'CAUTION' ? 'caution' : 'safe'}`}>
          {routeStatus === 'INFEASIBLE' ? 'NO SAFE ROUTE' : routeStatus}
        </span>
        <div className="divider" />
        <div className="row"><span>Distance</span><b>{route.route_status === 'INFEASIBLE' ? 'N/A' : `${formatNumber(route.total_distance_km)} km`}</b></div>
        <div className="row"><span>Estimated Travel Time</span><b>{route.route_status === 'INFEASIBLE' ? 'N/A' : formatHours(route.estimated_hours)}</b></div>
        <div className="row"><span>Minimum Clearance</span><b>{formatNumber(route.iceberg_min_clearance_km)} km</b></div>
        {route.route_status === 'INFEASIBLE' && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{route.reason}</div>}
      </div>

      <div className="panel fade-enter" style={{ marginTop: 12 }}>
        <h4>Risk Analysis</h4>
        <div className={`badge ${riskStatus === 'CRITICAL' || riskStatus === 'HIGH' ? 'high-risk' : riskStatus === 'CAUTION' ? 'caution' : 'safe'}`}>{riskStatus}</div>
        <div className="divider" />
        <div className="row"><span>Risk Score</span><b>{formatNumber(risk.riskScore, 1)} / 100</b></div>
        <div className="row"><span>Closest Approach</span><b>{formatNumber(risk.cpaKm, 1)} km / {formatNumber(risk.cpaNm, 1)} nm</b></div>
        <div className="row"><span>Time to CPA</span><b>{formatTcpA(risk.tcpaMinutes, risk.tcpaHours)}</b></div>
        <div className="divider" />
        <div className="row"><span>Closest Forecast Horizon</span><b>{risk.closestHorizon || 'N/A'}</b></div>
        {hasLargeCpa && <p style={{ color: 'var(--text-soft)', fontSize: 12, lineHeight: 1.45, margin: '10px 0 0' }}>No immediate iceberg threat detected.</p>}
      </div>
    </>
  );
}
