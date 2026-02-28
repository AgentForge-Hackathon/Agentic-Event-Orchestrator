import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { AppRoutes } from "@/components/layout/AppRoutes";
import { UnifiedShaderGradient } from "@/components/home/UnifiedShaderGradient";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="itinerary-planner-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UnifiedShaderGradient />
            <div className="relative z-10">
              <AppRoutes />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}
export default App;
