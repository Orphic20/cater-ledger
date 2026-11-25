import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { AuthGate } from "./components/AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SoaPage from "./pages/SoaPage";
import SoaEditorPage from "./pages/SoaEditorPage";
import ClientDetails from "./pages/ClientDetails";
import CalendarPage from "./pages/CalendarPage";
import CateringEventEditorPage from "./pages/CateringEventEditorPage";
import InsightsPage from "./pages/InsightsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/soa" component={SoaPage} />
      <Route path="/soa/new">
        <SoaEditorPage recordId={null} />
      </Route>
      <Route path="/soa/:id">{params => <SoaEditorPage recordId={params.id} />}</Route>
      <Route path="/clients/:id">{params => <ClientDetails clientId={params.id} />}</Route>
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/calendar/events/new">
        <CateringEventEditorPage eventId={null} />
      </Route>
      <Route path="/calendar/events/:id">{params => <CateringEventEditorPage eventId={params.id} />}</Route>
      <Route path="/insights" component={InsightsPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <AuthGate>
              <Toaster />
              <Router />
            </AuthGate>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
