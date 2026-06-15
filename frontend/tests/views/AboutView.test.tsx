import { render, screen, waitFor } from "@testing-library/react";
import { AboutView } from "../../src/views/AboutView";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("AboutView", () => {
  beforeEach(() => {
    // Mock the global fetch call made in AboutView
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          version: "1.0.0",
          buildDate: "2026-06-15",
          tools: {
            gromacs: "2026.2",
            react: "19.2.7",
            vite: "8.0.16"
          }
        })
    });
  });

  it("renders the loading state initially", () => {
    render(<AboutView />);
    expect(screen.getByText("Loading version information…")).toBeInTheDocument();
  });

  it("renders the tools correctly after fetch", async () => {
    render(<AboutView />);
    
    // Wait for the version tools to populate
    await waitFor(() => {
      expect(screen.getByText(/1\.0\.0/i)).toBeInTheDocument();
    });

    expect(screen.getByText("GROMACS")).toBeInTheDocument();
    expect(screen.getByText("2026.2")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("19.2.7")).toBeInTheDocument();
  });
});
