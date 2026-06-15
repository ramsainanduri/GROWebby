import { describe, expect, it } from "vitest";

import { gpuSupportSummary } from "../../src/lib/hardware";
import { parseResponse } from "../../src/lib/api";

describe("gpuSupportSummary", () => {
  it("explains that Apple M-series Macs are not CUDA targets", () => {
    const summary = gpuSupportSummary("mac");

    expect(summary.backend).toBe("OpenCL");
    expect(summary.message).toContain("do not support CUDA");
  });

  it("maps Linux NVIDIA hosts to the CUDA engine", () => {
    const summary = gpuSupportSummary("linux-nvidia");

    expect(summary.backend).toBe("CUDA");
    expect(summary.message).toContain("gpu profile");
  });

  it("turns HTML server errors into readable messages", async () => {
    const response = new Response("<!DOCTYPE html><html></html>", {
      status: 403,
      headers: { "content-type": "text/html" }
    });

    await expect(parseResponse(response)).rejects.toThrow("The server rejected the request");
  });
});
