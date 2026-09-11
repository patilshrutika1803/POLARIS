import MapView, { DEFAULT_LAYERS } from '../components/MapView.jsx';
import RiskPanel from '../components/RiskPanel.jsx';
import OceanConditionsPanel from '../components/OceanConditionsPanel.jsx';
import SeaIcePanel from '../components/SeaIcePanel.jsx';
import { useNavigationAnalysis } from '../context/NavigationAnalysisContext.jsx';

export default function RiskAnalysis() {
  const { analysis } = useNavigationAnalysis();
  if (!analysis) return <div className="panel" style={{ color: 'var(--muted)' }}>Run a navigation analysis to load risk data.</div>;

  return (
    <div className="risk-grid">
      <div className="risk-center">
        <MapView scene={analysis.scene} routeStatus={analysis.route.route_status} focusMode seaIce={analysis.seaIce} oceanCurrent={analysis.oceanCurrent} layers={DEFAULT_LAYERS} />
      </div>
      <div className="risk-right">
        <RiskPanel route={analysis.route} risk={analysis.risk} />
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OceanConditionsPanel current={analysis.oceanCurrent} />
          <SeaIcePanel seaIce={analysis.seaIce} />
        </div>
      </div>
      <style>{`
        .risk-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,270px);gap:12px;align-items:start;}
        @media (max-width:900px){.risk-grid{grid-template-columns:1fr;}.risk-right{order:2;}}
      `}</style>
    </div>
  );
}
