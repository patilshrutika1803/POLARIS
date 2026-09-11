"""
backend/main.py

FastAPI Web Service for Maritime Risk Analysis & Route Optimization Backend.
Provides POST /navigation/analyze endpoint connecting iceberg ML predictions, GLORYS12 ocean lookup,
collision risk scoring, and Dijkstra route optimization.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from predict import is_model_loaded, load_model, predict_trajectory, PredictionServiceError
from services.environment import EnvironmentServiceError, GLORYSEnvironment
from services.feature_extractor import FeatureExtractionError, extract_features
from services.navigation import DijkstraRouteOptimizer
from services.risk_engine import RiskEngine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        load_model()
    except PredictionServiceError:
        logger.exception("Iceberg prediction model could not be loaded during startup")
    yield


app = FastAPI(
    title="Iceberg Trajectory & Navigation Backend API",
    description="Backend risk analysis and Dijkstra optimal routing integrating frozen ML iceberg predictions and GLORYS12 environmental data.",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

env_service = GLORYSEnvironment()
risk_service = RiskEngine()
nav_service = DijkstraRouteOptimizer(environment=env_service)


class Position(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, examples=[-76.80])
    longitude: float = Field(..., ge=-180.0, le=180.0, examples=[168.40])


class VesselInfo(BaseModel):
    speed_knots: float = Field(default=12.0, ge=0.0, examples=[12.0])
    max_acceptable_siconc: float = Field(default=0.4, ge=0.0, le=1.0, examples=[0.4])
    heading: float | None = Field(default=None, ge=0.0, le=360.0, examples=[90.0])


class NavigationRequest(BaseModel):
    start: Position
    destination: Position
    vessel_info: VesselInfo
    trajectory_index: int | None = Field(
        default=None,
        ge=1,
        description="Optional zero-based B15A source record index; defaults to the first complete motion pair.",
    )


@app.get("/")
def health_check():
    return {
        "status": "ONLINE",
        "service": "Iceberg Trajectory & Navigation Backend",
        "model_loaded": is_model_loaded(),
        "glorys_loaded": env_service.ds is not None,
    }


@app.post("/navigation/analyze")
def analyze_navigation(request: NavigationRequest):
    """Run B15A feature extraction, ML, GLORYS12, risk, and route analysis."""
    try:
        start_dict = request.start.model_dump()
        dest_dict = request.destination.model_dump()
        vessel = request.vessel_info

        iceberg_features = extract_features(request.trajectory_index)
        iceberg_predictions = predict_trajectory(iceberg_features)
        env_data = env_service.get_environmental_data(start_dict["latitude"], start_dict["longitude"])
        risk_info = risk_service.evaluate_risk(
            vessel_start=start_dict,
            vessel_dest=dest_dict,
            iceberg_predictions=iceberg_predictions,
            vessel_speed_knots=vessel.speed_knots,
        )
        route_info = nav_service.optimize_route(
            start=start_dict,
            destination=dest_dict,
            iceberg_predictions=iceberg_predictions,
            vessel_speed_knots=vessel.speed_knots,
            max_acceptable_siconc=vessel.max_acceptable_siconc,
        )

        return {
            "status": "SUCCESS",
            "iceberg_predictions": iceberg_predictions,
            "glorys12_environment": env_data,
            "risk_analysis": risk_info,
            "recommended_route": route_info,
        }
    except FeatureExtractionError as exc:
        logger.warning("B15A feature extraction rejected navigation request: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (EnvironmentServiceError, FileNotFoundError) as exc:
        logger.exception("GLORYS12 service failure", exc_info=exc)
        raise HTTPException(status_code=503, detail="GLORYS12 environmental service unavailable") from exc
    except PredictionServiceError as exc:
        logger.exception("Prediction service failure", exc_info=exc)
        raise HTTPException(status_code=503, detail="Iceberg prediction service unavailable") from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected navigation pipeline failure", exc_info=exc)
        raise HTTPException(status_code=500, detail="Navigation pipeline failed") from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
