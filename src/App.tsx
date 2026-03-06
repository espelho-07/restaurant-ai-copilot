import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RestaurantDataProvider } from "@/lib/restaurantData";
import { AuthProvider, ProtectedRoute, PublicRoute } from "@/components/AuthProvider";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import MenuIntelligence from "./pages/MenuIntelligence";
import ComboEngine from "./pages/ComboEngine";
import VoiceCopilot from "./pages/VoiceCopilot";
import Insights from "./pages/Insights";
import RestaurantSetup from "./pages/RestaurantSetup";
import OrdersSimulation from "./pages/OrdersSimulation";
import Orders from "./pages/Orders";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import ContributionMargin from "./pages/ContributionMargin";
import ItemProfitability from "./pages/ItemProfitability";
import SalesVelocity from "./pages/SalesVelocity";
import HiddenStars from "./pages/HiddenStars";
import LowMarginRisk from "./pages/LowMarginRisk";
import SmartUpsell from "./pages/SmartUpsell";
import PriceOptimization from "./pages/PriceOptimization";
import PlatformSettings from "./pages/PlatformSettings";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const PublicPage = ({ children }: { children: React.ReactNode }) => (
  <PublicRoute>{children}</PublicRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RestaurantDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />

              <Route path="/login" element={<PublicPage><Login /></PublicPage>} />

              <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
              <Route path="/setup" element={<ProtectedPage><RestaurantSetup /></ProtectedPage>} />
              <Route path="/menu" element={<ProtectedPage><MenuIntelligence /></ProtectedPage>} />
              <Route path="/pos" element={<ProtectedPage><OrdersSimulation /></ProtectedPage>} />
              <Route path="/orders" element={<ProtectedPage><Orders /></ProtectedPage>} />
              <Route path="/combos" element={<ProtectedPage><ComboEngine /></ProtectedPage>} />
              <Route path="/voice" element={<ProtectedPage><VoiceCopilot /></ProtectedPage>} />
              <Route path="/insights" element={<ProtectedPage><Insights /></ProtectedPage>} />

              <Route path="/contribution-margin" element={<ProtectedPage><ContributionMargin /></ProtectedPage>} />
              <Route path="/item-profitability" element={<ProtectedPage><ItemProfitability /></ProtectedPage>} />
              <Route path="/sales-velocity" element={<ProtectedPage><SalesVelocity /></ProtectedPage>} />
              <Route path="/hidden-stars" element={<ProtectedPage><HiddenStars /></ProtectedPage>} />
              <Route path="/low-margin-risk" element={<ProtectedPage><LowMarginRisk /></ProtectedPage>} />
              <Route path="/smart-upsell" element={<ProtectedPage><SmartUpsell /></ProtectedPage>} />
              <Route path="/price-optimization" element={<ProtectedPage><PriceOptimization /></ProtectedPage>} />
              <Route path="/platform-settings" element={<ProtectedPage><PlatformSettings /></ProtectedPage>} />
              <Route path="/coming-soon" element={<ProtectedPage><ComingSoon /></ProtectedPage>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RestaurantDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;