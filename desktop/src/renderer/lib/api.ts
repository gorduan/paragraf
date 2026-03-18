/**
 * Typisierter REST-Client für die Paragraf API.
 */

const BASE_URL = "http://localhost:8000";

// ── Request Types ────────────────────────────────────────────────────────────

export interface SearchRequest {
  anfrage: string;
  gesetzbuch?: string | null;
  abschnitt?: string | null;
  max_ergebnisse?: number;
}

export interface LookupRequest {
  gesetz: string;
  paragraph: string;
}

export interface CompareRequest {
  paragraphen: string[];
}

export interface CounselingRequest {
  ort?: string | null;
  bundesland?: string | null;
  schwerpunkt?: string | null;
}

export interface IndexRequest {
  gesetzbuch?: string | null;
}

// ── Response Types ───────────────────────────────────────────────────────────

export interface SearchResultItem {
  paragraph: string;
  gesetz: string;
  titel: string;
  text: string;
  score: number;
  abschnitt: string;
  hierarchie_pfad: string;
  quelle: string;
  chunk_typ: string;
  absatz: number | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  disclaimer: string;
}

export interface LookupResponse {
  paragraph: string;
  gesetz: string;
  titel: string;
  text: string;
  abschnitt: string;
  hierarchie_pfad: string;
  quelle: string;
  stand: string | null;
  found: boolean;
  error: string | null;
}

export interface CompareItem {
  referenz: string;
  paragraph: string;
  gesetz: string;
  titel: string;
  text: string;
  found: boolean;
}

export interface CompareResponse {
  items: CompareItem[];
}

export interface LawInfo {
  abkuerzung: string;
  beschreibung: string;
  slug: string | null;
}

export interface LawsResponse {
  gesetze: LawInfo[];
  total_chunks: number;
  db_status: string;
}

export interface LawStructureEntry {
  paragraph: string;
  titel: string;
  abschnitt: string;
  hierarchie_pfad: string;
}

export interface LawStructureResponse {
  gesetz: string;
  paragraphen: LawStructureEntry[];
  total: number;
}

export interface LawParagraphsResponse {
  gesetz: string;
  paragraphen: SearchResultItem[];
  total: number;
}

export interface CounselingItem {
  name: string;
  traeger: string;
  strasse: string;
  plz: string;
  ort: string;
  bundesland: string;
  telefon: string;
  email: string;
  website: string;
  schwerpunkte: string[];
  barrierefreiheit: string[];
}

export interface CounselingResponse {
  stellen: CounselingItem[];
  total: number;
  hinweis: string;
}

export interface IndexStatusItem {
  gesetz: string;
  chunks: number;
  status: string;
}

export interface IndexStatusResponse {
  gesetze: IndexStatusItem[];
  total_chunks: number;
  db_status: string;
}

export interface IndexProgressEvent {
  gesetz: string;
  schritt: string;
  fortschritt: number;
  gesamt: number;
  nachricht: string;
}

export interface IndexResultResponse {
  erfolg: boolean;
  verarbeitete_gesetze: number;
  total_chunks: number;
  fehler: string[];
}

export interface HealthResponse {
  status: string;
  embedding_model: string;
  embedding_dimension: number;
  embedding_device: string;
  qdrant_collection: string;
  qdrant_status: string;
  indexierte_chunks: number;
}

// ── API Client ───────────────────────────────────────────────────────────────

async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API Fehler: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => fetchJson<HealthResponse>("/api/health"),

  search: (body: SearchRequest) =>
    fetchJson<SearchResponse>("/api/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  lookup: (body: LookupRequest) =>
    fetchJson<LookupResponse>("/api/lookup", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  compare: (body: CompareRequest) =>
    fetchJson<CompareResponse>("/api/compare", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  laws: () => fetchJson<LawsResponse>("/api/laws"),

  lawStructure: (gesetz: string) =>
    fetchJson<LawStructureResponse>(`/api/laws/${encodeURIComponent(gesetz)}/structure`),

  lawParagraphs: (gesetz: string) =>
    fetchJson<LawParagraphsResponse>(`/api/laws/${encodeURIComponent(gesetz)}/paragraphs`),

  counseling: (body: CounselingRequest) =>
    fetchJson<CounselingResponse>("/api/counseling", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  indexStatus: () => fetchJson<IndexStatusResponse>("/api/index/status"),

  indexGesetze: (
    body: IndexRequest,
    onProgress: (event: IndexProgressEvent) => void
  ): { cancel: () => void } => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as IndexProgressEvent;
                onProgress(event);
              } catch {}
            }
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("Index-Stream Fehler:", e);
        }
      }
    })();

    return { cancel: () => controller.abort() };
  },

  indexEutb: () =>
    fetchJson<IndexResultResponse>("/api/index/eutb", { method: "POST" }),
};
