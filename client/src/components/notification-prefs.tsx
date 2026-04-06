import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "vine-notices-notification-prefs";

interface NotificationPrefs {
  emailNotices: boolean;
  emailMeetings: boolean;
  emailTickets: boolean;
  emailInsurance: boolean;
  emailMailings: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailNotices: true,
  emailMeetings: true,
  emailTickets: true,
  emailInsurance: true,
  emailMailings: false,
};

function getPrefs(): NotificationPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const PREF_ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "emailNotices", label: "New Notices", description: "When a notice is posted to your associations" },
  { key: "emailMeetings", label: "Meeting Updates", description: "When meeting records are added or updated" },
  { key: "emailTickets", label: "Ticket Changes", description: "When tickets are assigned or status changes" },
  { key: "emailInsurance", label: "Insurance Alerts", description: "When policies are expiring soon" },
  { key: "emailMailings", label: "Mailing Status", description: "When mailing request status changes" },
];

export function NotificationPrefsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(getPrefs);

  function togglePref(key: keyof NotificationPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePrefs(updated);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Notification Preferences</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {PREF_ITEMS.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                checked={prefs[item.key]}
                onCheckedChange={() => togglePref(item.key)}
                className="flex-shrink-0"
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t">
          <p className="text-[10px] text-muted-foreground">Preferences saved automatically. Email notifications require email provider configuration.</p>
        </div>
      </div>
    </div>
  );
}
