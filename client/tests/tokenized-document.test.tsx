import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { tokenise } from "shared";
import { TokenizedDocument } from "../src/components/evidence/TokenizedDocument.js";
import publicChallenge from "../../challenge/public.json";

describe("P3-02 & P3-03: TokenizedDocument Component", () => {
  it("P3-02: Renders faithfully from tokens for all 5 evidence files in public.json", () => {
    for (const ev of publicChallenge.evidence) {
      const tokens = tokenise(ev.body);
      const { container, unmount } = render(<TokenizedDocument tokens={tokens} />);

      // The plain concatenated text inside the document must exactly match the challenge body
      const reconstructedText = tokens.map((t) => t.text).join("");
      expect(reconstructedText).toBe(ev.body);

      // Verify the rendered DOM content matches
      expect(container.textContent).toContain(ev.body.slice(0, 50));
      unmount();
    }
  });

  it("P3-03: No clue is highlighted automatically", () => {
    const sampleText = "Badge 4471 Tomas Herrera at Panel 38";
    const tokens = tokenise(sampleText);

    const { container } = render(<TokenizedDocument tokens={tokens} marks={[]} />);

    // No bracket or entity tags present
    expect(container.textContent).not.toContain("[");
    expect(container.textContent).not.toContain("]");
    expect(screen.queryByText(/PERSON|ALIAS|NUMBER|DATE/i)).toBeNull();
    expect(screen.queryByTestId("token-selection-menu")).toBeNull();
  });

  it("P3-03: Mouse selection triggers MARK / LINK / NOTE menu", () => {
    const sampleText = "Tomas Herrera inspected Panel 38";
    const tokens = tokenise(sampleText);
    const onMark = vi.fn();

    render(<TokenizedDocument tokens={tokens} onMark={onMark} />);

    // Find token t0 ("Tomas") and t2 ("Herrera")
    const t0 = document.getElementById("token-t0")!;
    const t2 = document.getElementById("token-t2")!;
    expect(t0).not.toBeNull();

    // Mouse drag from t0 to t2
    fireEvent.mouseDown(t0!);
    fireEvent.mouseEnter(t2);
    fireEvent.mouseUp(t2);

    // Selection menu is rendered with MARK / LINK / NOTE
    const menu = screen.getByTestId("token-selection-menu");
    expect(menu).not.toBeNull();
    expect(screen.getByRole("button", { name: "MARK" })).toBeDefined();
    expect(screen.getByRole("button", { name: "LINK" })).toBeDefined();
    expect(screen.getByRole("button", { name: "NOTE" })).toBeDefined();

    // Clicking MARK shows player-chosen entity types
    fireEvent.click(screen.getByRole("button", { name: "MARK" }));
    expect(screen.getByRole("button", { name: "PERSON" })).toBeDefined();
    expect(screen.getByRole("button", { name: "ALIAS" })).toBeDefined();
    expect(screen.getByRole("button", { name: "LOCATION" })).toBeDefined();
    expect(screen.getByRole("button", { name: "DATE" })).toBeDefined();
    expect(screen.getByRole("button", { name: "NUMBER" })).toBeDefined();
    expect(screen.getByRole("button", { name: "EVENT" })).toBeDefined();

    // Player chooses PERSON
    fireEvent.click(screen.getByRole("button", { name: "PERSON" }));

    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onMark).toHaveBeenCalledWith({
      startTokenId: "t0",
      endTokenId: "t2",
      text: "Tomas Herrera",
      entityType: "person",
    });
  });

  it("P3-03: Shift-click creates selection range and triggers menu", () => {
    const sampleText = "Panel 38 door access";
    const tokens = tokenise(sampleText);
    const onLink = vi.fn();

    render(<TokenizedDocument tokens={tokens} onLink={onLink} />);

    const t0 = document.getElementById("token-t0")!;
    const t2 = document.getElementById("token-t2")!;

    // Click t0, then shift-click t2
    fireEvent.mouseDown(t0);
    fireEvent.mouseUp(t0);
    fireEvent.click(t2, { shiftKey: true });

    const menu = screen.getByTestId("token-selection-menu");
    expect(menu).not.toBeNull();

    // Click LINK
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    expect(onLink).toHaveBeenCalledWith({
      startTokenId: "t0",
      endTokenId: "t2",
      text: "Panel 38",
    });
  });

  it("P3-03 & P3-09: Keyboard navigation and range selection works", () => {
    const sampleText = "First second third";
    const tokens = tokenise(sampleText);
    const onNote = vi.fn();

    render(<TokenizedDocument tokens={tokens} onNote={onNote} />);

    const region = screen.getByRole("region", { name: "Tokenized Evidence Document" });

    // Move right with ArrowRight
    fireEvent.keyDown(region, { key: "ArrowRight" });
    // Expand with Shift + ArrowRight
    fireEvent.keyDown(region, { key: "ArrowRight", shiftKey: true });

    // Menu should appear
    expect(screen.getByTestId("token-selection-menu")).toBeDefined();

    // Click NOTE
    fireEvent.click(screen.getByRole("button", { name: "NOTE" }));
    expect(onNote).toHaveBeenCalledTimes(1);
  });

  it("Renders existing marks with subtle brackets and entity tags", () => {
    const sampleText = "Tomas Herrera at Panel 38";
    const tokens = tokenise(sampleText);
    const marks = [
      {
        id: "m1",
        startTokenId: "t0",
        endTokenId: "t2",
        text: "Tomas Herrera",
        entityType: "person" as const,
      },
    ];

    const { container } = render(<TokenizedDocument tokens={tokens} marks={marks} />);

    expect(container.textContent).toContain("[");
    expect(container.textContent).toContain("]");
    expect(screen.getByText("person")).toBeDefined();
  });
});
