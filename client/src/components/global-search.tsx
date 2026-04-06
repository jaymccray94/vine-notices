import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Video, TicketCheck, FolderOpen, Store, X, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface SearchResult {
  id: string;
  type: "notice" | "meeting" | "ticket" | "document" | "vendor";
  title: string;
  subtitle?: string;
  route: string;
}

const TYPE_CONFIG = {
  notice: { icon: FileText, label: "Notice", color: "text-blue-500" },
  meeting: { icon: Video, label: "Meeting", color: "text-purple-500" },
  ticket: { icon: TicketCheck, label: "Ticket", color: "text-orange-500" },
  document: { icon: FolderOpen, label: "Document", color: "text-green-500" },
  vendor: { icon: Store, label: "Vendor", color: "text-pink-500" },
};

const RECENT_KEY = "vine-notices-recent-searches";
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  associationId?: string | null;
}

export function GlobalSearch({ isOpen, onClose, onNavigate, associationId }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search across entities
  const { data: notices = [] } = useQuery<any[]>({
    queryKey: ["/api/associations", associationId, "notices"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isOpen && !!associationId && debouncedQuery.length >= 2,
  });

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ["/api/associations", associationId, "meetings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isOpen && !!associationId && debouncedQuery.length >= 2,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents", associationId],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isOpen && !!associationId && debouncedQuery.length >= 2,
  });

  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ["/api/vendors", associationId],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isOpen && !!associationId && debouncedQuery.length >= 2,
  });

  // Build results
  const results: SearchResult[] = [];
  const q = debouncedQuery.toLowerCase();

  if (q.length >= 2) {
    for (const n of notices) {
      if (n.title?.toLowerCase().includes(q) || n.type?.toLowerCase().includes(q)) {
        results.push({ id: n.id, type: "notice", title: n.title, subtitle: `${n.type} - ${n.date}`, route: "/notices" });
      }
    }
    for (const m of meetings) {
      if (m.title?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)) {
        results.push({ id: m.id, type: "meeting", title: m.title, subtitle: m.date, route: "/meetings" });
      }
    }
    for (const d of documents) {
      if (d.title?.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q)) {
        results.push({ id: d.id, type: "document", title: d.title, subtitle: d.category, route: "/documents" });
      }
    }
    for (const v of vendors) {
      if (v.name?.toLowerCase().includes(q) || v.category?.toLowerCase().includes(q)) {
        results.push({ id: v.id, type: "vendor", title: v.name, subtitle: v.category, route: "/vendors" });
      }
    }
  }

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        addRecentSearch(query);
        onNavigate(results[selectedIndex].route);
        onClose();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, selectedIndex, query, onNavigate, onClose],
  );

  // Scroll selected into view
  useEffect(() => {
    const el = resultsRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const recentSearches = getRecentSearches();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search notices, meetings, documents, vendors..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-auto">
          {query.length < 2 && recentSearches.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">Recent</p>
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(s)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md hover:bg-muted transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
            </div>
          )}

          {results.map((result, i) => {
            const config = TYPE_CONFIG[result.type];
            const Icon = config.icon;
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  addRecentSearch(query);
                  onNavigate(result.route);
                  onClose();
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  {result.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/60 uppercase">{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-[10px] text-muted-foreground/50">
          <span>{results.length > 0 ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Type to search"}</span>
          <div className="flex items-center gap-2">
            <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[9px]">&uarr;&darr;</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[9px]">&crarr;</kbd> select</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook to register Cmd+K shortcut */
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
}
