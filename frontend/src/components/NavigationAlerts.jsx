import { Children } from 'react';
import { useNavigationAnalysis } from '../context/NavigationAnalysisContext.jsx';

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : null;
}

function valueLine(label, value) {
  return value == null ? null : <span key={label} className="navigation-alert__value">{label}: {value}</span>;
}

function buildAlerts(analysis) {
  const route = analysis.route;
  const risk = analysis.risk;
  const environment = analysis.environment;
  const vesselInfo = analysis.request?.vessel_info;
  const routeStatus = route?.route_status;
  const threatLevel = String(risk?.threatLevel || analysis.risk_analysis?.threat_level || '').toUpperCase();
  const criticalRadiusKm = analysis.risk_analysis?.critical_radius_km;
  const clearanceKm = route?.iceberg_min_clearance_km;
  const clearanceIsCritical = Number.isFinite(clearanceKm)
    && Number.isFinite(criticalRadiusKm)
    && clearanceKm <= criticalRadiusKm;
  const alerts = [];

  if (routeStatus === 'INFEASIBLE') {
    alerts.push({
      severity: 'INFEASIBLE',
      title: 'NO SAFE ROUTE',
      explanation: route.reason || 'No safe feasible route was found.',
      values: [valueLine('Route', routeStatus)],
    });
  } else if (threatLevel === 'HIGH' || threatLevel === 'CRITICAL' || routeStatus === 'HAZARDOUS' || clearanceIsCritical) {
    alerts.push({
      severity: 'CRITICAL',
      title: 'CRITICAL NAVIGATION RISK',
      explanation: clearanceIsCritical
        ? `Backend clearance is within the critical threshold of ${criticalRadiusKm} km.`
        : routeStatus === 'HAZARDOUS'
        ? 'The backend route assessment reports a hazardous iceberg clearance.'
        : `The backend risk engine reports a ${threatLevel} threat level.`,
      values: [
        valueLine('Threat', threatLevel || null),
        valueLine('Risk Score', formatNumber(risk?.riskScore, 0) != null ? `${formatNumber(risk.riskScore, 0)}/100` : null),
        valueLine('CPA', formatNumber(risk?.cpaKm, 1) != null ? `${formatNumber(risk.cpaKm, 1)} km` : null),
        valueLine('Route', routeStatus),
      ],
    });
  } else if (routeStatus === 'CAUTION' || threatLevel === 'MEDIUM') {
    alerts.push({
      severity: 'CAUTION',
      title: 'NAVIGATION CAUTION',
      explanation: routeStatus === 'CAUTION'
        ? 'The backend route assessment reports a caution condition.'
        : 'The backend risk engine reports an elevated threat level.',
      values: [
        valueLine('Threat', threatLevel || null),
        valueLine('Risk Score', formatNumber(risk?.riskScore, 0) != null ? `${formatNumber(risk.riskScore, 0)}/100` : null),
        valueLine('CPA', formatNumber(risk?.cpaKm, 1) != null ? `${formatNumber(risk.cpaKm, 1)} km` : null),
        valueLine('Route', routeStatus),
      ],
    });
  } else if (routeStatus === 'SAFE' && threatLevel !== 'HIGH' && threatLevel !== 'CRITICAL') {
    alerts.push({
      severity: 'SAFE',
      title: 'ROUTE ASSESSED SAFE',
      explanation: 'Route is currently assessed as safe.',
      values: [
        valueLine('Risk Score', formatNumber(risk?.riskScore, 0) != null ? `${formatNumber(risk.riskScore, 0)}/100` : null),
        valueLine('CPA', formatNumber(risk?.cpaKm, 1) != null ? `${formatNumber(risk.cpaKm, 1)} km` : null),
        valueLine('Route', routeStatus),
      ],
    });
  }

  const siconc = environment?.siconc ?? analysis.seaIce?.concentration;
  const maxAcceptableSiconc = vesselInfo?.max_acceptable_siconc;
  if (Number.isFinite(siconc) && Number.isFinite(maxAcceptableSiconc) && siconc > maxAcceptableSiconc) {
    alerts.push({
      severity: 'CAUTION',
      title: 'SEA-ICE ADVISORY',
      explanation: 'GLORYS12 sea-ice concentration is above the vessel\'s acceptable concentration.',
      values: [
        valueLine('Sea-Ice', `${Math.round(siconc * 100)}%`),
        valueLine('Vessel Limit', `${Math.round(maxAcceptableSiconc * 100)}%`),
      ],
    });
  }

  if (routeStatus !== 'INFEASIBLE' && (threatLevel === 'HIGH' || threatLevel === 'CRITICAL' || routeStatus === 'HAZARDOUS' || clearanceIsCritical)) {
    alerts.push({
      severity: 'CRITICAL',
      title: 'ICEBERG WARNING',
      explanation: 'Backend iceberg risk data indicates a critical collision concern.',
      values: [
        valueLine('CPA', formatNumber(risk?.cpaKm, 1) != null ? `${formatNumber(risk.cpaKm, 1)} km` : null),
        valueLine('Closest Horizon', risk?.closestHorizon || null),
      ],
    });
  }

  return alerts;
}

export default function NavigationAlerts() {
  const { analysis } = useNavigationAnalysis();

  if (!analysis) {
    return (
      <section className="panel navigation-alerts" aria-labelledby="navigation-alerts-title">
        <h4 id="navigation-alerts-title">Navigation Alerts</h4>
        <p className="navigation-alerts__empty">Run a navigation analysis to load current alerts.</p>
      </section>
    );
  }

  const alerts = buildAlerts(analysis);

  return (
    <section className="panel navigation-alerts" aria-labelledby="navigation-alerts-title">
      <h4 id="navigation-alerts-title">Navigation Alerts</h4>
      <div className="navigation-alerts__list">
        {alerts.map((alert, index) => (
          <article className={`navigation-alert navigation-alert--${alert.severity.toLowerCase()}`} key={`${alert.title}-${index}`}>
            <div className="navigation-alert__heading">
              <span className="navigation-alert__severity">{alert.severity}</span>
              <strong>{alert.title}</strong>
            </div>
            <p>{alert.explanation}</p>
            <div className="navigation-alert__values">{Children.toArray(alert.values.filter(Boolean))}</div>
          </article>
        ))}
      </div>
    </section>
  );
}