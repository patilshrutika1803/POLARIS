import { displayRouteStatus, formatCoordinate, formatHours, formatNumber, formatPercent } from '../utils/formatters.js';

const badgeClass = { SAFE: 'safe', CAUTION: 'caution', HIGH_RISK: 'high-risk' };
const badgeText = { SAFE: 'SAFE', CAUTION: 'CAUTION', INFEASIBLE: 'INFEASIBLE' };

export default function NavStatusPanel({ status }) {
  const destination = status.destination
    ? `${formatCoordinate(status.destination.latitude)}, ${formatCoordinate(status.destination.longitude)}`
    : 'Unavailable';
  const routeStatus = displayRouteStatus(status.routeStatus);

  return (
    <div className="panel">
      <h4>Route Status</h4>
      <span className={`badge ${badgeClass[routeStatus] || 'high-risk'}`}>{badgeText[routeStatus] || routeStatus}</span>
      <div className="divider" />
      <div className="row"><span>Destination</span><b>{destination}</b></div>
      <div className="row"><span>Distance</span><b>{formatNumber(status.distanceKm)} km</b></div>
      <div className="row"><span>Estimated Travel Time</span><b>{formatHours(status.etaHours)}</b></div>
      <div className="row"><span>Current Risk</span><b>{status.currentRisk || 'N/A'}</b></div>
      <div className="row"><span>Nearby Icebergs</span><b>{status.nearbyIcebergs}</b></div>
      <div className="row"><span>Sea-Ice Concentration</span><b>{formatPercent(status.seaIceConcentration)}</b></div>
    </div>
  );
}
