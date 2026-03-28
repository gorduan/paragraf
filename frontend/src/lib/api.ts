/**
 * Typisierter REST-Client fuer die Paragraf API.
 * BASE_URL ist leer – nginx proxied /api/* zum Backend.
 */

const BASE_URL = (window as any).__PARAGRAF_API_BASE_URL__ || "";

// ── Request Types ────────────────────────────────────────────────────────────

export interface SearchRequest {
  anfrage: string;
  gesetzbuch?: string | null;
  abschnitt?: string | null;
  max_ergebnisse?: number;
  search_type?: "semantic" | "fulltext" | "hybrid_fulltext";
  absatz_von?: number | null;
  absatz_bis?: number | null;
  cursor?: string | null;
  page_size?: number;
  expand?: boolean;
  chunk_typ?: string | null;
}

export interface RecommendRequest {
  point_ids?: string[] | null;
  paragraph?: string | null;
  gesetz?: string | null;
  limit?: number;
  exclude_same_law?: boolean;
  gesetzbuch?: string | null;
  abschnitt?: string | null;
  absatz_von?: number | null;
  absatz_bis?: number | null;
}

export interface GroupedSearchRequest {
  anfrage: string;
  gesetzbuch?: string | null;
  abschnitt?: string | null;
  group_size?: number;
  max_groups?: number;
  search_type?: "semantic" | "fulltext" | "hybrid_fulltext";
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

export interface ReferenceItem {
  gesetz: string;
  paragraph: string;
  absatz: number | null;
  raw: string;
  verified: boolean;
  kontext: string | null;
}

export interface IncomingReferenceItem {
  gesetz: string;
  paragraph: string;
  chunk_id: string;
  text_preview: string;
}

export interface ReferenceNetworkResponse {
  gesetz: string;
  paragraph: string;
  outgoing: ReferenceItem[];
  incoming: IncomingReferenceItem[];
  incoming_count: number;
}

export interface DiscoverRequest {
  positive_paragraphs: { gesetz: string; paragraph: string }[];
  negative_paragraphs?: { gesetz: string; paragraph: string }[];
  limit?: number;
  gesetzbuch?: string | null;
}

export interface DiscoverResponse {
  positive_ids: string[];
  negative_ids: string[];
  results: SearchResultItem[];
  total: number;
  disclaimer: string;
}

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
  references_out?: ReferenceItem[];
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  search_type?: string;
  next_cursor?: string | null;
  expanded_terms?: string[];
  disclaimer: string;
}

export interface RecommendResponse {
  source_ids: string[];
  results: SearchResultItem[];
  total: number;
  disclaimer: string;
}

export interface GroupedResultGroup {
  gesetz: string;
  results: SearchResultItem[];
  total: number;
}

export interface GroupedSearchResponse {
  query: string;
  groups: GroupedResultGroup[];
  total_groups: number;
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
  rechtsgebiet: string;
  quelle: string;
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

export interface SettingsResponse {
  embedding_device: string;
  embedding_batch_size: number;
  embedding_max_length: number;
  reranker_top_k: number;
  retrieval_top_k: number;
  similarity_threshold: number;
  qdrant_url: string;
  hf_home: string;
  torch_home: string;
}

export interface GpuInfoResponse {
  cuda_available: boolean;
  gpu_name: string;
  vram_total_mb: number;
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
    // Try to extract error detail from JSON response body
    let detail = `API Fehler: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // Response body not JSON, use status text
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  health: () => fetchJson<HealthResponse>("/api/health"),

  settings: () => fetchJson<SettingsResponse>("/api/settings"),

  gpuInfo: () => fetchJson<GpuInfoResponse>("/api/settings/gpu"),

  search: (body: SearchRequest) =>
    fetchJson<SearchResponse>("/api/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  recommend: (body: RecommendRequest) =>
    fetchJson<RecommendResponse>("/api/recommend", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  searchGrouped: (body: GroupedSearchRequest) =>
    fetchJson<GroupedSearchResponse>("/api/search/grouped", {
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
    onProgress: (event: IndexProgressEvent) => void,
    onStreamEnd?: (lastEvent: IndexProgressEvent | null) => void,
  ): { cancel: () => void } => {
    const controller = new AbortController();
    let lastEvent: IndexProgressEvent | null = null;

    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) {
          onStreamEnd?.(null);
          return;
        }

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
                lastEvent = event;
                onProgress(event);
              } catch {}
            }
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("Index-Stream Fehler:", e);
        }
      } finally {
        onStreamEnd?.(lastEvent);
      }
    })();

    return { cancel: () => controller.abort() };
  },

  indexEutb: () =>
    fetchJson<IndexResultResponse>("/api/index/eutb", { method: "POST" }),

  references: (gesetz: string, paragraph: string) =>
    fetchJson<ReferenceNetworkResponse>(
      `/api/references/${encodeURIComponent(gesetz)}/${encodeURIComponent(paragraph)}`
    ),

  discover: (body: DiscoverRequest) =>
    fetchJson<DiscoverResponse>("/api/discover", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
