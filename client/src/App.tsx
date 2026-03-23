import { Switch, Route, Router, useLocation, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import type { Association } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Building2, FileText, Users, LogOut, Leaf, Video,
  TicketCheck, ClipboardList, Mail, Calculator, Shield,
  Sparkles, LayoutDashboard, Settings, FolderOpen, Store,
  Globe,
} from "lucide-react";
import { useState, useEffect } from "react";

import LoginPage from "@/pages/login";
import PortalDashboard from "@/pages/portal-dashboard";
import AdminNoticesPage from "@/pages/admin-notices";
import AdminMeetingsPage from "@/pages/admin-meetings";
import AdminAssociationsPage from "@/pages/admin-associations";
import AdminUsersPage from "@/pages/admin-users";
import AdminTicketsPage from "@/pages/admin-tickets";
import AdminInsurancePage from "@/pages/admin-insurance";
import AdminMailingsPage from "@/pages/admin-mailings";
import AdminOnboardingPage from "@/pages/admin-onboarding";
import AdminAccountingPage from "@/pages/admin-accounting";
import AdminInvoicesPage from "@/pages/admin-invoices";
import AdminDocumentsPage from "@/pages/admin-documents";
import AdminVendorsPage from "@/pages/admin-vendors";
import AdminGlobalTicketsPage from "@/pages/admin-global-tickets";
import AdminCincSettingsPage from "@/pages/admin-cinc-settings";
import EmbedPreviewPage from "@/pages/embed-preview";
import EmbedNoticesPage from "@/pages/embed-notices";
import EmbedMeetingsPage from "@/pages/embed-meetings";
import AIMeetingNoticesPage from "@/pages/ai-meeting-notices";
import AIMeetingMinutesPage from "@/pages/ai-meeting-minutes";
import NotFound from "@/pages/not-found";

// ── App navigation config ──
const APP_NAV = [
  { id: "notices", label: "Notices", icon: FileText, route: "/notices", status: "live" as const },
  { id: "meetings", label: "Meetings", icon: Video, route: "/meetings", status: "live" as const },
  { id: "tickets", label: "Tickets", icon: TicketCheck, route: "/tickets", status: "live" as const },
  { id: "documents", label: "Documents", icon: FolderOpen, route: "/documents", status: "live" as const },
  { id: "vendors", label: "Vendors", icon: Store, route: "/vendors", status: "live" as const },
  { id: "onboarding", label: "Onboarding", icon: ClipboardList, route: "/onboarding", status: "live" as const },
  { id: "mailings", label: "Mailings", icon: Mail, route: "/mailings", status: "live" as const },
  { id: "accounting", label: "Accounting", icon: Calculator, route: "/accounting", status: "live" as const },
  { id: "insurance", label: "Insurance", icon: Shield, route: "/insurance", status: "live" as const },
  { id: "invoices", label: "AI Invoices", icon: Sparkles, route: "/invoices", status: "live" as const },
  { id: "ai-notices", label: "AI Meeting Notices", icon: Sparkles, route: "/ai/meeting-notices", status: "live" as const },
  { id: "ai-minutes", label: "AI Meeting Minutes", icon: ClipboardList, route: "/ai/meeting-minutes", status: "live" as const },
];

// ── Global navigation (cross-association) ──
const GLOBAL_NAV = [
  { id: "global-tickets", label: "All Tickets", icon: TicketCheck, route: "/global/tickets" },
];

// ── Header breadcrumb labels ──
function getPageTitle(location: string, currentAssoc?: Association | null) {
  const assocName = currentAssoc?.name || "Association";
  if (location === "/" || location === "") return "Portal";
  if (location === "/notices") return `${assocName} — Notices`;
  if (location === "/meetings") return `${assocName} — Meetings`;
  if (location === "/tickets") return `${assocName} — Tickets`;
  if (location === "/documents") return `${assocName} — Documents`;
  if (location === "/vendors") return `${assocName} — Vendors`;
  if (location === "/onboarding") return `${assocName} — Onboarding`;
  if (location === "/mailings") return `${assocName} — Mailings`;
  if (location === "/accounting") return `${assocName} — Accounting`;
  if (location === "/insurance") return `${assocName} — Insurance`;
  if (location === "/invoices") return `${assocName} — AI Invoices`;
  if (location === "/ai/meeting-notices") return "AI Meeting Notices";
  if (location === "/ai/meeting-minutes") return "AI Meeting Minutes";
  if (location === "/global/tickets") return "All Tickets";
  if (location === "/associations") return "Associations";
  if (location === "/cinc-settings") return "CINC Settings";
  if (location.startsWith("/preview/")) return "Embed Preview";
  if (location === "/users") return "Users";
  return "";
}

function getPageIcon(location: string) {
  if (location === "/" || location === "") return LayoutDashboard;
  const app = APP_NAV.find((a) => a.route === location);
  if (app) return app.icon;
  if (location === "/global/tickets") return TicketCheck;
  if (location === "/associations") return Building2;
  if (location === "/cinc-settings") return Settings;
  if (location.startsWith("/preview/")) return Building2;
  if (location === "/users") return Users;
  return LayoutDashboard;
}

function PortalLayout() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [selectedAssocId, setSelectedAssocId] = useState<string | null>(null);

  const { data: associations = [] } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
  });

  // Auto-select first association
  useEffect(() => {
    if (!selectedAssocId && associations.length > 0) {
      setSelectedAssocId(associations[0].id);
    }
  }, [associations, selectedAssocId]);

  const isSuperAdmin = user?.role === "super_admin";
  const currentAssoc = associations.find((a) => a.id === selectedAssocId);
  const pageTitle = getPageTitle(location, currentAssoc);
  const PageIcon = getPageIcon(location);

  // Pages that don't require an association selection
  const isGlobalPage = location === "/global/tickets" || location === "/associations" || location === "/users" || location === "/cinc-settings" || location.startsWith("/preview/") || location.startsWith("/ai/");

  function handleNavigate(path: string) {
    if (path.startsWith("/hub/")) {
      const id = path.replace("/hub/", "");
      setSelectedAssocId(id);
      setLocation("/");
      return;
    }
    setLocation(path);
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 pb-2">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => setLocation("/")}
              data-testid="sidebar-logo"
            >
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-sidebar-foreground truncate">VineAdmin</p>
                <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email}</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarSeparator />

          <SidebarContent>
            {/* Association selector */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
                Association
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {associations.map((a) => (
                    <SidebarMenuItem key={a.id}>
                      <SidebarMenuButton
                        onClick={() => { setSelectedAssocId(a.id); setLocation("/"); }}
                        isActive={selectedAssocId === a.id && (location === "/" || location === "")}
                        className="gap-2"
                        data-testid={`sidebar-assoc-${a.id}`}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.primaryColor }} />
                        <span className="truncate text-[13px]">{a.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* App shortcuts */}
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
                Apps
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {APP_NAV.map((app) => (
                    <SidebarMenuItem key={app.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === app.route}
                        data-testid={`sidebar-app-${app.id}`}
                      >
                        <Link href={app.route}>
                          <app.icon className="w-4 h-4" />
                          <span className="text-[13px]">{app.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Global section */}
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
                Global
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {GLOBAL_NAV.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.route}
                        data-testid={`sidebar-global-${item.id}`}
                      >
                        <Link href={item.route}>
                          <item.icon className="w-4 h-4" />
                          <span className="text-[13px]">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin nav */}
            {isSuperAdmin && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
                    Admin
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/associations"}
                        >
                          <Link href="/associations" data-testid="sidebar-associations">
                            <Building2 className="w-4 h-4" />
                            <span className="text-[13px]">Associations</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/users"}
                        >
                          <Link href="/users" data-testid="sidebar-users">
                            <Users className="w-4 h-4" />
                            <span className="text-[13px]">Users</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/cinc-settings"}
                        >
                          <Link href="/cinc-settings" data-testid="sidebar-cinc-settings">
                            <Settings className="w-4 h-4" />
                            <span className="text-[13px]">CINC Settings</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <button
              onClick={logout}
              className="flex items-center gap-2 text-[13px] text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full px-2 py-1.5 rounded-md hover:bg-sidebar-accent"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {pageTitle && (
                <div className="flex items-center gap-2">
                  <PageIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{pageTitle}</span>
                </div>
              )}
            </div>
            {currentAssoc && !isGlobalPage && location !== "/" && (
              <button
                onClick={() => setLocation("/")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-back-to-hub"
              >
                Back to Hub
              </button>
            )}
          </header>

          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/">
                <PortalDashboard
                  associationId={selectedAssocId}
                  onNavigate={handleNavigate}
                />
              </Route>
              <Route path="/notices">
                {selectedAssocId ? (
                  <AdminNoticesPage associationId={selectedAssocId} key={`notices-${selectedAssocId}`} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">Select an association first.</p>
                  </div>
                )}
              </Route>
              <Route path="/meetings">
                {selectedAssocId ? (
                  <AdminMeetingsPage associationId={selectedAssocId} key={`meetings-${selectedAssocId}`} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">Select an association first.</p>
                  </div>
                )}
              </Route>
              <Route path="/tickets">
                {selectedAssocId ? <AdminTicketsPage associationId={selectedAssocId} key={`tickets-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/documents">
                {selectedAssocId ? <AdminDocumentsPage associationId={selectedAssocId} key={`documents-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/vendors">
                {selectedAssocId ? <AdminVendorsPage associationId={selectedAssocId} key={`vendors-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/onboarding">
                {selectedAssocId ? <AdminOnboardingPage associationId={selectedAssocId} key={`onboarding-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/mailings">
                {selectedAssocId ? <AdminMailingsPage associationId={selectedAssocId} key={`mailings-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/accounting">
                {selectedAssocId ? <AdminAccountingPage associationId={selectedAssocId} key={`accounting-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/insurance">
                {selectedAssocId ? <AdminInsurancePage associationId={selectedAssocId} key={`insurance-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/invoices">
                {selectedAssocId ? <AdminInvoicesPage associationId={selectedAssocId} key={`invoices-${selectedAssocId}`} /> : <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Select an association first.</p></div>}
              </Route>
              <Route path="/ai/meeting-notices">
                <AIMeetingNoticesPage />
              </Route>
              <Route path="/ai/meeting-minutes">
                <AIMeetingMinutesPage />
              </Route>
              {/* Global pages */}
              <Route path="/global/tickets" component={AdminGlobalTicketsPage} />
              {/* Admin pages */}
              {isSuperAdmin && <Route path="/cinc-settings" component={AdminCincSettingsPage} />}
              {/* Embed preview */}
              <Route path="/preview/:slug">
                {(params) => <EmbedPreviewPage slug={params.slug} />}
              </Route>
              {isSuperAdmin && <Route path="/associations" component={AdminAssociationsPage} />}
              {isSuperAdmin && <Route path="/users" component={AdminUsersPage} />}
              <Route component={NotFound} />
            </Switch>
          </main>
          <PerplexityAttribution />
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user } = useAuth();
  const [location] = useHashLocation();

  // Public embed routes are always accessible
  if (location.startsWith("/embed/") && location.endsWith("/meetings")) {
    return <EmbedMeetingsPage />;
  }
  if (location.startsWith("/embed/")) {
    return <EmbedNoticesPage />;
  }

  // Everything else requires auth
  if (!user) {
    return <LoginPage />;
  }

  return <PortalLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
