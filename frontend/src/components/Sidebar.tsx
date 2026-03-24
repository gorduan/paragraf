import React from "react";
import {
  Search,
  BookOpen,
  GitCompare,
  Library,
  HeartHandshake,
  Database,
  Settings,
} from "lucide-react";
import { ServerStatus } from "./ServerStatus";

export type Page =
  | "search"
  | "lookup"
  | "compare"
  | "laws"
  | "counseling"
  | "index"
  | "settings";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "search", label: "Suche", icon: <Search size={20} />, shortcut: "1" },
  {
    id: "lookup",
    label: "Nachschlagen",
    icon: <BookOpen size={20} />,
    shortcut: "2",
  },
  {
    id: "compare",
    label: "Vergleich",
    icon: <GitCompare size={20} />,
    shortcut: "3",
  },
  {
    id: "laws",
    label: "Gesetze",
    icon: <Library size={20} />,
    shortcut: "4",
  },
  {
    id: "counseling",
    label: "EUTB",
    icon: <HeartHandshake size={20} />,
    shortcut: "5",
  },
  {
    id: "index",
    label: "Index",
    icon: <Database size={20} />,
    shortcut: "6",
  },
  {
    id: "settings",
    label: "Einstellungen",
    icon: <Settings size={20} />,
    shortcut: "7",
  },
];

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  backendState: string;
}

export function Sidebar({ currentPage, onPageChange, backendState }: SidebarProps) {
  return (
    <aside className="w-56 flex-shrink-0 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
          Paragraf
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Deutsches Sozialrecht
        </p>
      </div>

      {/* Navigation */}
      <nav aria-label="Hauptnavigation" className="flex-1 py-2 overflow-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={`${item.label} (Ctrl+${item.shortcut})`}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              <kbd className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded" aria-hidden="true">
                ^{item.shortcut}
              </kbd>
            </button>
          );
        })}
      </nav>

      {/* Server Status */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3">
        <ServerStatus state={backendState} />
      </div>
    </aside>
  );
}
