import { DashboardNav } from "@/components/DashboardNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { ChallengesSection } from "@/components/landing/ChallengesSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CTASection } from "@/components/landing/CTASection";
import { Brain } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <HeroSection />
      <ChallengesSection />
      <FeaturesSection />
      <CTASection />
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold">RevenueCopilot</span>
          </div>
          <span>AI-Powered Restaurant Intelligence</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
