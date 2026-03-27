import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CitationLink } from "../CitationLink";
import type { ReferenceItem } from "../../lib/api";

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

describe("CitationLink", () => {
  it("renders with role='link' and correct aria-label", () => {
    const ref = makeRef();
    render(<CitationLink reference={ref} onNavigate={vi.fn()} />);

    const link = screen.getByRole("link");
    expect(link).toBeTruthy();
    expect(link.getAttribute("aria-label")).toBe(
      "Verweis auf § 823 BGB"
    );
  });

  it("calls onNavigate with correct gesetz and paragraph when verified citation is clicked", async () => {
    const onNavigate = vi.fn();
    const ref = makeRef({ gesetz: "SGB IX", paragraph: "§ 152" });
    render(<CitationLink reference={ref} onNavigate={onNavigate} />);

    const link = screen.getByRole("link");
    await userEvent.click(link);

    expect(onNavigate).toHaveBeenCalledWith("SGB IX", "§ 152");
  });

  it("shows warning text when unverified citation is clicked", async () => {
    const ref = makeRef({ verified: false });
    render(<CitationLink reference={ref} onNavigate={vi.fn()} />);

    const link = screen.getByRole("link");
    await userEvent.click(link);

    expect(screen.getByText("Dieses Gesetz ist nicht indexiert.")).toBeTruthy();
  });

  it("triggers click behavior on Enter key press", () => {
    const onNavigate = vi.fn();
    const ref = makeRef();
    render(<CitationLink reference={ref} onNavigate={onNavigate} />);

    const link = screen.getByRole("link");
    fireEvent.keyDown(link, { key: "Enter" });

    expect(onNavigate).toHaveBeenCalledWith("BGB", "§ 823");
  });

  it("triggers click behavior on Space key press", () => {
    const onNavigate = vi.fn();
    const ref = makeRef();
    render(<CitationLink reference={ref} onNavigate={onNavigate} />);

    const link = screen.getByRole("link");
    fireEvent.keyDown(link, { key: " " });

    expect(onNavigate).toHaveBeenCalledWith("BGB", "§ 823");
  });

  it("renders kontext badge when reference has kontext", () => {
    const ref = makeRef({ kontext: "i.V.m." });
    render(<CitationLink reference={ref} onNavigate={vi.fn()} />);

    expect(screen.getByText("i.V.m.")).toBeTruthy();
  });
});
