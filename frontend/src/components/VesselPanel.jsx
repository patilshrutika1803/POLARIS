import { formatCoordinate, formatNumber, formatPercent } from '../utils/formatters.js';

export default function VesselPanel({ vessel }) {
  const heading = Number.isFinite(vessel.headingDeg) ? `${formatNumber(vessel.headingDeg, 1)}°` : 'N/A — not provided';

  return (
    <div className="panel">
      <h4>Vessel</h4>
      <div className="row"><span>Start Coordinates</span><b>{formatCoordinate(vessel.lat)}, {formatCoordinate(vessel.lon)}</b></div>
      <div className="row"><span>Speed</span><b>{formatNumber(vessel.speedKn, 2)} kn</b></div>
      <div className="row"><span>Heading</span><b>{heading}</b></div>
      <div className="row"><span>Ice Capability</span><b>{vessel.iceCapability || 'N/A'}</b></div>
      <div className="row"><span>Maximum Speed</span><b>{formatNumber(vessel.maxSpeedKn, 2)} kn</b></div>
      <div className="row"><span>Max Sea-Ice Concentration</span><b>{formatPercent(vessel.maxSeaIceConcentration)}</b></div>
    </div>
  );
}
