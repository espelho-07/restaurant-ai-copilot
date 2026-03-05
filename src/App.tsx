import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RestaurantDataProvider } from "@/lib/restaurantData";
import { AuthProvider, ProtectedRoute, PublicRoute } from "@/components/AuthProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
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
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

              {/* Protected Routes */}
              <Route path="/setup" element={<ProtectedRoute><RestaurantSetup /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/menu" element={<ProtectedRoute><MenuIntelligence /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><OrdersSimulation /></ProtectedRoute>} />
              <Route path="/combos" element={<ProtectedRoute><ComboEngine /></ProtectedRoute>} />
              <Route path="/voice" element={<ProtectedRoute><VoiceCopilot /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RestaurantDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

