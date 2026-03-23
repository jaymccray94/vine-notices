import { useState, useMemo, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import type { PublicNotice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Video, Loader2, AlertTriangle, ExternalLink, Search, X } from "lucide-react";

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

function formatFullDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

interface AssocInfo {
  name: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
  darkColor: string;
}

export default function EmbedNoticesPage() {
  const [, params] = useRoute("/embed/:slug");
  const slug = params?.slug || "";
  const [association, setAssociation] = useState<AssocInfo | null>(null);
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<PublicNotice | null>(null);
  const inIframe = useMemo(() => isInIframe(), []);

  const loadData = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`${API_BASE}/api/public/${slug}/notices`);
      if (!res.ok) throw new Error(res.status === 404 ? "Association not found" : `Error ${res.status}`);
      const data = await res.json();
      setAssociation(data.association);
      setNotices(data.notices);
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

  const sorted = useMemo(() => [...notices].sort((a, b) => b.date.localeCompare(a.date)), [notices]);

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    sorted.forEach((n) => {
      const y = n.date?.slice(0, 4);
      if (y) years.add(y);
    });
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [sorted]);

  // Type counts (computed AFTER year + search filter for accurate counts)
  const afterYearAndSearch = useMemo(() => {
    let result = sorted;
    if (yearFilter !== "all") {
      result = result.filter((n) => n.date?.startsWith(yearFilter));
    }
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

  const pc = association?.primaryColor || "#317C3C";
  const ac = association?.accentColor || "#8BC53F";
  const dc = association?.darkColor || "#1B3E1E";

  const hasFilters = searchQuery.trim() !== "" || activeFilter !== "all" || yearFilter !== "all";

  function handleViewPdf(notice: PublicNotice) {
    if (!notice.pdfUrl) return;
    const pdfFullUrl = `${API_BASE}${notice.pdfUrl}`;
    if (inIframe) {
      window.open(pdfFullUrl, "_blank");
    } else {
      setViewingPdf(notice);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${dc} 0%, #1B293E 100%)`,
        }}
        data-testid="embed-header"
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-serif text-white text-[clamp(1.75rem,4.5vw,3rem)] font-normal tracking-tight mb-2"
                style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
                data-testid="text-embed-title"
              >
                {yearFilter !== "all" ? `${yearFilter} Notices` : "Current Notices"}
              </h1>
              <p className="text-white/60 text-base sm:text-lg font-light max-w-[600px]">
                Official community notices and announcements.
              </p>
            </div>
            {/* Search toggle */}
            {!loading && !error && sorted.length > 0 && (
              <button
                onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }}
                className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors mt-2"
                data-testid="button-search-toggle"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search bar in header */}
          {searchOpen && (
            <div className="mt-4 max-w-md" data-testid="embed-search-bar">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notices..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                  autoFocus
                  data-testid="input-embed-search"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Year Tabs + Filter Pills */}
      {!loading && !error && sorted.length > 0 && (
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 pt-5 pb-1">
          {/* Year tabs */}
          {availableYears.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center mb-3" data-testid="embed-year-tabs">
              <button
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                  yearFilter === "all"
                    ? "text-white"
                    : "bg-white dark:bg-card text-foreground hover:text-primary"
                }`}
                style={yearFilter === "all" ? { backgroundColor: dc, borderColor: dc } : { borderColor: `${dc}33` }}
                onClick={() => { setYearFilter("all"); setActiveFilter("all"); }}
                data-testid="embed-year-all"
              >
                All Years
              </button>
              {availableYears.map((y) => (
                <button
                  key={y}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    yearFilter === y
                      ? "text-white"
                      : "bg-white dark:bg-card text-foreground hover:text-primary"
                  }`}
                  style={yearFilter === y ? { backgroundColor: dc, borderColor: dc } : { borderColor: `${dc}33` }}
                  onClick={() => { setYearFilter(y); setActiveFilter("all"); }}
                  data-testid={`embed-year-${y}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Type filter pills */}
          {filterKeys.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                  activeFilter === "all"
                    ? "text-white"
                    : "bg-white dark:bg-card text-foreground hover:text-primary"
                }`}
                style={activeFilter === "all" ? { backgroundColor: pc, borderColor: pc } : { borderColor: `${pc}33` }}
                onClick={() => setActiveFilter("all")}
                data-testid="filter-all"
              >
                All
                <span
                  className="inline-flex items-center justify-center min-w-[1.3em] h-[1.3em] text-[11px] font-bold rounded-full ml-1.5"
                  style={activeFilter === "all" ? { backgroundColor: "rgba(255,255,255,0.25)", color: "white" } : { backgroundColor: `${pc}1F`, color: pc }}
                >
                  {afterYearAndSearch.length}
                </span>
              </button>
              {filterKeys.map((key) => (
                <button
                  key={key}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    activeFilter === key
                      ? "text-white"
                      : "bg-white dark:bg-card text-foreground hover:text-primary"
                  }`}
                  style={activeFilter === key ? { backgroundColor: pc, borderColor: pc } : { borderColor: `${pc}33` }}
                  onClick={() => setActiveFilter(key)}
                  data-testid={`filter-${key}`}
                >
                  {typeCounts[key].label}
                  <span
                    className="inline-flex items-center justify-center min-w-[1.3em] h-[1.3em] text-[11px] font-bold rounded-full ml-1.5"
                    style={activeFilter === key ? { backgroundColor: "rgba(255,255,255,0.25)", color: "white" } : { backgroundColor: `${pc}1F`, color: pc }}
                  >
                    {typeCounts[key].count}
                  </span>
                </button>
              ))}
              <span className="ml-auto text-[13px] text-muted-foreground hidden sm:inline">
                {filtered.length} notice{filtered.length !== 1 ? "s" : ""}{hasFilters ? " found" : " posted"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 pb-10">
        {loading ? (
          <div className="flex flex-col items-center py-16" data-testid="loading-state">
            <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: pc }} />
            <p className="text-sm text-muted-foreground">Loading current notices…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center" data-testid="error-state">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-sm font-medium mb-1">Unable to load notices</p>
            <p className="text-xs text-muted-foreground max-w-md">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16" data-testid="empty-state">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${pc}1A` }}>
              {hasFilters ? (
                <Search className="w-6 h-6" style={{ color: pc }} />
              ) : (
                <svg className="w-6 h-6" style={{ stroke: pc }} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <h3 className="font-serif text-lg mb-1" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>
              {hasFilters ? "No matching notices" : "No Current Notices"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "Try adjusting your search or filters." : "There are no active notices at this time."}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearchQuery(""); setActiveFilter("all"); setYearFilter("all"); }}
                className="mt-3 text-sm font-medium transition-colors"
                style={{ color: pc }}
                data-testid="button-embed-clear-filters"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((notice, i) => (
              <EmbedNoticeCard
                key={`${notice.date}-${notice.title}-${i}`}
                notice={notice}
                index={i}
                primaryColor={pc}
                darkColor={dc}
                onViewPdf={handleViewPdf}
              />
            ))}
          </div>
        )}
      </main>

      {/* PDF Modal */}
      {viewingPdf && !inIframe && viewingPdf.pdfUrl && (
        <Dialog open={!!viewingPdf} onOpenChange={(o) => !o && setViewingPdf(null)}>
          <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b flex-shrink-0 bg-muted/50">
              <div className="flex items-center justify-between">
                <DialogTitle className="font-serif text-sm font-normal truncate pr-4" style={{ color: dc, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                  {viewingPdf.title}
                </DialogTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" asChild>
                  <a href={`${API_BASE}${viewingPdf.pdfUrl}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Open
                  </a>
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 bg-muted overflow-hidden">
              <iframe
                src={`${API_BASE}${viewingPdf.pdfUrl}`}
                className="w-full h-full border-0"
                title={`PDF: ${viewingPdf.title}`}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

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

function EmbedNoticeCard({
  notice,
  index,
  primaryColor,
  darkColor,
  onViewPdf,
}: {
  notice: PublicNotice;
  index: number;
  primaryColor: string;
  darkColor: string;
  onViewPdf: (n: PublicNotice) => void;
}) {
  const { month, day, year } = parseDate(notice.date);
  const typeStyle = getTypeStyle(notice.type);

  return (
    <div
      className="bg-card rounded-[14px] shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 grid grid-cols-1 sm:grid-cols-[80px_1fr_auto] gap-3 sm:gap-5 items-start sm:items-center p-4 sm:p-5"
      data-testid={`card-embed-notice-${index}`}
    >
      <div className="flex sm:flex-col items-baseline sm:items-center gap-1.5 sm:gap-0 sm:text-center sm:py-2 sm:rounded-[10px] sm:bg-background">
        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
          {month}
        </div>
        <div className="font-serif text-lg sm:text-[1.75rem] leading-tight" style={{ color: darkColor, fontFamily: "'DM Serif Display', Georgia, serif" }}>
          {day}
        </div>
        <div className="text-xs text-muted-foreground font-medium">{year}</div>
      </div>

      <div className="min-w-0">
        <h3 className="text-[15px] sm:text-base font-semibold mb-1 leading-snug" style={{ color: darkColor }}>
          {notice.title}
        </h3>
        <span className={`inline-flex text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${typeStyle.bg} ${typeStyle.text}`}>
          {notice.type || "General"}
        </span>
        {notice.description && (
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{notice.description}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
        {notice.meetingUrl && (
          <a
            href={notice.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B293E] text-white text-[13px] font-semibold hover:bg-[#0f1d2e] transition-all hover:scale-[1.03] no-underline whitespace-nowrap"
          >
            <Video className="w-3.5 h-3.5" />
            Join Meeting
          </a>
        )}
        {notice.pdfUrl ? (
          <button
            onClick={() => onViewPdf(notice)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold hover:opacity-90 transition-all hover:scale-[1.03] whitespace-nowrap"
            style={{ backgroundColor: primaryColor }}
          >
            <FileText className="w-3.5 h-3.5" />
            View PDF
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white/50 text-[13px] font-semibold whitespace-nowrap cursor-default" style={{ backgroundColor: `${primaryColor}59` }}>
            <FileText className="w-3.5 h-3.5" />
            No PDF
          </span>
        )}
      </div>
    </div>
  );
}
