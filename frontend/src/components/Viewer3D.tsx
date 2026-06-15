import { useEffect, useRef, useState } from "react";
import "pdbe-molstar/build/pdbe-molstar-plugin";
import "pdbe-molstar/build/pdbe-molstar-light.css";

type Props = {
  coordinateUrl?: string;
  dark?: boolean;
};

/**
 * Resolve a potentially-relative Django media URL to an absolute URL.
 *
 * The Vite dev server proxies /media/* → localhost:8000/media/* via vite.config.ts.
 * MolStar fetches files with XHR, so we must give it an absolute URL.
 * We use window.location.origin (the Vite port, e.g. 5173) — NOT the Django
 * port — so the request goes through the proxy and Django CORS/auth cookies work.
 *
 * In production, /media/ is typically served from the same origin, so
 * window.location.origin also works there.
 */
function resolveMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  // Already absolute — pass through unchanged (e.g. RCSB/PDBe demo structures).
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Relative path like /media/uploads/file.pdb — make it absolute using the
  // current page origin so the Vite proxy (or production nginx) handles it.
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function Viewer3D({ coordinateUrl, dark }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState("Loading molecule...");

  useEffect(() => {
    if (!containerRef.current) return;

    // Prefer the explicit theme prop; otherwise infer the document theme.
    const isDarkMode = dark ?? (document.documentElement.classList.contains("dark") ||
                       window.matchMedia("(prefers-color-scheme: dark)").matches);

    const bgColor = isDarkMode
      ? { r: 2, g: 6, b: 23 }     // matches Tailwind slate-950
      : { r: 255, g: 255, b: 255 }; // white

    const PluginClass = (window as any).PDBeMolstarPlugin;
    if (!PluginClass) {
       setStatus("Error: PDBeMolstarPlugin not found on window");
       return;
    }

    // Initialize the viewer instance only once to prevent memory leaks.
    if (!viewerRef.current) {
      viewerRef.current = new PluginClass();
    }

    const renderOptions = {
      hideCanvasControls: ["selection", "animation", "controlToggle", "controlInfo"],
      hideControls: true,
      bgColor: bgColor,
    };

    const resolvedUrl = resolveMediaUrl(coordinateUrl);

    if (resolvedUrl) {
      let extension = resolvedUrl.split(".").pop()?.toLowerCase().split("?")[0] || "pdb";
      if (extension === "cif") extension = "mmcif";

      const options = {
        ...renderOptions,
        customData: {
          url: resolvedUrl,
          format: extension,
          binary: false,
        },
      };
      setStatus("Loading molecule...");
      viewerRef.current.render(containerRef.current, options);
      setStatus("");
    } else {
      const options = {
        ...renderOptions,
        moleculeId: "1crn",
      };
      setStatus("Loading structure...");
      viewerRef.current.render(containerRef.current, options);
      setStatus("");
    }

    // Only clean up the canvas content (not the plugin instance) so that
    // theme or URL changes don't leave a blank black square behind.
    return () => {
      try {
        viewerRef.current?.plugin?.clear();
      } catch {
        // Ignore cleanup errors from MolStar internals.
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [coordinateUrl, dark]);

  return (
    <div className="relative z-0 h-full min-h-[320px] w-full overflow-hidden rounded-lg bg-white dark:bg-slate-950">
      <div ref={containerRef} className="absolute inset-0 rounded-lg" />
      {status && (
        <div className="pointer-events-none absolute z-10 inset-x-3 bottom-3 rounded-md bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
          {status}
        </div>
      )}
    </div>
  );
}
