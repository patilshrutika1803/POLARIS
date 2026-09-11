import { createContext, useContext, useState } from 'react';

const NavigationAnalysisContext = createContext(null);

function readStoredAnalysis() {
  try {
    const stored = window.sessionStorage.getItem('polaris-analysis');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function NavigationAnalysisProvider({ children }) {
  const [analysis, setAnalysisState] = useState(readStoredAnalysis);

  function setAnalysis(nextAnalysis) {
    setAnalysisState(nextAnalysis);
    try {
      if (nextAnalysis) window.sessionStorage.setItem('polaris-analysis', JSON.stringify(nextAnalysis));
      else window.sessionStorage.removeItem('polaris-analysis');
    } catch {
      return;
    }
  }

  return <NavigationAnalysisContext.Provider value={{ analysis, setAnalysis }}>{children}</NavigationAnalysisContext.Provider>;
}

export function useNavigationAnalysis() {
  return useContext(NavigationAnalysisContext);
}