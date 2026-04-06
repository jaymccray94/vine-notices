import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Building2, Users, Settings, Palette, ChevronRight,
} from "lucide-react";

interface SettingsLink {
  label: string;
  description: string;
  icon: React.ElementType;
  route: string;
  adminOnly?: boolean;
}

const SETTINGS_SECTIONS: { title: string; items: SettingsLink[] }[] = [
  {
    title: "Organization",
    items: [
      { label: "Associations", description: "Manage HOA/POA communities", icon: Building2, route: "/associations", adminOnly: true },
      { label: "Users & Permissions", description: "Manage user accounts and role assignments", icon: Users, route: "/users", adminOnly: true },
      { label: "Branding", description: "Logo, colors, and company name", icon: Palette, route: "/branding", adminOnly: true },
    ],
  },
  {
    title: "Integrations",
    items: [
      { label: "CINC Settings", description: "Configure CINC API connection and sync", icon: Settings, route: "/cinc-settings", adminOnly: true },
    ],
  },
];

export default function SettingsHub() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organization and integrations</p>
      </div>

      <div className="space-y-8">
        {SETTINGS_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => !item.adminOnly || isSuperAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">{section.title}</h2>
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <Link key={item.route} href={item.route}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
