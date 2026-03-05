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
import NotFound from "./pages/NotFound";

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
              <Route path="/orders" element={<OrdersSimulation />} />
              <Route path="/combos" element={<ComboEngine />} />
              <Route path="/voice" element={<VoiceCopilot />} />
              <Route path="/insights" element={<Insights />} />

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
