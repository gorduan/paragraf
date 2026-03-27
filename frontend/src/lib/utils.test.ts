import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn()", () => {
  it("merges and deduplicates Tailwind classes", () => {
    const result = cn("p-4", "p-6");
    expect(result).toContain("p-6");
    expect(result).not.toContain("p-4");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "extra");
    expect(result).toBe("base extra");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("merges arrays of classes", () => {
    const result = cn(["flex", "items-center"], "gap-2");
    expect(result).toBe("flex items-center gap-2");
  });

  it("handles undefined and null inputs", () => {
    const result = cn("text-sm", undefined, null, "font-bold");
    expect(result).toBe("text-sm font-bold");
  });
});
