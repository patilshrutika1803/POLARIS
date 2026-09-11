import SourceTag from './SourceTag.jsx';
import { formatNumber } from '../utils/formatters.js';

export default function OceanConditionsPanel({ current }) {
  return (
    <div className="panel">
      <h4>Ocean Conditions<SourceTag>GLORYS12</SourceTag></h4>
      <div className="row"><span>Eastward (uo)</span><b>{formatNumber(current.uo, 2)} m/s</b></div>
      <div className="row"><span>Northward (vo)</span><b>{formatNumber(current.vo, 2)} m/s</b></div>
      <div className="row"><span>Current Speed</span><b>{formatNumber(current.speedKn, 3)} kn</b></div>
      <div className="row"><span>Direction</span><b>{formatNumber(current.directionDeg, 1)}°</b></div>
      <p className="data-note">Historical reference dataset</p>
    </div>
  );
}
