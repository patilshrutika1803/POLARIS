# POLARIS

AI-enabled Antarctic iceberg trajectory prediction and safe navigation decision-support system.

POLARIS combines a trained machine-learning iceberg forecast with GLORYS12 environmental reference data, sea-ice concentration checks, CPA/TCPA-inspired risk analysis, vessel-specific constraints, Dijkstra-based route optimization, interactive React + Three.js visualization, and an AI Assistant explanation layer that interprets the actual analysis outputs.

---

## Problem Statement

Antarctic navigation is shaped by dynamic sea-ice, ocean current variability, and the uncertain motion of icebergs. In operational decision support, a vessel operator needs more than a single static map: they need a grounded forecast of iceberg motion, environmental context, a risk assessment, and a route recommendation that can be evaluated with human judgment.

POLARIS is designed as a prototype decision-support system for this problem. It integrates:

- a trained iceberg trajectory model based on real B15A data,
- historical GLORYS12 reference data for environmental context,
- sea-ice concentration controls,
- vessel-aware risk evaluation,
- route optimization under operational constraints,
- and a front-end visualization layer for interactive review.

This is not presented as a certified maritime navigation system or an autonomous vessel control system.

## Objectives

- Forecast iceberg movement over short and medium horizons.
- Combine iceberg drift prediction with ocean/environmental lookup.
- Evaluate collision risk using vessel position, predicted iceberg positions, and proximity metrics.
- Respect vessel sea-ice constraints during route planning.
- Produce a clear route recommendation using constrained graph optimization.
- Provide a human-readable explanation layer over the real analysis outputs.
- Present the system in a web dashboard for exploration and review.

## Key Features

- RandomForestRegressor-based iceberg trajectory prediction
- GLORYS12 environmental lookups for ocean current and sea-ice context
- CPA/TCPA-inspired proximity analysis from the risk engine
- Dijkstra route optimization over a risk-weighted spatial grid
- Vessel-aware route blocking when sea-ice concentration exceeds the allowable threshold
- React + Vite frontend with interactive 3D visualizations
- AI Assistant that explains actual backend results rather than generating independent decisions

## System Architecture

```text
User
  ↓
React / Three.js Frontend
  ↓
FastAPI
  ↓
Iceberg ML Prediction
  +
GLORYS12 Environmental Lookup
  +
Risk Engine
  ↓
Dijkstra Navigation
  ↓
Unified Analysis Response
  ↓
3D Visualization
  +
AI Assistant Explanation Layer
  ↓
Human Decision
```

## End-to-End Data Flow

```text
User Inputs
→ API Request
→ Feature Preparation
→ Iceberg Prediction
→ Environmental Lookup
→ Risk Analysis
→ Route Optimization
→ Unified Response
→ Visualization
→ AI Explanation
→ Human Decision
```

## Machine Learning Pipeline

The backend loads a frozen machine-learning model from `backend/iceberg_model.pkl` and uses a feature-extraction step based on B15A records to create the required 16-feature input vector.

The active model is:

- `RandomForestRegressor`
- 20 existing trained trees in the deployed model
- `random_state = 42`
- 16 input features
- 6 outputs

The current deployment model was created by reducing the original 35-tree model to 20 existing trained trees to reduce deployment memory usage. It was not retrained with a new max-depth specification. The project documentation and model validation work reflect this frozen, reduced-tree deployment configuration.

Validation carried out on the model files indicates:

- Original model size: 31.32 MB
- Optimized model size: 17.89 MB
- File-size reduction: 42.88%
- Approximate working-set memory reduction: 41.8 MB

The 20-tree model was validated against five real B15A sample comparisons and produced finite, geographically valid six-output predictions.

## ML Features

The model expects exactly these 16 input features in this order:

1. latitude
2. longitude
3. bottom_temp
4. top_temp
5. humidity
6. wind_speed
7. pressure
8. solar
9. snow_distance
10. hour_of_day
11. day_of_year
12. sin_hour
13. cos_hour
14. displacement
15. speed
16. bearing

These values are constructed in `backend/services/feature_extractor.py` from the real B15A Wanderer time series. The source record selection uses a complete motion pair, and the feature extraction verifies finite numbers and valid geographic bounds.

## ML Outputs

The model outputs six values in this order:

1. `lat_20m`
2. `lon_20m`
3. `lat_1h`
4. `lon_1h`
5. `lat_6h`
6. `lon_6h`

These are represented in the backend as a nested dict with current, 20-minute, 1-hour, and 6-hour iceberg coordinates:

- `current`
- `20_min`
- `1_hour`
- `6_hour`

The time horizons refer to:

- 20 minutes
- 1 hour
- 6 hours

The backend interprets the six output values as the predicted iceberg coordinates at each horizon.

## Environmental / GLORYS12 Integration

POLARIS loads a bundled historical NetCDF reference dataset from:

- `backend/data/GLORYS12.nc`

The environmental service in `backend/services/environment.py` reads:

- `uo` (ocean zonal velocity)
- `vo` (ocean meridional velocity)
- `siconc` (sea-ice concentration)

It performs a safe lookup around the user's coordinate, clamps coordinates to the dataset bounds when necessary, and returns:

- `uo_mps`
- `vo_mps`
- `siconc`
- `current_speed_mps`
- `current_speed_knots`
- `current_heading_deg`
- lookup metadata and status

Important limitation: GLORYS12 is a historical/reference dataset, not a live environmental data stream. This is an intentional current limitation of the implementation.

## Risk Analysis

The backend risk engine in `backend/services/risk_engine.py` evaluates proximity between the vessel start position and the iceberg forecast points.

The risk model computes:

- closest point of approach (CPA) in kilometers and nautical miles,
- time to CPA (TCPA),
- closest forecast horizon,
- per-horizon distances,
- severity classification (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`),
- composite risk score on a 0–100 scale.

The engine uses the vessel start location as the reference point for the public risk calculation, not the destination, and it explicitly avoids implying a destination-based risk formula.

## CPA and TCPA

The project uses a CPA/TCPA-style risk formulation grounded in the iceberg forecast and vessel start position.

The risk engine computes:

- closest forecast distance to the vessel,
- time-to-closest approach based on vessel speed,
- corresponding CPA in km and NM,
- risk severity based on distance thresholds.

The implemented risk thresholds are:

- critical radius: `2.0 km`
- warning radius: `10.0 km` (used in the risk scoring logic) and `12.0 km` in the route optimization safety checks

This is consistent with the code and is treated as a decision-support approximation rather than a formal regulatory collision model.

## Vessel-Aware Navigation

The backend API accepts a vessel payload containing:

- `speed_knots`
- `max_acceptable_siconc`
- optional `heading`

The route optimizer evaluates sea-ice concentration at grid cells and blocks cells where the concentration exceeds the vessel’s acceptable threshold. This is a vessel-aware constraint layer in addition to iceberg proximity risk.

## Dijkstra Route Optimization

The routing engine in `backend/services/navigation.py` uses Dijkstra’s algorithm over a risk-weighted grid.

The route cost is framed in code as:

`Route Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty`

The optimizer:

- builds a bounded grid around start, destination, and forecast iceberg positions,
- evaluates environmental conditions at each node,
- applies sea-ice blocking and iceberg proximity penalties,
- avoids blocked or unsafe nodes,
- reconstructs a waypoint path from the start to the destination.

The response includes fields such as:

- `algorithm`
- `waypoints`
- `waypoint_count`
- `total_distance_nm`
- `total_distance_km`
- `estimated_hours`
- `estimated_minutes`
- `route_cost`
- `iceberg_min_clearance_km`
- `route_status`
- `reason`
- `cost_formula`

## Interactive 3D Visualization

The frontend uses React + Vite and renders a 3D map using:

- `three`
- `@react-three/fiber`
- `@react-three/drei`

The interface presents:

- ship start point,
- destination point,
- iceberg current position,
- future iceberg forecast points,
- recommended route waypoints,
- risk zones,
- ocean current arrows,
- sea-ice overlay.

The app includes routes and pages such as:

- Dashboard
- Ship Navigation
- Iceberg Analysis
- Risk Analysis
- AI Assistant

The user-facing experience is interactive, but it remains a visualization layer over actual backend analysis outputs rather than a separate autonomous decision engine.

## AI Assistant

The AI Assistant is an explanation layer over established POLARIS analysis results. It is implemented in the frontend and responds to questions about:

- route safety,
- iceberg forecast positions,
- GLORYS12 sea-ice concentration,
- ocean current conditions,
- route clearance and waypoint choice.

It explains actual outputs from the backend analysis. It does not generate its own predictions, risk scores, or navigation decisions.

The current assistant is intentionally grounded in the existing analysis flow and supports the human-in-the-loop decision process. It is best understood as a reasoning aid, not as an autonomous vessel controller.

## Backend API

The primary backend API is:

- `POST /navigation/analyze`

The FastAPI app is defined in `backend/main.py` and exposes:

- `GET /` health status endpoint
- `POST /navigation/analyze` navigation analysis endpoint

### Request format

The request body for `POST /navigation/analyze` is modeled as:

```json
{
  "start": {
    "latitude": -60.25,
    "longitude": 151.0
  },
  "destination": {
    "latitude": -60.5,
    "longitude": 154.41668701171875
  },
  "vessel_info": {
    "speed_knots": 12.0,
    "max_acceptable_siconc": 0.4,
    "heading": 90.0
  },
  "trajectory_index": 12
}
```

The relevant request fields are:

- `start.latitude` and `start.longitude`
- `destination.latitude` and `destination.longitude`
- `vessel_info.speed_knots`
- `vessel_info.max_acceptable_siconc`
- `vessel_info.heading` (optional)
- `trajectory_index` (optional integer used to select a B15A motion pair)

### Response format

The successful response structure is:

```json
{
  "status": "SUCCESS",
  "iceberg_predictions": {
    "current": { "latitude": -76.85589, "longitude": 168.5241 },
    "20_min": { "latitude": -76.86, "longitude": 168.53 },
    "1_hour": { "latitude": -76.87, "longitude": 168.55 },
    "6_hour": { "latitude": -76.92, "longitude": 168.58 }
  },
  "glorys12_environment": {
    "latitude": -76.85589,
    "longitude": 168.5241,
    "siconc": 0.1234,
    "uo_mps": 0.05,
    "vo_mps": -0.03,
    "current_speed_knots": 0.12,
    "current_heading_deg": 200.5,
    "status": "OK"
  },
  "risk_analysis": {
    "closest_point_of_approach_km": 12.4,
    "closest_point_of_approach_nm": 6.7,
    "time_to_cpa_hours": 0.7,
    "threat_level": "HIGH",
    "risk_score": 72.6
  },
  "recommended_route": {
    "algorithm": "Dijkstra",
    "route_status": "SAFE",
    "waypoints": [
      { "latitude": -60.25, "longitude": 151.0 },
      { "latitude": -60.3, "longitude": 152.0 }
    ],
    "total_distance_nm": 44.25,
    "estimated_hours": 3.69
  }
}
```

The root `GET /` endpoint returns a lightweight health payload such as:

```json
{
  "status": "ONLINE",
  "service": "Iceberg Trajectory & Navigation Backend",
  "model_loaded": true,
  "glorys_loaded": true
}
```

## Project Structure

```text
POLARIS/
├── .gitattributes
├── .gitignore
├── README.md
├── predict.py
├── backend/
│   ├── .venv/
│   ├── B15A_Wanderer_2008.txt
│   ├── GLORYS12.nc
│   ├── data/
│   │   └── GLORYS12.nc
│   ├── demo_backend.py
│   ├── iceberg_model.pkl
│   ├── iceberg_model_20trees.pkl
│   ├── iceberg_model_35trees_backup.pkl
│   ├── main.py
│   ├── predict.py
│   ├── requirements.txt
│   ├── test_api.py
│   ├── test_environment.py
│   ├── test_environment_valid_cell.py
│   ├── test_feature_extractor.py
│   ├── test_glorys.py
│   ├── test_model.py
│   ├── test_navigation.py
│   ├── test_navigation_feasible.py
│   ├── test_risk.py
│   └── services/
│       ├── environment.py
│       ├── feature_extractor.py
│       ├── navigation.py
│       ├── navigation_backup.py
│       └── risk_engine.py
├── frontend/
│   ├── .env
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api/
│       │   └── polarisApi.js
│       ├── components/
│       │   ├── ForecastHorizonSelector.jsx
│       │   ├── MapLayersPanel.jsx
│       │   ├── MapView.jsx
│       │   ├── NavigationAlerts.jsx
│       │   ├── NavStatusPanel.jsx
│       │   ├── OceanConditionsPanel.jsx
│       │   ├── RiskPanel.jsx
│       │   ├── SeaIcePanel.jsx
│       │   ├── SourceTag.jsx
│       │   ├── SplashScreen.css
│       │   ├── SplashScreen.jsx
│       │   ├── TopNav.jsx
│       │   ├── VesselPanel.jsx
│       │   ├── WaterBackground.css
│       │   └── WaterBackground.jsx
│       ├── context/
│       │   └── NavigationAnalysisContext.jsx
│       ├── main.jsx
│       ├── pages/
│       │   ├── AIAssistant.jsx
│       │   ├── Dashboard.jsx
│       │   ├── IcebergAnalysis.jsx
│       │   ├── RiskAnalysis.jsx
│       │   └── ShipNavigation.jsx
│       ├── styles/
│       │   ├── global.css
│       │   └── tokens.css
│       └── utils/
│           └── formatters.js
└── backend/.venv/
```

## Technology Stack

| Area | Technologies used in the current project |
| --- | --- |
| Frontend | React, Vite, Three.js, React Three Fiber, Drei, React Router |
| Backend | Python, FastAPI, Uvicorn, Pydantic, NumPy, Pandas, Xarray, NetCDF4, Joblib, Scikit-learn |
| ML | RandomForestRegressor |
| Analysis | CPA / TCPA-inspired proximity assessment, risk scoring, Dijkstra route optimization |
| Data | GLORYS12 NetCDF reference dataset, B15A source records |

## Local Setup

### Backend

From the repository root:

```powershell
cd backend

# Create a virtual environment if needed
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend is served locally on:

- `http://127.0.0.1:8000`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend development server runs with Vite on the default local port and uses the Vite environment variable `VITE_API_BASE_URL` to point at the backend.

Current project configuration in `frontend/.env`:

```env
VITE_API_BASE_URL=https://polaris-5v3y.onrender.com
```

If running locally without a deployment override, the frontend client falls back to:

```text
http://127.0.0.1:8000
```

## Backend Setup

The backend is built around `backend/main.py` and the prediction/environment/risk/navigation services.

Start the backend with:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

The application loads the model at startup and initializes the GLORYS12 dataset service. The FastAPI app provides the health check and the navigation analysis logic.

## Frontend Setup

The frontend is a Vite + React application located in `frontend/`.

Run:

```powershell
cd frontend
npm install
npm run dev
```

The application is routed through the `HashRouter`, and the main pages include:

- `/` Dashboard
- `/ship-navigation`
- `/iceberg-analysis`
- `/risk-analysis`
- `/ai-assistant`

## Environment Configuration

The relevant environment configuration is currently defined in `frontend/.env`:

```env
VITE_API_BASE_URL=https://polaris-5v3y.onrender.com
```

This points the frontend at the deployed Render API. Local development can also be pointed to the local FastAPI instance by changing the environment variable or removing the override in the frontend shell.

No secrets or API keys are required by the current codebase.

## Deployment Architecture

The current deployment pattern is:

```text
Vercel React frontend
  ↓
HTTPS
  ↓
Render FastAPI backend
  ↓
ML + GLORYS12 + Risk + Navigation
```

This matches the active frontend environment variable and backend hosting pattern used in the project: the frontend is deployed on Vercel, while the API is hosted on Render.

Render free instances may spin down after inactivity, which can cause the first request to take longer to respond.

## Validation / Testing

The project contains validation logic and checks for the actual pipeline, including:

- ML model loading
- 16-feature compatibility
- six-output prediction
- five real B15A sample comparison
- finite and geographically valid predictions
- FastAPI startup
- `GET /` verification
- `model_loaded` verification
- `glorys_loaded` verification
- `POST /navigation/analyze` request validation
- frontend-to-backend integration pattern
- Vercel-to-Render production integration

Relevant validation scripts in the repository include:

- `backend/test_model.py`
- `backend/test_api.py`
- `backend/test_feature_extractor.py`
- `backend/test_environment.py`
- `backend/test_glorys.py`
- `backend/test_navigation.py`
- `backend/test_navigation_feasible.py`
- `backend/test_risk.py`

No unsupported claim of additional automated pass counts is included here.

## Model Optimization

The deployed model represents a memory-optimized frozen version of the original model.

Project validation details:

- original model size: 31.32 MB
- optimized model size: 17.89 MB
- file-size reduction: 42.88%
- approximate working-set memory reduction: 41.8 MB

This was achieved by reducing the number of retained trees from 35 to 20 in the deployed artifact. The documentation intentionally does not claim a newly retrained model with a different `max_depth` because the current deployed model is a retained/optimized frozen artifact.

## Current Limitations

POLARIS is a decision-support prototype and not a certified maritime navigation system.

Known limitations currently reflected in the codebase:

- GLORYS12 is a historical/reference dataset and not a live ocean data stream.
- Route optimization is based on a risk-weighted graph and not a full vessel motion model.
- The current AI Assistant explains results but does not independently generate a navigation recommendation.
- The project is designed for research and prototype evaluation rather than operational maritime certification.

## Future Improvements

The following are explicitly future work and not currently implemented as a production feature set:

- Live or rolling ocean data ingestion
- Multi-iceberg tracking and interaction
- Improved CPA/TCPA modeling with broader vessel dynamics
- Expanded regional and seasonal coverage
- More advanced route optimization with dynamic constraints
- Real-time alerts and monitoring
- Expanded vessel profiles and operational rules
- Formal automated testing pipeline and CI validation
- Model retraining and validation workflow improvements

## Human-in-the-Loop Safety

POLARIS is designed to support human decision-making rather than replace it.

The system highlights:

- predicted iceberg risk,
- environmental conditions,
- route feasibility,
- and reasoning behind the current recommendation,

but the final navigational decision remains with the operator. This is consistent with the project’s explanatory AI layer and the decision-support framing of the application.

## Disclaimer

POLARIS is an Antarctic navigation decision-support prototype built for exploration, evaluation, and demonstration.

It is not a substitute for:

- certified maritime navigation systems,
- professional pilotage,
- operational ice navigation guidance,
- or regulatory decision-making.

All results should be reviewed by a qualified operator in the context of operational conditions, local expertise, and current navigational rules.

## Current Project Status

The repository reflects a working prototype with the following active components:

- B15A feature extraction pipeline
- RandomForestRegressor inference on a frozen model
- GLORYS12 environmental lookup service
- risk analysis engine
- Dijkstra route optimizer
- FastAPI backend endpoint
- React + Three.js frontend experience
- AI Assistant explanation layer

The implementation is not presented as a finished commercial product, but it is a functioning end-to-end prototype demonstrating the main data flow from iceberg forecasting to route recommendation and explanation.

---

## Quick Start

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd ..\frontend
npm install
npm run dev
```

---

## Summary

POLARIS demonstrates a practical, prototype-level workflow for Antarctic iceberg forecasting and safe-route decision support: the system ingests real B15A-derived features, predicts future iceberg positions, checks the environmental context, scores risk, optimizes a route under sea-ice constraints, and presents the results in a clear interactive interface.

The project remains transparent about what is operationally implemented today and what is intentionally left as future improvement.
