import React, { useState, useEffect, createContext, useContext } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { SetupWizard } from "./components/SetupWizard";
import { SearchPage } from "./pages/SearchPage";
import { LookupPage } from "./pages/LookupPage";
import { ComparePage } from "./pages/ComparePage";
import { LawBrowserPage } from "./pages/LawBrowserPage";
import { CounselingPage } from "./pages/CounselingPage";
import { IndexPage } from "./pages/IndexPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useBackend } from "./hooks/useBackend";

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

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("search");
  const [dark, setDark] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("paragraf_bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  const backend = useBackend();

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

  // Show wizard on first start (no backend ready, no data)
  useEffect(() => {
    if (backend.status.state === "stopped") {
      const hasSetup = localStorage.getItem("paragraf_setup_done");
      if (!hasSetup) setShowWizard(true);
    }
  }, [backend.status.state]);

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
          "7": "settings",
        };
        if (pageMap[e.key]) {
          e.preventDefault();
          setPage(pageMap[e.key]);
        }
      }
      if (e.key === "Escape") {
        // Could be used by pages to clear
      }
    };
    window.addEventListener("keydown", handler);

    const unsubSearch = window.electronAPI?.onSearchShortcut(() => {
      setPage("search");
    });

    return () => {
      window.removeEventListener("keydown", handler);
      unsubSearch?.();
    };
  }, []);

  const bookmarkCtx: BookmarkContextValue = {
    bookmarks,
    addBookmark: (ref) =>
      setBookmarks((prev) => (prev.includes(ref) ? prev : [...prev, ref])),
    removeBookmark: (ref) =>
      setBookmarks((prev) => prev.filter((b) => b !== ref)),
    isBookmarked: (ref) => bookmarks.includes(ref),
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
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <BookmarkContext.Provider value={bookmarkCtx}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            currentPage={page}
            onPageChange={setPage}
            backendState={backend.status.state}
          />
          <main className="flex-1 overflow-auto">{renderPage()}</main>
        </div>

        {showWizard && (
          <SetupWizard
            onComplete={() => {
              setShowWizard(false);
              localStorage.setItem("paragraf_setup_done", "true");
            }}
          />
        )}
      </BookmarkContext.Provider>
    </ThemeContext.Provider>
  );
}
