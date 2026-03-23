import { useState, useMemo, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import type { PublicMeeting } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Loader2, AlertTriangle, FileText, ExternalLink, Calendar } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(str: string) {
  const d = new Date(str + "T12:00:00");
  return { month: MONTHS[d.getMonth()], day: d.getDate(), year: d.getFullYear() };
}

interface AssocInfo {
  name: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
  darkColor: string;
}

export default function EmbedMeetingsPage() {
  const [, params] = useRoute("/embed/:slug/meetings");
  const slug = params?.slug || "";
  const [association, setAssociation] = useState<AssocInfo | null>(null);
  const [meetings, setMeetings] = useState<PublicMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`${API_BASE}/api/public/${slug}/meetings`);
      if (!res.ok) throw new Error(res.status === 404 ? "Association not found" : `Error ${res.status}`);
      const data = await res.json();
      setAssociation(data.association);
      setMeetings(data.meetings);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") loadData(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [loadData]);

  const sorted = useMemo(() => [...meetings].sort((a, b) => b.date.localeCompare(a.date)), [meetings]);

  const pc = association?.primaryColor || "#317C3C";
  const ac = association?.accentColor || "#8BC53F";
  const dc = association?.darkColor || "#1B3E1E";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${dc} 0%, #1B293E 100%)`,
        }}
        data-testid="embed-meetings-header"
      >
        <div
          className="absolute -top-[60%] -right-[10%] w-[500px] h-[500px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${ac}1F 0%, transparent 70%)`,
          }}
        />
        <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-8 pt-10 pb-8 sm:pt-12 sm:pb-10">
          {association && (
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-4"
              style={{
                backgroundColor: `${ac}26`,
                borderColor: `${ac}4D`,
                borderWidth: 1,
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" style={{ fill: ac }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: ac }}>
                {association.name}
              </span>
            </div>
          )}
          <div>
            <h1
              className="font-serif text-white text-[clamp(1.75rem,4.5vw,3rem)] font-normal tracking-tight mb-2"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
              data-testid="text-embed-meetings-title"
            >
              Meeting Records
            </h1>
            <p className="text-white/60 text-base sm:text-lg font-light max-w-[600px]">
              Video recordings, agendas, and minutes from community meetings.
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-10">
        {loading ? (
          <div className="flex flex-col items-center py-16" data-testid="loading-state">
            <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: pc }} />
            <p className="text-sm text-muted-foreground">Loading meeting records…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center" data-testid="error-state">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-sm font-medium mb-1">Unable to load meetings</p>
            <p className="text-xs text-muted-foreground max-w-md">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16" data-testid="empty-state">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${pc}1A` }}>
              <Video className="w-6 h-6" style={{ color: pc }} />
            </div>
            <h3 className="font-serif text-lg mb-1" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>
              No Meeting Records
            </h3>
            <p className="text-sm text-muted-foreground">
              There are no meeting records available at this time.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((meeting, i) => (
              <EmbedMeetingCard
                key={meeting.id}
                meeting={meeting}
                index={i}
                primaryColor={pc}
                darkColor={dc}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground/60">
          Managed by{" "}
          <a href="https://vinemgt.com" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: pc }}>
            Vine Management
          </a>
        </p>
      </footer>
    </div>
  );
}

function EmbedMeetingCard({
  meeting,
  index,
  primaryColor,
  darkColor,
}: {
  meeting: PublicMeeting;
  index: number;
  primaryColor: string;
  darkColor: string;
}) {
  const { month, day, year } = parseDate(meeting.date);
  const hasVideo = !!meeting.videoUrl;
  const hasAgenda = !!meeting.agendaUrl;
  const hasMinutes = !!meeting.minutesUrl;
  const hasAnyLink = hasVideo || hasAgenda || hasMinutes;

  return (
    <div
      className="bg-card rounded-[14px] shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 grid grid-cols-1 sm:grid-cols-[80px_1fr_auto] gap-3 sm:gap-5 items-start sm:items-center p-4 sm:p-5"
      data-testid={`card-embed-meeting-${index}`}
    >
      {/* Date column */}
      <div className="flex sm:flex-col items-baseline sm:items-center gap-1.5 sm:gap-0 sm:text-center sm:py-2 sm:rounded-[10px] sm:bg-background">
        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
          {month}
        </div>
        <div className="font-serif text-lg sm:text-[1.75rem] leading-tight" style={{ color: darkColor, fontFamily: "'DM Serif Display', Georgia, serif" }}>
          {day}
        </div>
        <div className="text-xs text-muted-foreground font-medium">{year}</div>
      </div>

      {/* Content column */}
      <div className="min-w-0">
        <h3 className="text-[15px] sm:text-base font-semibold mb-1 leading-snug" style={{ color: darkColor }}>
          {meeting.title}
        </h3>
        {meeting.description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{meeting.description}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
        {hasVideo && (
          <a
            href={meeting.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold hover:opacity-90 transition-all hover:scale-[1.03] no-underline whitespace-nowrap"
            style={{ backgroundColor: primaryColor }}
            data-testid={`link-embed-video-${index}`}
          >
            <Video className="w-3.5 h-3.5" />
            Watch Recording
          </a>
        )}
        {hasAgenda && (
          <a
            href={meeting.agendaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B293E] text-white text-[13px] font-semibold hover:bg-[#0f1d2e] transition-all hover:scale-[1.03] no-underline whitespace-nowrap"
            data-testid={`link-embed-agenda-${index}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Agenda
          </a>
        )}
        {hasMinutes && (
          <a
            href={meeting.minutesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B293E] text-white text-[13px] font-semibold hover:bg-[#0f1d2e] transition-all hover:scale-[1.03] no-underline whitespace-nowrap"
            data-testid={`link-embed-minutes-${index}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Minutes
          </a>
        )}
        {!hasAnyLink && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white/50 text-[13px] font-semibold whitespace-nowrap cursor-default" style={{ backgroundColor: `${primaryColor}59` }}>
            <Calendar className="w-3.5 h-3.5" />
            No attachments
          </span>
        )}
      </div>
    </div>
  );
}
