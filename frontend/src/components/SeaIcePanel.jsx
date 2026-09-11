import SourceTag from './SourceTag.jsx';
import { formatPercent } from '../utils/formatters.js';

export default function SeaIcePanel({ seaIce }) {
  const pct = Number.isFinite(seaIce.concentration) ? seaIce.concentration * 100 : 0;
  const level = pct < 20 ? 'LOW' : pct < 50 ? 'MEDIUM' : 'HIGH';
  const color = pct < 20 ? 'var(--green)' : pct < 50 ? '#f5c948' : 'var(--red)';

  return (
    <div className="panel">
      <h4>Sea-Ice Conditions<SourceTag>GLORYS12</SourceTag></h4>
      <div className="row"><span>Concentration</span><b>{formatPercent(seaIce.concentration)}</b></div>
      <div className="row"><span>Level</span><b style={{ color }}>{level}</b></div>
      <div style={{ height: 6, borderRadius: 3, background: '#0a1c28', overflow: 'hidden', marginTop: 6 }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 3 }} />
      </div>
      <p className="data-note">Historical reference dataset</p>
    </div>
  );
}
