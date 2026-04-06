import { useState, useEffect } from "react";
import { Leaf, FileText, Video, LayoutDashboard, FolderOpen, Settings, X, ChevronRight, ChevronLeft } from "lucide-react";

interface TourStep {
  icon: React.ElementType;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: Leaf,
    title: "Welcome to VineAdmin",
    description: "Your all-in-one HOA management platform for notices, meetings, documents, and more. Let's take a quick tour.",
  },
  {
    icon: LayoutDashboard,
    title: "Portal Dashboard",
    description: "Your home base. Select an association to see stats, quick actions, and navigate to any app module.",
  },
  {
    icon: FileText,
    title: "Notices & Meetings",
    description: "Create Florida-compliant notices, manage meeting records with video links, agendas, and minutes. Publish them to your public embed.",
  },
  {
    icon: FolderOpen,
    title: "Documents & Vendors",
    description: "Organize association documents by category, track vendor information, and manage insurance policies all in one place.",
  },
  {
    icon: Video,
    title: "Public Embeds",
    description: "Share notices and meetings on your association's website with branded embed pages. Preview them anytime from the Embed Preview tool.",
  },
  {
    icon: Settings,
    title: "You're All Set!",
    description: "Explore the sidebar to access all features. Super admins can manage associations, users, and CINC integration from the Admin section.",
  },
];

const STORAGE_KEY = "vine-notices-tour-completed";

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay so the app renders first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleClose() {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  }

  function handlePrev() {
    if (step > 0) setStep(step - 1);
  }

  if (!isOpen) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon header */}
        <div className="flex justify-center pt-8 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 text-center">
          <h2 className="text-lg font-semibold mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? "bg-primary w-6" : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={handleClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
