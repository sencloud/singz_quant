import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Trading from './pages/Trading';
import Research from './pages/Research';
import StrategyAdvicePage from './pages/StrategyAdvicePage';
import CoreFactorAnalysisPage from './pages/CoreFactorAnalysisPage';
import OptionsStrategyPage from './pages/OptionsStrategyPage';
import ProAnalysis from './pages/ProAnalysis';
import NewsAnalysis from './pages/NewsAnalysis';
import Agents from './pages/Agents';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Disclaimer from './pages/Disclaimer';
import Signals from './pages/Signals';
import MultiVarietyArbitrage from './pages/MultiVarietyArbitrage';
import StockFutures from './pages/pro/StockFutures';
import SoybeanImport from './pages/pro/SoybeanImport';
import MarketView from './pages/MarketView';
import HoldingAnalysis from './pages/HoldingAnalysis';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/research" element={<Research />} />
          <Route path="/research/strategy-advice" element={<StrategyAdvicePage />} />
          <Route path="/research/core-factor" element={<CoreFactorAnalysisPage />} />
          <Route path="/research/options-strategy" element={<OptionsStrategyPage />} />
          <Route path="/pro-analysis" element={<ProAnalysis />} />
          <Route path="/pro/stock-futures" element={<StockFutures />} />
          <Route path="/pro/soybean-import" element={<SoybeanImport />} />
          <Route path="/news-analysis" element={<NewsAnalysis />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/multi-variety-arbitrage" element={<MultiVarietyArbitrage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/market" element={<MarketView />} />
          <Route path="/holding-analysis" element={<HoldingAnalysis />} />
          {/* 其他路由将在后续添加 */}
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App; 