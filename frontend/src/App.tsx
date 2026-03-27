import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { HealthOverlay } from "./components/HealthOverlay";
import { SearchPage } from "./pages/SearchPage";
import { LookupPage } from "./pages/LookupPage";
import { ComparePage } from "./pages/ComparePage";
import { LawBrowserPage } from "./pages/LawBrowserPage";
import { CounselingPage } from "./pages/CounselingPage";
import { IndexPage } from "./pages/IndexPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useHealthCheck } from "./hooks/useHealthCheck";

// ── Contexts ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  dark: true,
  toggle: () => {},
});

interface BookmarkContextValue {
  bookmarks: string[];
  addBookmark: (ref: string) => void;
  removeBookmark: (ref: string) => void;
  isBookmarked: (ref: string) => boolean;
}

export const BookmarkContext = createContext<BookmarkContextValue>({
  bookmarks: [],
  addBookmark: () => {},
  removeBookmark: () => {},
  isBookmarked: () => false,
});

interface CompareContextValue {
  items: string[];
  addItem: (ref: string) => void;
  removeItem: (ref: string) => void;
  clearAll: () => void;
  isSelected: (ref: string) => boolean;
}

export const CompareContext = createContext<CompareContextValue>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  clearAll: () => {},
  isSelected: () => false,
});

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("search");
  const [dark, setDark] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("paragraf_bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  const { state: healthState, health, error: healthError, retry } = useHealthCheck();
  const mainRef = useRef<HTMLElement>(null);
  const [pageAnnouncement, setPageAnnouncement] = useState("");

  // Dark mode
  useEffect(() => {
    const saved = localStorage.getItem("paragraf_dark");
    if (saved !== null) setDark(saved === "true");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("paragraf_dark", String(dark));
  }, [dark]);

  // Bookmarks persisting
  useEffect(() => {
    localStorage.setItem("paragraf_bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Page labels for announcements
  // Placeholder for Plan 02
  const GraphPage = () => (
    <div className="p-8 text-lg text-slate-600 dark:text-slate-300">
      Zitationsgraph — wird in Plan 02 implementiert
    </div>
  );

  const PAGE_LABELS: Record<Page, string> = {
    search: "Suche",
    lookup: "Nachschlagen",
    compare: "Vergleich",
    laws: "Gesetze",
    counseling: "EUTB-Beratungsstellen",
    index: "Index-Management",
    graph: "Zitationsgraph",
    settings: "Einstellungen",
  };

  // Focus management on page change
  useEffect(() => {
    setPageAnnouncement(`Seite: ${PAGE_LABELS[page]}`);
    document.title = `${PAGE_LABELS[page]} – Paragraf`;
    mainRef.current?.focus();
  }, [page]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const pageMap: Record<string, Page> = {
          "1": "search",
          "2": "lookup",
          "3": "compare",
          "4": "laws",
          "5": "counseling",
          "6": "index",
          "7": "graph",
          "8": "settings",
        };
        if (pageMap[e.key]) {
          e.preventDefault();
          setPage(pageMap[e.key]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const bookmarkCtx: BookmarkContextValue = {
    bookmarks,
    addBookmark: (ref) =>
      setBookmarks((prev) => (prev.includes(ref) ? prev : [...prev, ref])),
    removeBookmark: (ref) =>
      setBookmarks((prev) => prev.filter((b) => b !== ref)),
    isBookmarked: (ref) => bookmarks.includes(ref),
  };

  const [compareItems, setCompareItems] = useState<string[]>([]);

  const compareCtx: CompareContextValue = {
    items: compareItems,
    addItem: (ref) => setCompareItems((prev) => prev.includes(ref) ? prev : [...prev, ref]),
    removeItem: (ref) => setCompareItems((prev) => prev.filter((r) => r !== ref)),
    clearAll: () => setCompareItems([]),
    isSelected: (ref) => compareItems.includes(ref),
  };

  const renderPage = () => {
    switch (page) {
      case "search":
        return <SearchPage />;
      case "lookup":
        return <LookupPage />;
      case "compare":
        return <ComparePage />;
      case "laws":
        return <LawBrowserPage />;
      case "counseling":
        return <CounselingPage />;
      case "index":
        return <IndexPage />;
      case "graph":
        return <GraphPage />;
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <BookmarkContext.Provider value={bookmarkCtx}>
      <CompareContext.Provider value={compareCtx}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            currentPage={page}
            onPageChange={setPage}
            backendState={healthState}
          />
          <main
            ref={mainRef}
            id="main-content"
            className="flex-1 overflow-auto"
            tabIndex={-1}
            aria-label={PAGE_LABELS[page]}
          >
            {renderPage()}
          </main>
        </div>

        {/* Live region for page change announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {pageAnnouncement}
        </div>

        <HealthOverlay
          state={healthState}
          health={health}
          error={healthError}
          onRetry={retry}
        />
      </CompareContext.Provider>
      </BookmarkContext.Provider>
    </ThemeContext.Provider>
  );
}
