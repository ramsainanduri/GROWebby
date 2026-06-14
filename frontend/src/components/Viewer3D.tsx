import { useEffect, useRef, useState } from "react";
import "pdbe-molstar/build/pdbe-molstar-plugin";
import "pdbe-molstar/build/pdbe-molstar-light.css";

type Props = {
  coordinateUrl?: string;
  dark?: boolean;
};

export function Viewer3D({ coordinateUrl, dark }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState("Loading molecule...");

  useEffect(() => {
    if (!containerRef.current) return;

    // Use the dark prop if provided, otherwise fallback to DOM checking
    const isDarkMode = dark ?? (document.documentElement.classList.contains("dark") || 
                       window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    const bgColor = isDarkMode 
      ? { r: 2, g: 6, b: 23 } // matches Tailwind slate-950
      : { r: 255, g: 255, b: 255 }; // white

    const PluginClass = (window as any).PDBeMolstarPlugin;
    if (!PluginClass) {
       setStatus("Error: PDBeMolstarPlugin not found on window");
       return;
    }

    // Initialize the viewer instance only once to prevent memory leaks
    if (!viewerRef.current) {
      viewerRef.current = new PluginClass();
    }

    const renderOptions = {
      hideCanvasControls: ['selection', 'animation', 'controlToggle', 'controlInfo'],
      hideControls: true,
      bgColor: bgColor
    };

    if (coordinateUrl) {
      let extension = coordinateUrl.split('.').pop()?.toLowerCase() || 'pdb';
      if (extension === 'cif') extension = 'mmcif';
      
      const options = {
        ...renderOptions,
        customData: {
          url: coordinateUrl,
          format: extension,
          binary: false 
        }
      };
      setStatus("Loading molecule...");
      viewerRef.current.render(containerRef.current, options);
      setStatus("");
    } else {
      const options = {
        ...renderOptions,
        moleculeId: "1crn"
      };
      setStatus("Loading demo molecule...");
      viewerRef.current.render(containerRef.current, options);
      setStatus("");
    }

    // Proper WebGL cleanup function
    return () => {
      if (viewerRef.current?.plugin) {
        viewerRef.current.plugin.clear();
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