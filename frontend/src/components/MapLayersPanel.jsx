// Toggle list controlling which layers MapView renders. `layers` /
// `onToggle` are lifted to the parent page so Dashboard and Iceberg
// Analysis can share the same control pattern.
const LABELS = {
  seaIce: 'Sea-Ice Layer',
  icebergs: 'Iceberg Markers',
  trajectories: 'Predicted Trajectories',
  riskZones: 'Risk Zones',
  currents: 'Ocean Currents',
  recommendedRoute: 'Recommended Route',
  waypoints: 'Waypoints',
};

export default function MapLayersPanel({ layers, onToggle }) {
  return (
    <div className="panel">
      <h4>Map Layers</h4>
      {Object.keys(LABELS).map((key) => (
        <label
          key={key}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)', margin: '7px 0', cursor: 'pointer' }}
        >
          <input type="checkbox" checked={layers[key]} onChange={() => onToggle(key)} style={{ accentColor: 'var(--cyan)' }} />
          {LABELS[key]}
        </label>
      ))}
    </div>
  );
}
