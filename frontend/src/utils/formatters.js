export function formatNumber(value, digits = 2, fallback = 'N/A') {
  return Number.isFinite(value) ? value.toFixed(digits) : fallback;
}

export function formatCoordinate(value, fallback = 'N/A') {
  return Number.isFinite(value) ? `${value.toFixed(4)}°` : fallback;
}

export function formatPercent(value, digits = 1, fallback = 'N/A') {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : fallback;
}

export function formatHours(value, fallback = 'N/A') {
  return Number.isFinite(value) ? `${value.toFixed(2)} hr` : fallback;
}

export function formatTcpA(minutes, hours) {
  const parts = [];
  if (Number.isFinite(hours)) parts.push(`${hours.toFixed(1)} hr`);
  if (Number.isFinite(minutes)) parts.push(`${minutes.toFixed(1)} min`);
  return parts.length ? parts.join(' / ') : 'N/A';
}

export function displayRiskStatus(threatLevel) {
  const normalized = String(threatLevel || '').toUpperCase();
  if (normalized === 'CRITICAL') return 'CRITICAL';
  if (normalized === 'HIGH') return 'HIGH';
  if (normalized === 'MEDIUM' || normalized === 'CAUTION') return 'CAUTION';
  return 'LOW';
}

export function displayRouteStatus(routeStatus) {
  if (routeStatus === 'INFEASIBLE') return 'INFEASIBLE';
  if (routeStatus === 'CAUTION' || routeStatus === 'HAZARDOUS') return 'CAUTION';
  return 'SAFE';
}