import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";

import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import ArtistIndex from "@/pages/ArtistIndex";
import Gallery from "@/pages/Gallery";
import Timeline from "@/pages/Timeline";
import Movements from "@/pages/Movements";
import About from "@/pages/About";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/lib/theme-provider";

const queryClient = new QueryClient();

function Router() {
  return (
    <AnimatePresence mode="wait">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/artist-index" component={ArtistIndex} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/timeline" component={Timeline} />
        <Route path="/movements" component={Movements} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Router />
            </Layout>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;