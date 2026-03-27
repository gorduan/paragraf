import { describe, it, expect } from "vitest";
import { parseCitations, type ParsedSegment } from "./citation-parser";
import type { ReferenceItem } from "./api";

function makeRef(overrides: Partial<ReferenceItem> = {}): ReferenceItem {
  return {
    gesetz: "BGB",
    paragraph: "§ 823",
    absatz: null,
    raw: "§ 823 BGB",
    verified: true,
    kontext: null,
    ...overrides,
  };
}

describe("parseCitations", () => {
  it("returns single text segment when references array is empty", () => {
    const text = "Dies ist ein einfacher Text ohne Verweise.";
    const result = parseCitations(text, []);
    expect(result).toEqual([{ type: "text", content: text }]);
  });

  it("returns [text, citation, text] for one reference in middle of text", () => {
    const text = "Gemaess § 823 BGB ist der Schaediger verantwortlich.";
    const ref = makeRef({ raw: "§ 823 BGB" });
    const result = parseCitations(text, [ref]);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "text", content: "Gemaess " });
    expect(result[1]).toEqual({ type: "citation", content: "§ 823 BGB", reference: ref });
    expect(result[2]).toEqual({ type: "text", content: " ist der Schaediger verantwortlich." });
  });

  it("picks longest match first when overlapping raw strings exist", () => {
    const text = "Siehe § 823 Abs. 1 BGB fuer Details.";
    const shortRef = makeRef({ raw: "§ 823", paragraph: "§ 823" });
    const longRef = makeRef({ raw: "§ 823 Abs. 1 BGB", paragraph: "§ 823", absatz: 1 });
    const result = parseCitations(text, [shortRef, longRef]);

    // Longest match should win
    const citations = result.filter((s) => s.type === "citation");
    expect(citations).toHaveLength(1);
    expect(citations[0].content).toBe("§ 823 Abs. 1 BGB");
    expect(citations[0].reference).toBe(longRef);
  });

  it("returns text-only segment when reference raw is not found in text", () => {
    const text = "Ein Text ohne passende Referenz.";
    const ref = makeRef({ raw: "§ 999 StGB" });
    const result = parseCitations(text, [ref]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "text", content: text });
  });

  it("preserves original text order and content with multiple references", () => {
    const text = "Nach § 823 BGB und § 249 BGB hat der Geschaedigte Anspruch.";
    const ref1 = makeRef({ raw: "§ 823 BGB", paragraph: "§ 823" });
    const ref2 = makeRef({ raw: "§ 249 BGB", paragraph: "§ 249" });
    const result = parseCitations(text, [ref1, ref2]);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ type: "text", content: "Nach " });
    expect(result[1]).toEqual({ type: "citation", content: "§ 823 BGB", reference: ref1 });
    expect(result[2]).toEqual({ type: "text", content: " und " });
    expect(result[3]).toEqual({ type: "citation", content: "§ 249 BGB", reference: ref2 });
    expect(result[4]).toEqual({ type: "text", content: " hat der Geschaedigte Anspruch." });
  });

  it("handles reference at the very start of text", () => {
    const text = "§ 823 BGB regelt die Schadensersatzpflicht.";
    const ref = makeRef({ raw: "§ 823 BGB" });
    const result = parseCitations(text, [ref]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "citation", content: "§ 823 BGB", reference: ref });
    expect(result[1]).toEqual({ type: "text", content: " regelt die Schadensersatzpflicht." });
  });

  it("handles reference at the very end of text", () => {
    const text = "Schadensersatzpflicht nach § 823 BGB";
    const ref = makeRef({ raw: "§ 823 BGB" });
    const result = parseCitations(text, [ref]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "text", content: "Schadensersatzpflicht nach " });
    expect(result[1]).toEqual({ type: "citation", content: "§ 823 BGB", reference: ref });
  });
});
