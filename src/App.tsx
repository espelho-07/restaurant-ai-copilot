import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RestaurantDataProvider } from "@/lib/restaurantData";
import { AuthProvider } from "@/components/AuthProvider";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RestaurantDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Landing page */}
              <Route path="/" element={<Index />} />

              {/* All app pages — no auth required */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/setup" element={<RestaurantSetup />} />
              <Route path="/menu" element={<MenuIntelligence />} />
              <Route path="/pos" element={<OrdersSimulation />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/combos" element={<ComboEngine />} />
              <Route path="/voice" element={<VoiceCopilot />} />
              <Route path="/insights" element={<Insights />} />

              {/* AI Module Detail Pages */}
              <Route path="/contribution-margin" element={<ContributionMargin />} />
              <Route path="/item-profitability" element={<ItemProfitability />} />
              <Route path="/sales-velocity" element={<SalesVelocity />} />
              <Route path="/hidden-stars" element={<HiddenStars />} />
              <Route path="/low-margin-risk" element={<LowMarginRisk />} />
              <Route path="/smart-upsell" element={<SmartUpsell />} />
              <Route path="/price-optimization" element={<PriceOptimization />} />
              <Route path="/platform-settings" element={<PlatformSettings />} />
              <Route path="/coming-soon" element={<ComingSoon />} />

              {/* Legacy login route → redirect to dashboard */}
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RestaurantDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
