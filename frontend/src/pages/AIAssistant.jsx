import { useState } from 'react';
import { useNavigationAnalysis } from '../context/NavigationAnalysisContext.jsx';

const SUGGESTED = [
  'Why is this route safer?',
  'Where will the iceberg be in 6 hours?',
  'What is the current sea-ice concentration?',
  'What are the ocean currents?',
  'Why did the route avoid this area?',
  'Why was this waypoint selected?',
];

function unavailable() {
  return 'That information is not available in the current analysis.';
}

function explain(question, analysis) {
  if (!analysis) return unavailable();

  const normalized = question.toLowerCase();
  const { route, risk, iceberg_predictions: predictions, environment } = analysis;

  if (normalized.includes('6 hours') || normalized.includes('6-hour')) {
    const position = predictions?.['6_hour'];
    return position
      ? `The backend ML prediction places the iceberg at ${position.latitude.toFixed(5)}°, ${position.longitude.toFixed(5)}° in 6 hours.`
      : unavailable();
  }
  if (normalized.includes('sea-ice') || normalized.includes('sea ice')) {
    return Number.isFinite(environment?.siconc)
      ? `GLORYS12 reports a sea-ice concentration of ${(environment.siconc * 100).toFixed(1)}%.`
      : unavailable();
  }
  if (normalized.includes('current')) {
    return Number.isFinite(environment?.uo_mps) && Number.isFinite(environment?.vo_mps)
      ? `GLORYS12 reports ocean currents of ${environment.uo_mps.toFixed(3)} m/s eastward and ${environment.vo_mps.toFixed(3)} m/s northward, at ${environment.current_speed_knots.toFixed(3)} kn and ${environment.current_heading_deg.toFixed(2)}°.`
      : unavailable();
  }
  if (normalized.includes('safer') || normalized.includes('avoid')) {
    return route.route_status && risk.cpaKm != null
      ? `The backend route is ${route.route_status} with ${route.iceberg_min_clearance_km} km minimum clearance. The risk engine's closest forecast horizon is ${risk.closestHorizon}, at ${risk.cpaKm} km CPA.`
      : unavailable();
  }
  if (normalized.includes('waypoint')) {
    return route.waypoints?.length
      ? `The backend Dijkstra route selected ${route.waypoints.length} waypoints. No more specific waypoint rationale was returned by the analysis.`
      : unavailable();
  }
  return unavailable();
}

export default function AIAssistant() {
  const { analysis } = useNavigationAnalysis();
  const [messages, setMessages] = useState([
    { from: 'ai', text: 'Ask about the route, risks, icebergs, or Antarctic conditions.' },
  ]);
  const [input, setInput] = useState('');

  function send(text) {
    const msg = text ?? input;
    if (!msg.trim()) return;
    setMessages((m) => [
      ...m,
      { from: 'user', text: msg },
      { from: 'ai', text: explain(msg, analysis) },
    ]);
    setInput('');
  }

  return (
    <div className="panel ai-panel">
      <h4>AI Assistant</h4>
      <p style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: -4 }}>
        Explains backend outputs only — it does not generate its own predictions or risk scores.
      </p>

      <div className="ai-suggested">
        {SUGGESTED.map((q) => (
          <button key={q} className="ai-chip" onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <div className="ai-thread">
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', color: m.from === 'ai' ? 'var(--muted)' : 'var(--text)' }}>
            <b style={{ color: m.from === 'ai' ? 'var(--cyan)' : 'var(--text)' }}>{m.from === 'ai' ? 'AI: ' : 'You: '}</b>
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask a question…"
          className="ai-input"
        />
        <button className="btn-main" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => send()}>→</button>
      </div>

      <style>{`
        .ai-panel{max-width:560px;}
        .ai-suggested{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;}
        .ai-chip{background:rgba(255,255,255,.03);border:1px solid var(--panel-border);color:var(--muted);border-radius:14px;padding:5px 11px;font-size:11px;cursor:pointer;font-family:var(--font-sans);}
        .ai-chip:hover{color:var(--text);border-color:var(--cyan);}
        .ai-thread{min-height:120px;font-size:13px;color:var(--muted);}
        .ai-input{flex:1;background:#0a1c28;border:1px solid var(--panel-border);border-radius:6px;color:var(--text);padding:8px 10px;font-size:12.5px;}
      `}</style>
    </div>
  );
}
