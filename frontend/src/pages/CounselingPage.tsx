import React, { useState } from "react";
import { api, type CounselingItem } from "../lib/api";
import { Loader, MapPin, Phone, Mail, Globe, HeartHandshake } from "lucide-react";

const BUNDESLAENDER = [
  "Alle", "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

export function CounselingPage() {
  const [ort, setOrt] = useState("");
  const [bundesland, setBundesland] = useState("Alle");
  const [schwerpunkt, setSchwerpunkt] = useState("");
  const [results, setResults] = useState<CounselingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await api.counseling({
        ort: ort || null,
        bundesland: bundesland === "Alle" ? null : bundesland,
        schwerpunkt: schwerpunkt || null,
      });
      setResults(res.stellen);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <HeartHandshake size={24} aria-hidden="true" />
          EUTB-Beratungsstellen
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ergänzende unabhängige Teilhabeberatung – kostenlos und unabhängig
        </p>
      </div>

      {/* Filters */}
      <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <legend className="sr-only">Beratungsstellen filtern</legend>
        <div>
          <label htmlFor="eutb-ort" className="sr-only">Stadt oder Ort</label>
          <input
            id="eutb-ort"
            type="text"
            value={ort}
            onChange={(e) => setOrt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Stadt / Ort"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="eutb-bundesland" className="sr-only">Bundesland</label>
          <select
            id="eutb-bundesland"
            value={bundesland}
            onChange={(e) => setBundesland(e.target.value)}
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {BUNDESLAENDER.map((bl) => (
              <option key={bl} value={bl}>{bl}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="eutb-schwerpunkt" className="sr-only">Schwerpunkt</label>
          <input
            id="eutb-schwerpunkt"
            type="text"
            value={schwerpunkt}
            onChange={(e) => setSchwerpunkt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Schwerpunkt (z.B. Sehbehinderung)"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </fieldset>

      <button
        onClick={handleSearch}
        className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Beratungsstellen suchen
      </button>

      {loading && (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <Loader className="animate-spin text-primary-500" size={24} aria-hidden="true" />
          <span className="sr-only">Beratungsstellen werden gesucht...</span>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-500">
            {total} Beratungsstellen gefunden
            {total > results.length && ` (zeige ${results.length})`}
          </p>

          {results.map((stelle, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
            >
              <h3 className="font-semibold text-sm">{stelle.name}</h3>
              {stelle.traeger && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Träger: {stelle.traeger}
                </p>
              )}
              <address className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400 not-italic">
                {(stelle.strasse || stelle.ort) && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="flex-shrink-0" aria-hidden="true" />
                    {[stelle.strasse, `${stelle.plz} ${stelle.ort}`.trim()]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {stelle.telefon && (
                  <p className="flex items-center gap-2">
                    <Phone size={14} className="flex-shrink-0" aria-hidden="true" />
                    <a href={`tel:${stelle.telefon.replace(/\s/g, "")}`} className="hover:underline">
                      {stelle.telefon}
                    </a>
                  </p>
                )}
                {stelle.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={14} className="flex-shrink-0" aria-hidden="true" />
                    <a href={`mailto:${stelle.email}`} className="hover:underline">
                      {stelle.email}
                    </a>
                  </p>
                )}
                {stelle.website && (
                  <p className="flex items-center gap-2">
                    <Globe size={14} className="flex-shrink-0" aria-hidden="true" />
                    <a href={stelle.website.startsWith("http") ? stelle.website : `https://${stelle.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {stelle.website}
                    </a>
                  </p>
                )}
              </address>
              {stelle.schwerpunkte.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {stelle.schwerpunkte.map((sp, j) => (
                    <span
                      key={j}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-400 rounded-full"
                    >
                      {sp}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="mt-8 text-center text-slate-400">
          <p>Keine Beratungsstellen gefunden.</p>
          <p className="text-sm mt-2">
            Überregionale Hotline: 0800 11 10 111 (kostenfrei)
          </p>
        </div>
      )}

      {/* Info box */}
      <aside role="note" aria-label="Informationen zur EUTB" className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        Alle EUTB-Beratungen sind <strong>kostenlos und unabhängig</strong> von
        Leistungsträgern. Weitere Informationen:{" "}
        <a href="https://www.teilhabeberatung.de" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900 dark:hover:text-blue-100">
          www.teilhabeberatung.de
        </a>
      </aside>
    </div>
  );
}
