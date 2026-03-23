import { useState, useMemo, useEffect, useCallback } from "react";
import type { PublicNotice, PublicMeeting } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Video, Loader2, AlertTriangle, Search, X,
  ExternalLink, Calendar, Monitor, Smartphone, ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  "board meeting":    { bg: "bg-[#317C3C]/10", text: "text-[#317C3C]" },
  "annual meeting":   { bg: "bg-[#2B6CB0]/10", text: "text-[#2B6CB0]" },
  "budget":           { bg: "bg-[#2F855A]/10", text: "text-[#2F855A]" },
  "election":         { bg: "bg-[#805AD5]/10", text: "text-[#805AD5]" },
  "assessment":       { bg: "bg-[#B8922A]/10", text: "text-[#B8922A]" },
  "amendment":        { bg: "bg-[#C53030]/10", text: "text-[#C53030]" },
  "rule change":      { bg: "bg-[#1B293E]/10", text: "text-[#1B293E] dark:text-[#8BA3C4]" },
  "recall":           { bg: "bg-[#9B2C2C]/10", text: "text-[#9B2C2C]" },
  "reserve study":    { bg: "bg-[#2C7A7B]/10", text: "text-[#2C7A7B]" },
  "financial report": { bg: "bg-[#975A16]/10", text: "text-[#975A16]" },
  "lien/foreclosure": { bg: "bg-[#744210]/10", text: "text-[#744210]" },
  "event":            { bg: "bg-[#38A169]/10", text: "text-[#38A169]" },
  "general":          { bg: "bg-[#4A5568]/10", text: "text-[#4A5568] dark:text-[#A0AEC0]" },
};

function getTypeStyle(type: string) {
  return TYPE_STYLES[(type || "general").toLowerCase().trim()] || TYPE_STYLES["general"];
}

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

export default function EmbedPreviewPage({ slug }: { slug: string }) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"notices" | "meetings">("notices");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [association, setAssociation] = useState<AssocInfo | null>(null);
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [meetings, setMeetings] = useState<PublicMeeting[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/${slug}/notices`);
        if (!res.ok) throw new Error(res.status === 404 ? "Association not found" : `Error ${res.status}`);
        const data = await res.json();
        setAssociation(data.association);
        setNotices(data.notices);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingNotices(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/${slug}/meetings`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        setMeetings(data.meetings);
      } catch (e: any) {
        // meetings error — non-critical
      } finally {
        setLoadingMeetings(false);
      }
    })();
  }, [slug]);

  const pc = association?.primaryColor || "#317C3C";
  const ac = association?.accentColor || "#8BC53F";
  const dc = association?.darkColor || "#1B3E1E";

  const loading = activeTab === "notices" ? loadingNotices : loadingMeetings;

  return (
    <div className="flex flex-col h-full" data-testid="embed-preview-page">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setLocation("/associations")}
          data-testid="button-back-to-associations"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Associations
        </Button>

        <div className="h-5 w-px bg-border" />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "notices" | "meetings")}>
          <TabsList className="h-8">
            <TabsTrigger value="notices" className="text-xs h-7 px-3" data-testid="tab-preview-notices">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Notices
            </TabsTrigger>
            <TabsTrigger value="meetings" className="text-xs h-7 px-3" data-testid="tab-preview-meetings">
              <Video className="w-3.5 h-3.5 mr-1.5" />
              Meetings
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={viewMode === "desktop" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("desktop")}
            data-testid="button-view-desktop"
          >
            <Monitor className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "mobile" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("mobile")}
            data-testid="button-view-mobile"
          >
            <Smartphone className="w-4 h-4" />
          </Button>
        </div>

        {association && (
          <Badge variant="outline" className="text-[11px] gap-1.5 ml-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pc }} />
            {association.name}
          </Badge>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-muted/50 flex items-start justify-center p-4 sm:p-6">
        <div
          className={`bg-background rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
            viewMode === "mobile"
              ? "w-[390px] border-[8px] border-gray-800 rounded-[2rem]"
              : "w-full max-w-[1200px] border border-border"
          }`}
          style={viewMode === "mobile" ? { minHeight: "700px" } : {}}
          data-testid="preview-frame"
        >
          <div className="overflow-auto" style={viewMode === "mobile" ? { maxHeight: "700px" } : { maxHeight: "calc(100vh - 140px)" }}>
            {error ? (
              <div className="flex flex-col items-center py-16 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                <p className="text-sm font-medium mb-1">Unable to load preview</p>
                <p className="text-xs text-muted-foreground max-w-md">{error}</p>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center py-16">
                <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: pc }} />
                <p className="text-sm text-muted-foreground">Loading preview…</p>
              </div>
            ) : activeTab === "notices" ? (
              <NoticesPreview
                association={association}
                notices={notices}
                pc={pc} ac={ac} dc={dc}
              />
            ) : (
              <MeetingsPreview
                association={association}
                meetings={meetings}
                pc={pc} ac={ac} dc={dc}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Notices preview ── */
function NoticesPreview({
  association, notices, pc, ac, dc,
}: {
  association: AssocInfo | null;
  notices: PublicNotice[];
  pc: string; ac: string; dc: string;
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const sorted = useMemo(() => [...notices].sort((a, b) => b.date.localeCompare(a.date)), [notices]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    sorted.forEach((n) => { const y = n.date?.slice(0, 4); if (y) years.add(y); });
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [sorted]);

  const afterYearAndSearch = useMemo(() => {
    let result = sorted;
    if (yearFilter !== "all") result = result.filter((n) => n.date?.startsWith(yearFilter));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.description || "").toLowerCase().includes(q) ||
        (n.type || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [sorted, yearFilter, searchQuery]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, { label: string; count: number }> = {};
    afterYearAndSearch.forEach((n) => {
      const key = (n.type || "General").toLowerCase().trim();
      if (!counts[key]) counts[key] = { label: n.type || "General", count: 0 };
      counts[key].count++;
    });
    return counts;
  }, [afterYearAndSearch]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return afterYearAndSearch;
    return afterYearAndSearch.filter((n) => (n.type || "General").toLowerCase().trim() === activeFilter);
  }, [afterYearAndSearch, activeFilter]);

  const filterKeys = Object.keys(typeCounts).sort((a, b) =>
    typeCounts[a].label.localeCompare(typeCounts[b].label)
  );

  const hasFilters = searchQuery.trim() !== "" || activeFilter !== "all" || yearFilter !== "all";

  return (
    <div className="min-h-[400px]">
      {/* Header */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${dc} 0%, #1B293E 100%)` }}>
        <div className="absolute -top-[60%] -right-[10%] w-[500px] h-[500px] rounded-full" style={{ background: `radial-gradient(circle, ${ac}1F 0%, transparent 70%)` }} />
        <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-8 pt-10 pb-8 sm:pt-12 sm:pb-10">
          {association && (
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-4" style={{ backgroundColor: `${ac}26`, borderColor: `${ac}4D`, borderWidth: 1 }}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" style={{ fill: ac }}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: ac }}>{association.name}</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-white text-[clamp(1.75rem,4.5vw,3rem)] font-normal tracking-tight mb-2" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
                {yearFilter !== "all" ? `${yearFilter} Notices` : "Current Notices"}
              </h1>
              <p className="text-white/60 text-base sm:text-lg font-light max-w-[600px]">Official community notices and announcements.</p>
            </div>
            {sorted.length > 0 && (
              <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }} className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors mt-2">
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>
          {searchOpen && (
            <div className="mt-4 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notices..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Year Tabs + Filter Pills */}
      {sorted.length > 0 && (
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 pt-5 pb-1">
          {availableYears.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <button
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${yearFilter === "all" ? "text-white" : "bg-white dark:bg-card text-foreground hover:text-primary"}`}
                style={yearFilter === "all" ? { backgroundColor: dc, borderColor: dc } : { borderColor: `${dc}33` }}
                onClick={() => { setYearFilter("all"); setActiveFilter("all"); }}
              >All Years</button>
              {availableYears.map((y) => (
                <button
                  key={y}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${yearFilter === y ? "text-white" : "bg-white dark:bg-card text-foreground hover:text-primary"}`}
                  style={yearFilter === y ? { backgroundColor: dc, borderColor: dc } : { borderColor: `${dc}33` }}
                  onClick={() => { setYearFilter(y); setActiveFilter("all"); }}
                >{y}</button>
              ))}
            </div>
          )}
          {filterKeys.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${activeFilter === "all" ? "text-white" : "bg-white dark:bg-card text-foreground hover:text-primary"}`}
                style={activeFilter === "all" ? { backgroundColor: pc, borderColor: pc } : { borderColor: `${pc}33` }}
                onClick={() => setActiveFilter("all")}
              >
                All
                <span className="inline-flex items-center justify-center min-w-[1.3em] h-[1.3em] text-[11px] font-bold rounded-full ml-1.5"
                  style={activeFilter === "all" ? { backgroundColor: "rgba(255,255,255,0.25)", color: "white" } : { backgroundColor: `${pc}1F`, color: pc }}
                >{afterYearAndSearch.length}</span>
              </button>
              {filterKeys.map((key) => (
                <button
                  key={key}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${activeFilter === key ? "text-white" : "bg-white dark:bg-card text-foreground hover:text-primary"}`}
                  style={activeFilter === key ? { backgroundColor: pc, borderColor: pc } : { borderColor: `${pc}33` }}
                  onClick={() => setActiveFilter(key)}
                >
                  {typeCounts[key].label}
                  <span className="inline-flex items-center justify-center min-w-[1.3em] h-[1.3em] text-[11px] font-bold rounded-full ml-1.5"
                    style={activeFilter === key ? { backgroundColor: "rgba(255,255,255,0.25)", color: "white" } : { backgroundColor: `${pc}1F`, color: pc }}
                  >{typeCounts[key].count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${pc}1A` }}>
              {hasFilters ? <Search className="w-6 h-6" style={{ color: pc }} /> : (
                <svg className="w-6 h-6" style={{ stroke: pc }} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <h3 className="font-serif text-lg mb-1" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>
              {hasFilters ? "No matching notices" : "No Current Notices"}
            </h3>
            <p className="text-sm text-muted-foreground">{hasFilters ? "Try adjusting your search or filters." : "There are no active notices at this time."}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((notice, i) => {
              const { month, day, year } = parseDate(notice.date);
              const typeStyle = getTypeStyle(notice.type);
              return (
                <div key={`${notice.date}-${notice.title}-${i}`} className="bg-card rounded-[14px] shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 grid grid-cols-1 sm:grid-cols-[80px_1fr_auto] gap-3 sm:gap-5 items-start sm:items-center p-4 sm:p-5">
                  <div className="flex sm:flex-col items-baseline sm:items-center gap-1.5 sm:gap-0 sm:text-center sm:py-2 sm:rounded-[10px] sm:bg-background">
                    <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: pc }}>{month}</div>
                    <div className="font-serif text-lg sm:text-[1.75rem] leading-tight" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>{day}</div>
                    <div className="text-xs text-muted-foreground font-medium">{year}</div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] sm:text-base font-semibold mb-1 leading-snug" style={{ color: dc }}>{notice.title}</h3>
                    <span className={`inline-flex text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${typeStyle.bg} ${typeStyle.text}`}>{notice.type || "General"}</span>
                    {notice.description && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{notice.description}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    {notice.meetingUrl && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B293E] text-white text-[13px] font-semibold whitespace-nowrap cursor-default">
                        <Video className="w-3.5 h-3.5" /> Join Meeting
                      </span>
                    )}
                    {notice.pdfUrl ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold whitespace-nowrap cursor-default" style={{ backgroundColor: pc }}>
                        <FileText className="w-3.5 h-3.5" /> View PDF
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white/50 text-[13px] font-semibold whitespace-nowrap cursor-default" style={{ backgroundColor: `${pc}59` }}>
                        <FileText className="w-3.5 h-3.5" /> No PDF
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground/60">
          Managed by <span className="font-semibold" style={{ color: pc }}>Vine Management</span>
        </p>
      </footer>
    </div>
  );
}


/* ── Meetings preview ── */
function MeetingsPreview({
  association, meetings, pc, ac, dc,
}: {
  association: AssocInfo | null;
  meetings: PublicMeeting[];
  pc: string; ac: string; dc: string;
}) {
  const sorted = useMemo(() => [...meetings].sort((a, b) => b.date.localeCompare(a.date)), [meetings]);

  return (
    <div className="min-h-[400px]">
      {/* Header */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${dc} 0%, #1B293E 100%)` }}>
        <div className="absolute -top-[60%] -right-[10%] w-[500px] h-[500px] rounded-full" style={{ background: `radial-gradient(circle, ${ac}1F 0%, transparent 70%)` }} />
        <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-8 pt-10 pb-8 sm:pt-12 sm:pb-10">
          {association && (
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-4" style={{ backgroundColor: `${ac}26`, borderColor: `${ac}4D`, borderWidth: 1 }}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" style={{ fill: ac }}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: ac }}>{association.name}</span>
            </div>
          )}
          <div>
            <h1 className="font-serif text-white text-[clamp(1.75rem,4.5vw,3rem)] font-normal tracking-tight mb-2" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
              Meeting Records
            </h1>
            <p className="text-white/60 text-base sm:text-lg font-light max-w-[600px]">Video recordings, agendas, and minutes from community meetings.</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-10">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${pc}1A` }}>
              <Video className="w-6 h-6" style={{ color: pc }} />
            </div>
            <h3 className="font-serif text-lg mb-1" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>No Meeting Records</h3>
            <p className="text-sm text-muted-foreground">There are no meeting records available at this time.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((meeting, i) => {
              const { month, day, year } = parseDate(meeting.date);
              const hasVideo = !!meeting.videoUrl;
              const hasAgenda = !!meeting.agendaUrl;
              const hasMinutes = !!meeting.minutesUrl;
              const hasAnyLink = hasVideo || hasAgenda || hasMinutes;
              return (
                <div key={meeting.id} className="bg-card rounded-[14px] shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 grid grid-cols-1 sm:grid-cols-[80px_1fr_auto] gap-3 sm:gap-5 items-start sm:items-center p-4 sm:p-5">
                  <div className="flex sm:flex-col items-baseline sm:items-center gap-1.5 sm:gap-0 sm:text-center sm:py-2 sm:rounded-[10px] sm:bg-background">
                    <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: pc }}>{month}</div>
                    <div className="font-serif text-lg sm:text-[1.75rem] leading-tight" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>{day}</div>
                    <div className="text-xs text-muted-foreground font-medium">{year}</div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] sm:text-base font-semibold mb-1 leading-snug" style={{ color: dc }}>{meeting.title}</h3>
                    {meeting.description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{meeting.description}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    {hasVideo && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold whitespace-nowrap cursor-default" style={{ backgroundColor: pc }}>
                        <Video className="w-3.5 h-3.5" /> Watch Recording
                      </span>
                    )}
                    {hasAgenda && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B293E] text-white text-[13px] font-semibold whitespace-nowrap cursor-default">
                        <FileText className="w-3.5 h-3.5" /> Agenda
                      </span>
                    )}
                    {hasMinutes && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B293E] text-white text-[13px] font-semibold whitespace-nowrap cursor-default">
                        <FileText className="w-3.5 h-3.5" /> Minutes
                      </span>
                    )}
                    {!hasAnyLink && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white/50 text-[13px] font-semibold whitespace-nowrap cursor-default" style={{ backgroundColor: `${pc}59` }}>
                        <Calendar className="w-3.5 h-3.5" /> No attachments
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground/60">
          Managed by <span className="font-semibold" style={{ color: pc }}>Vine Management</span>
        </p>
      </footer>
    </div>
  );
}
