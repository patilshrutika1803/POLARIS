const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export class NavigationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NavigationValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (error) {
    const networkError = new Error('Unable to reach the POLARIS backend.');
    networkError.code = 'NETWORK_ERROR';
    networkError.cause = error;
    throw networkError;
  }

  let payload;
  try {
    payload = await res.json();
  } catch (error) {
    const parseError = new Error('POLARIS backend returned invalid JSON.');
    parseError.code = 'PARSE_ERROR';
    parseError.cause = error;
    throw parseError;
  }

  if (!res.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : `HTTP ${res.status}`;
    const httpError = new Error(`POLARIS API error: ${detail}`);
    httpError.code = 'HTTP_ERROR';
    httpError.status = res.status;
    throw httpError;
  }
  return payload;
}

function mapPosition(position, name) {
  if (!position) {
    throw new NavigationValidationError(`${name} position is required.`);
  }

  const latitude = Number.isFinite(position.latitude) ? position.latitude : position.lat;
  const longitude = Number.isFinite(position.longitude) ? position.longitude : position.lon;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new NavigationValidationError(`${name} latitude and longitude are required.`);
  }

  return { latitude, longitude };
}

function mapVesselInfo(vessel) {
  if (!vessel || !Number.isFinite(vessel.speedKn) || !Number.isFinite(vessel.maxSeaIceConcentration)) {
    throw new NavigationValidationError('Vessel speed and maximum sea-ice concentration are required.');
  }

  return {
    speed_knots: vessel.speedKn,
    max_acceptable_siconc: vessel.maxSeaIceConcentration,
    ...(Number.isFinite(vessel.headingDeg) ? { heading: vessel.headingDeg } : {}),
  };
}


export async function analyzeRoute({ start, destination, vessel, trajectoryIndex = null }) {
  const body = {
    start: mapPosition(start, 'Start'),
    destination: mapPosition(destination, 'Destination'),
    vessel_info: mapVesselInfo(vessel),
    ...(Number.isInteger(trajectoryIndex) ? { trajectory_index: trajectoryIndex } : {}),
  };

  const response = await request('/navigation/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (response?.status !== 'SUCCESS' || !response.recommended_route || !response.risk_analysis || !response.iceberg_predictions) {
    throw new Error('POLARIS backend returned an incomplete navigation analysis.');
  }
  return normalizeAnalysis(response, body, vessel);
}

export function mapBackendWaypoint(waypoint, index) {
  return { id: `WP-${index + 1}`, latitude: waypoint.latitude, longitude: waypoint.longitude, color: '#3ee6ff' };
}

export function mapBackendIceberg(predictions, risk) {
  const current = predictions?.current;
  if (!Number.isFinite(current?.latitude) || !Number.isFinite(current?.longitude)) return null;

  const forecast = { min20: predictions['20_min'], hr1: predictions['1_hour'], hr6: predictions['6_hour'] };
  const riskLevel = risk.threat_level === 'CRITICAL' || risk.threat_level === 'HIGH'
    ? 'high' : risk.threat_level === 'MEDIUM' ? 'medium' : 'none';
  return {
    id: 'iceberg-trajectory', latitude: current.latitude, longitude: current.longitude,
    radiusKm: risk.warning_radius_km ?? 10, riskLevel, forecast,
    currentLat: current.latitude, currentLon: current.longitude,
    speedKn: null, bearingDeg: null,
  };
}

export function mapBackendRisk(risk) {
  return {
    riskScore: risk.risk_score, threatLevel: risk.threat_level,
    cpaKm: risk.closest_point_of_approach_km,
    cpaNm: risk.closest_point_of_approach_nm,
    tcpaHours: risk.time_to_cpa_hours,
    tcpaMinutes: risk.time_to_cpa_minutes,
    closestHorizon: risk.closest_horizon,
    horizonDistancesKm: risk.horizon_distances_km,
  };
}

export function normalizeAnalysis(response, requestBody, vesselInput = {}) {
  const route = response.recommended_route;
  const risk = mapBackendRisk(response.risk_analysis);
  const environment = response.glorys12_environment;
  const iceberg = mapBackendIceberg(response.iceberg_predictions, response.risk_analysis);
  const waypoints = Array.isArray(route.waypoints) ? route.waypoints.map(mapBackendWaypoint) : [];
  const icebergs = iceberg ? [iceberg] : [];
  const request = { ...requestBody, vessel: { ...vesselInput } };

  return {
    ...response, request, route, risk, environment, icebergs,
    scene: { ship: requestBody.start, destination: requestBody.destination, icebergs, waypoints },
    oceanCurrent: { uo: environment.uo_mps, vo: environment.vo_mps, speedKn: environment.current_speed_knots, directionDeg: environment.current_heading_deg },
    seaIce: { concentration: environment.siconc },
    vessel: {
      lat: requestBody.start.latitude,
      lon: requestBody.start.longitude,
      speedKn: requestBody.vessel_info.speed_knots,
      headingDeg: requestBody.vessel_info.heading ?? null,
      type: vesselInput.type || null,
      iceCapability: vesselInput.iceCapability || null,
      maxSpeedKn: Number.isFinite(vesselInput.maxSpeedKn) ? vesselInput.maxSpeedKn : null,
      maxSeaIceConcentration: requestBody.vessel_info.max_acceptable_siconc,
    },
    status: {
      routeStatus: route.route_status,
      distanceKm: route.total_distance_km,
      etaHours: route.estimated_hours,
      currentRisk: response.risk_analysis.threat_level,
      nearbyIcebergs: icebergs.length,
      seaIceConcentration: environment.siconc,
      destination: requestBody.destination,
    },
  };
}
