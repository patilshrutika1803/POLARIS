import { useState } from "react";
import {
  HashRouter,
  Routes,
  Route
} from "react-router-dom";

import SplashScreen from "./components/SplashScreen";
import WaterBackground from "./components/WaterBackground";
import TopNav from "./components/TopNav";

import Dashboard from "./pages/Dashboard";
import ShipNavigation from "./pages/ShipNavigation";
import IcebergAnalysis from "./pages/IcebergAnalysis";
import RiskAnalysis from "./pages/RiskAnalysis";
import AIAssistant from "./pages/AIAssistant";
import { NavigationAnalysisProvider } from "./context/NavigationAnalysisContext";

export default function App() {

  const [loading, setLoading] = useState(true);

  // POLARIS opening animation
  if (loading) {
    return (
      <SplashScreen
        onComplete={() => setLoading(false)}
      />
    );
  }

  return (
    <NavigationAnalysisProvider>
      <HashRouter>

      <div className="app-shell">

        {/* 🌊 Animated water background */}
        <WaterBackground />

        {/* Navigation */}
        <TopNav />

        {/* Main pages */}
        <Routes>

          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/ship-navigation"
            element={<ShipNavigation />}
          />

          <Route
            path="/iceberg-analysis"
            element={<IcebergAnalysis />}
          />

          <Route
            path="/risk-analysis"
            element={<RiskAnalysis />}
          />

          <Route
            path="/ai-assistant"
            element={<AIAssistant />}
          />

        </Routes>

      </div>

      </HashRouter>
    </NavigationAnalysisProvider>
  );
}