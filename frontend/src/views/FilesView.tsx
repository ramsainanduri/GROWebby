import { FileArchive, FileText, UploadCloud, X, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { UploadedCoordinate } from "../lib/api";
import { formatBytes, formatRunTime } from "../lib/utils";
import { EmptyState } from "../components/ui";
import { useState } from "react";
import Editor from "@monaco-editor/react";

export function FilesView({
  handleFile,
  selectUpload,
  upload,
  uploads,
}: {
  handleFile: (file?: File) => void;
  selectUpload: (upload: UploadedCoordinate) => void;
  upload: UploadedCoordinate | null;
  uploads: UploadedCoordinate[];
}) {
  const extension = (name: string) =>
    name.split(".").pop()?.toUpperCase() ?? "FILE";
  const iconForExtension = (ext: string) =>
    ["ZIP", "TAR", "GZ"].includes(ext) ? (
      <FileArchive size={20} className="text-amber-500" />
    ) : (
      <FileText size={20} className="text-ocean-500" />
    );

  const [editingFile, setEditingFile] = useState<UploadedCoordinate | null>(
    null,
  );
  const [editorContent, setEditorContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openEditor = async (file: UploadedCoordinate) => {
    setEditingFile(file);
    setEditorContent("Loading...");
    try {
      const response = await fetch(file.url);
      const text = await response.text();
      setEditorContent(text);
    } catch (e) {
      setEditorContent("Failed to load file content.");
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    const blob = new Blob([editorContent], { type: "text/plain" });
    const originalName = editingFile.originalName;
    const newName = originalName.startsWith("edited_")
      ? originalName
      : `edited_${originalName}`;
    const fileToUpload = new File([blob], newName, { type: "text/plain" });
    handleFile(fileToUpload);
    setIsSaving(false);
    setEditingFile(null);
  };

  return (
    <>
      <div className="grid h-full min-h-[640px] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Workspace Storage</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {uploads.length} files
            </span>
          </div>
          {uploads.length === 0 ? (
            <EmptyState
              title="No files uploaded"
              detail="Upload PDB, GRO, CIF, or MOL2 structures to begin simulating."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uploads.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectUpload(item)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    upload?.id === item.id
                      ? "border-ocean-500 bg-ocean-50 dark:bg-ocean-950"
                      : "border-slate-200 hover:border-ocean-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900">
                    {iconForExtension(extension(item.originalName))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {item.originalName}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {formatBytes(item.size)} · {formatRunTime(item.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold">Upload Structure</h3>
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ocean-200 bg-ocean-50/60 px-4 text-center transition hover:border-ocean-500 dark:border-slate-700 dark:bg-slate-950">
              <UploadCloud className="mb-3 text-ocean-600" size={32} />
              <span className="font-semibold">Click to upload</span>
              <span className="mt-1 max-w-[200px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                PDB, GRO, CIF, or MOL2 coordinate files
              </span>
              <input
                className="sr-only"
                type="file"
                accept=".pdb,.gro,.cif,.mol2"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          </section>
          {upload && (
            <section className="min-h-0 flex-1 flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 text-lg font-semibold">Selected File</h3>
              <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Name
                  </span>
                  <span className="mt-1 block break-all font-medium">
                    {upload.originalName}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Size
                  </span>
                  <span className="mt-1 block font-medium">
                    {formatBytes(upload.size)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Type
                  </span>
                  <span className="mt-1 block font-medium">
                    {extension(upload.originalName)} structure
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Uploaded
                  </span>
                  <span className="mt-1 block font-medium">
                    {formatRunTime(upload.createdAt)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => openEditor(upload)}
                  className="flex h-10 w-full items-center justify-center rounded-lg bg-mint-100 text-sm font-semibold text-mint-800 shadow-sm transition hover:bg-mint-200 dark:bg-mint-900/30 dark:text-mint-300 dark:hover:bg-mint-900/50"
                >
                  Edit File Content
                </button>
                <Link
                  to="/workflow"
                  className="flex h-10 w-full items-center justify-center rounded-lg bg-ocean-600 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700"
                >
                  Configure Simulation Run
                </Link>
                <a
                  href={upload.url}
                  download={upload.originalName}
                  className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Download File
                </a>
              </div>
            </section>
          )}
        </aside>
      </div>

      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm sm:p-6 lg:p-10">
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div>
                <h3 className="text-lg font-semibold">
                  Editing: {editingFile.originalName}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Make manual modifications to atom properties or remove lines
                  (e.g., HOH) to fix topology issues.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#1e1e1e] p-0">
              <Editor
                height="100%"
                defaultLanguage="plaintext"
                theme="vs-dark"
                value={editorContent}
                onChange={(value) => setEditorContent(value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  wordWrap: "off",
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setEditingFile(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveFile}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? "Saving..." : "Save as New File"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
