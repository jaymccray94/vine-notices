import { useQuery } from "@tanstack/react-query";
import type { Association } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Video, TicketCheck, ClipboardList, Mail,
  Calculator, Shield, Sparkles, ArrowRight, Building2,
  FolderOpen, Store,
} from "lucide-react";

interface PortalApp {
  id: string;
  label: string;
  description: string;
  icon: any;
  route: string;
  color: string;
}

const APPS: PortalApp[] = [
  { id: "notices", label: "Notices", description: "Post and manage official community notices with PDF attachments", icon: FileText, route: "/notices", color: "#317C3C" },
  { id: "meetings", label: "Meetings", description: "Record meeting videos, agendas, and minutes", icon: Video, route: "/meetings", color: "#2B6CB0" },
  { id: "tickets", label: "Tickets", description: "Internal ticketing system with board and list views", icon: TicketCheck, route: "/tickets", color: "#805AD5" },
  { id: "onboarding", label: "Onboarding", description: "Community onboarding flows, checklists, and templates", icon: ClipboardList, route: "/onboarding", color: "#D69E2E" },
  { id: "mailings", label: "Mailings", description: "Request and track community mailings", icon: Mail, route: "/mailings", color: "#DD6B20" },
  { id: "accounting", label: "Accounting", description: "Track outstanding items and financial workflows", icon: Calculator, route: "/accounting", color: "#38A169" },
  { id: "insurance", label: "Insurance", description: "Track association insurance policies and renewal dates", icon: Shield, route: "/insurance", color: "#E53E3E" },
  { id: "invoices", label: "AI Invoice Splitter", description: "Scan and split invoices automatically with AI", icon: Sparkles, route: "/invoices", color: "#319795" },
  { id: "documents", label: "Documents", description: "Florida-compliant document library with retention tracking", icon: FolderOpen, route: "/documents", color: "#6366F1" },
  { id: "vendors", label: "Vendors", description: "Manage vendors and service providers with CINC integration", icon: Store, route: "/vendors", color: "#EC4899" },
];

interface StatsData {
  notices: number;
  meetings: number;
  tickets: { open: number; inProgress: number; total: number };
  insurance: { total: number; expiringSoon: number };
  mailings: { pending: number; total: number };
  onboarding: { completed: number; total: number; items: { completed: number; total: number } };
  accounting: { outstanding: number; overdue: number; totalOwed: number };
  invoices: { pending: number; total: number };
  documents: { current: number; total: number };
  vendors: { active: number; total: number };
}

export default function PortalDashboard({
  associationId,
  onNavigate,
}: {
  associationId: string | null;
  onNavigate: (path: string) => void;
}) {
  const { user } = useAuth();

  const { data: associations = [] } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
  });

  const currentAssoc = associations.find((a) => a.id === associationId);

  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/stats/${associationId}`);
      return res.json();
    },
    enabled: !!associationId,
  });

  if (!associationId || !currentAssoc) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold mb-1" data-testid="text-portal-title">VineAdmin Portal</h1>
          <p className="text-sm text-muted-foreground">Select an association from the sidebar to get started.</p>
        </div>

        {/* Show all associations as cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {associations.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              onClick={() => onNavigate(`/hub/${a.id}`)}
              data-testid={`card-assoc-select-${a.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: a.primaryColor + "18" }}
                  >
                    <Building2 className="w-5 h-5" style={{ color: a.primaryColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">/{a.slug}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Stat summaries for the top row
  const statCards = stats
    ? [
        { icon: FileText, label: "Notices", value: stats.notices, color: "#317C3C" },
        { icon: Video, label: "Meetings", value: stats.meetings, color: "#2B6CB0" },
        { icon: TicketCheck, label: "Open Tickets", value: stats.tickets.open + stats.tickets.inProgress, color: "#805AD5" },
        { icon: Shield, label: "Policies", value: stats.insurance.total, extra: stats.insurance.expiringSoon > 0 ? `${stats.insurance.expiringSoon} expiring` : undefined, extraColor: "#E53E3E", color: "#E53E3E" },
        { icon: FolderOpen, label: "Documents", value: stats.documents.total, extra: `${stats.documents.current} current`, color: "#6366F1" },
        { icon: Store, label: "Vendors", value: stats.vendors.total, extra: `${stats.vendors.active} active`, color: "#EC4899" },
      ]
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Association header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: currentAssoc.primaryColor + "18" }}
          >
            <Building2 className="w-5 h-5" style={{ color: currentAssoc.primaryColor }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-hub-title">{currentAssoc.name}</h1>
            <p className="text-sm text-muted-foreground">Association Hub</p>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statsLoading || !statCards ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((s, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <s.icon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold leading-none" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      {s.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                    {s.extra && (
                      <p className="text-[10px] mt-0.5 font-medium" style={{ color: s.extraColor }}>{s.extra}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* All apps - all active */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Apps</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {APPS.map((app) => (
            <Card
              key={app.id}
              className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group"
              onClick={() => onNavigate(app.route)}
              data-testid={`card-app-${app.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: app.color + "18" }}
                  >
                    <app.icon className="w-4.5 h-4.5" style={{ color: app.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{app.label}</span>
                      <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-green-600 hover:bg-green-600">Active</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{app.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground/60 transition-colors flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
