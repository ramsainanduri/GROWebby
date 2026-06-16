import {
  Atom,
  Boxes,
  FlaskConical,
  Gauge,
  Network,
  Play,
  Rocket,
  Scale,
  Sparkles,
  UploadCloud,
  Waves,
  FileUp,
  X,
} from "lucide-react";
import { SimulationJob, UploadedCoordinate, GromacsOptions } from "../lib/api";
import { defaults, StepKey, steps } from "../types";
import { Viewer3D } from "../components/Viewer3D";
import { StatusDatum } from "../components/ui";
import {
  NumberField,
  SelectField,
  Slider,
  ToggleField,
  TextAreaField,
} from "../components/form";
import {
  buildConfigPreview,
  executionModeLabel,
  formatBytes,
  formatRunTime,
  groupRuns,
  statusClass,
  stepName,
  suggestedResumeStep,
} from "../lib/utils";
import { useState } from "react";

interface WorkflowProps {
  activeStep: number;
  busy: boolean;
  canStart: boolean;
  handleFile: (file?: File) => void;
  health: any;
  job: SimulationJob | null;
  parameters: typeof defaults;
  setActiveStep: (step: number) => void;
  setParameters: (params: typeof defaults) => void;
  startSimulation: (params: any) => void;
  upload: UploadedCoordinate | null;
  uploads: UploadedCoordinate[];
  selectUpload: (upload: UploadedCoordinate) => void;
  dark: boolean;
  gmxOptions: GromacsOptions | null;
  handleNewRun: () => void;
}

function StepOptions({
  activeStep,
  gpuAvailable,
  parameters,
  setParameters,
  gmxOptions,
  openHelp,
}: {
  activeStep: StepKey;
  gpuAvailable: boolean;
  parameters: typeof defaults;
  setParameters: (parameters: typeof defaults) => void;
  gmxOptions: GromacsOptions | null;
  openHelp: (cmd: string) => void;
}) {
  const updateCustom = (cmd: string, val: string) => {
    setParameters({
      ...parameters,
      customArgs: { ...parameters.customArgs, [cmd]: val },
    });
  };

  if (activeStep === "topology") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField
          label="Force field"
          help="Passed to gmx pdb2gmx with -ff."
          value={parameters.forceField}
          options={gmxOptions?.forceFields || ["amber99sb-ildn", "charmm27"]}
          onChange={(value) =>
            setParameters({ ...parameters, forceField: value })
          }
        />
        <SelectField
          label="Water model"
          help="Passed to pdb2gmx with -water."
          value={parameters.waterModel}
          options={gmxOptions?.waterModels || ["tip3p", "spce"]}
          onChange={(value) =>
            setParameters({ ...parameters, waterModel: value })
          }
        />
        <ToggleField
          label="Ignore hydrogens"
          help="Passed to pdb2gmx with -ignh."
          checked={parameters.ignoreHydrogens}
          onChange={(value) =>
            setParameters({ ...parameters, ignoreHydrogens: value })
          }
        />
        <ToggleField
          label="Allow missing atoms"
          help="Passed to pdb2gmx with -missing."
          checked={parameters.missingAtoms}
          onChange={(value) =>
            setParameters({ ...parameters, missingAtoms: value })
          }
        />
        <SelectField
          label="Termini"
          help="Passed to pdb2gmx with -ter."
          value={parameters.termini}
          options={["interactive", "none"]}
          onChange={(value) => setParameters({ ...parameters, termini: value })}
        />
        <div className="xl:col-span-2">
          <TextAreaField
            label="Custom Parameters (pdb2gmx)"
            value={parameters.customArgs?.pdb2gmx || ""}
            onChange={(v) => updateCustom("pdb2gmx", v)}
            onHelpClick={() => openHelp("pdb2gmx")}
            placeholder="e.g., -ignh -missing -ter"
          />
        </div>
      </div>
    );
  }

  if (activeStep === "box") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField
          label="Box type"
          value={parameters.boxType}
          options={gmxOptions?.boxTypes || ["cubic", "dodecahedron"]}
          onChange={(value) => setParameters({ ...parameters, boxType: value })}
        />
        <Slider
          label="Molecule distance"
          value={parameters.distanceNm}
          min={0.6}
          max={2.5}
          step={0.1}
          suffix="nm"
          onChange={(value) =>
            setParameters({ ...parameters, distanceNm: value })
          }
        />
        <ToggleField
          label="Center molecule"
          help="Passed to editconf with -c."
          checked={parameters.centerMolecule}
          onChange={(value) =>
            setParameters({ ...parameters, centerMolecule: value })
          }
        />
        <div className="xl:col-span-2">
          <TextAreaField
            label="Custom Parameters (editconf)"
            value={parameters.customArgs?.editconf || ""}
            onChange={(v) => updateCustom("editconf", v)}
            onHelpClick={() => openHelp("editconf")}
            placeholder="e.g., -pbc -align '0 0 0' -c"
          />
        </div>
      </div>
    );
  }

  if (activeStep === "solvation") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField
          label="Solvent structure"
          value={parameters.solventStructure}
          options={["spc216.gro", "tip4p.gro"]}
          onChange={(value) =>
            setParameters({ ...parameters, solventStructure: value })
          }
        />
        <Slider
          label="Van der Waals scale"
          value={parameters.solventScale}
          min={0.45}
          max={0.75}
          step={0.01}
          suffix=""
          onChange={(value) =>
            setParameters({ ...parameters, solventScale: value })
          }
        />
        <NumberField
          label="Max solvent molecules"
          help="If 0, fills the box completely."
          value={parameters.maxSolventMolecules}
          min={0}
          step={100}
          onChange={(value) =>
            setParameters({ ...parameters, maxSolventMolecules: value })
          }
        />
        <div className="xl:col-span-2">
          <TextAreaField
            label="Custom Parameters (solvate)"
            value={parameters.customArgs?.solvate || ""}
            onChange={(v) => updateCustom("solvate", v)}
            onHelpClick={() => openHelp("solvate")}
            placeholder="e.g., -maxsol 5000"
          />
        </div>
      </div>
    );
  }

  if (activeStep === "ions_grompp" || activeStep === "ions_genion") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <ToggleField
          label="Neutralize total charge"
          checked={parameters.neutralize}
          onChange={(value) =>
            setParameters({ ...parameters, neutralize: value })
          }
        />
        <Slider
          label="Salt concentration"
          value={parameters.saltMolar}
          min={0}
          max={1}
          step={0.05}
          suffix="M"
          onChange={(value) =>
            setParameters({ ...parameters, saltMolar: value })
          }
        />
        <SelectField
          label="Positive ion"
          value={parameters.positiveIon}
          options={["NA", "K"]}
          onChange={(value) =>
            setParameters({ ...parameters, positiveIon: value })
          }
        />
        <SelectField
          label="Negative ion"
          value={parameters.negativeIon}
          options={["CL", "BR"]}
          onChange={(value) =>
            setParameters({ ...parameters, negativeIon: value })
          }
        />
        <div className="xl:col-span-2">
          {activeStep === "ions_genion" ? (
            <TextAreaField
              label="Custom Parameters (genion)"
              value={parameters.customArgs?.genion || ""}
              onChange={(v) => updateCustom("genion", v)}
              onHelpClick={() => openHelp("genion")}
              placeholder="e.g., -pname NA -nname CL"
            />
          ) : (
            <TextAreaField
              label="Custom Parameters (grompp)"
              value={parameters.customArgs?.grompp || ""}
              onChange={(v) => updateCustom("grompp", v)}
              onHelpClick={() => openHelp("grompp")}
              placeholder="e.g., -maxwarn 1"
            />
          )}
        </div>
      </div>
    );
  }

  if (activeStep === "minimize_grompp" || activeStep === "minimize_mdrun") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField
          label="Integrator"
          value={parameters.minimizer}
          options={gmxOptions?.minimizers || ["steep"]}
          onChange={(value) =>
            setParameters({ ...parameters, minimizer: value })
          }
        />
        <NumberField
          label="Maximum steps"
          value={parameters.minimizationSteps}
          min={100}
          step={1000}
          onChange={(value) =>
            setParameters({ ...parameters, minimizationSteps: value })
          }
        />
        <NumberField
          label="Energy tolerance"
          value={parameters.emtol}
          min={10}
          step={100}
          onChange={(value) => setParameters({ ...parameters, emtol: value })}
        />
        <Slider
          label="Initial step size"
          value={parameters.emstep}
          min={0.001}
          max={0.05}
          step={0.001}
          suffix="nm"
          onChange={(value) => setParameters({ ...parameters, emstep: value })}
        />
        <div className="xl:col-span-2">
          {activeStep === "minimize_grompp" ? (
            <TextAreaField
              label="Custom Parameters (grompp)"
              value={parameters.customArgs?.grompp || ""}
              onChange={(v) => updateCustom("grompp", v)}
              onHelpClick={() => openHelp("grompp")}
              placeholder="e.g., -maxwarn 1"
            />
          ) : (
            <TextAreaField
              label="Custom Parameters (mdrun)"
              value={parameters.customArgs?.mdrun || ""}
              onChange={(v) => updateCustom("mdrun", v)}
              onHelpClick={() => openHelp("mdrun")}
              placeholder="e.g., -v"
            />
          )}
        </div>
      </div>
    );
  }

  if (activeStep === "nvt_grompp" || activeStep === "nvt_mdrun") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Slider
          label="NVT length"
          value={parameters.nvtPs}
          min={10}
          max={1000}
          step={10}
          suffix="ps"
          onChange={(value) => setParameters({ ...parameters, nvtPs: value })}
        />
        <Slider
          label="Temperature"
          value={parameters.temperature}
          min={250}
          max={360}
          step={1}
          suffix="K"
          onChange={(value) =>
            setParameters({ ...parameters, temperature: value })
          }
        />
        <SelectField
          label="Thermostat"
          value={parameters.thermostat}
          options={["V-rescale", "Nose-Hoover", "Berendsen"]}
          onChange={(value) =>
            setParameters({ ...parameters, thermostat: value })
          }
        />
        <div className="xl:col-span-2">
          {activeStep === "nvt_grompp" ? (
            <TextAreaField
              label="Custom Parameters (grompp)"
              value={parameters.customArgs?.grompp || ""}
              onChange={(v) => updateCustom("grompp", v)}
              onHelpClick={() => openHelp("grompp")}
              placeholder="e.g., -maxwarn 1"
            />
          ) : (
            <TextAreaField
              label={`Custom Parameters (mdrun - ${activeStep})`}
              value={parameters.customArgs?.mdrun || ""}
              onChange={(v) => updateCustom("mdrun", v)}
              onHelpClick={() => openHelp("mdrun")}
              placeholder="e.g., -v"
            />
          )}
        </div>
      </div>
    );
  }

  if (activeStep === "npt_grompp" || activeStep === "npt_mdrun") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Slider
          label="NPT length"
          value={parameters.nptPs}
          min={10}
          max={1000}
          step={10}
          suffix="ps"
          onChange={(value) => setParameters({ ...parameters, nptPs: value })}
        />
        <Slider
          label="Pressure"
          value={parameters.pressure}
          min={0.5}
          max={2}
          step={0.1}
          suffix="bar"
          onChange={(value) =>
            setParameters({ ...parameters, pressure: value })
          }
        />
        <SelectField
          label="Barostat"
          value={parameters.barostat}
          options={["Parrinello-Rahman", "Berendsen"]}
          onChange={(value) =>
            setParameters({ ...parameters, barostat: value })
          }
        />
        <div className="xl:col-span-2">
          {activeStep === "npt_grompp" ? (
            <TextAreaField
              label="Custom Parameters (grompp)"
              value={parameters.customArgs?.grompp || ""}
              onChange={(v) => updateCustom("grompp", v)}
              onHelpClick={() => openHelp("grompp")}
              placeholder="e.g., -maxwarn 1"
            />
          ) : (
            <TextAreaField
              label={`Custom Parameters (mdrun - ${activeStep})`}
              value={parameters.customArgs?.mdrun || ""}
              onChange={(v) => updateCustom("mdrun", v)}
              onHelpClick={() => openHelp("mdrun")}
              placeholder="e.g., -v"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Slider
        label="Production length"
        value={parameters.productionNs}
        min={0.1}
        max={100}
        step={0.1}
        suffix="ns"
        onChange={(value) =>
          setParameters({ ...parameters, productionNs: value })
        }
      />
      <Slider
        label="Time step"
        value={parameters.dt}
        min={0.001}
        max={0.004}
        step={0.001}
        suffix="ps"
        onChange={(value) => setParameters({ ...parameters, dt: value })}
      />
      <NumberField
        label="Output interval"
        value={parameters.outputEveryPs}
        min={1}
        step={1}
        onChange={(value) =>
          setParameters({ ...parameters, outputEveryPs: value })
        }
      />
      <SelectField
        label="Constraints"
        value={parameters.constraints}
        options={["none", "h-bonds", "all-bonds"]}
        onChange={(value) =>
          setParameters({ ...parameters, constraints: value })
        }
      />
      <div className="xl:col-span-2">
        {activeStep === "production_grompp" ? (
          <TextAreaField
            label="Custom Parameters (grompp)"
            value={parameters.customArgs?.grompp || ""}
            onChange={(v) => updateCustom("grompp", v)}
            onHelpClick={() => openHelp("grompp")}
            placeholder="e.g., -maxwarn 1"
          />
        ) : (
          <TextAreaField
            label={`Custom Parameters (mdrun - production)`}
            value={parameters.customArgs?.mdrun || ""}
            onChange={(v) => updateCustom("mdrun", v)}
            onHelpClick={() => openHelp("mdrun")}
            placeholder="e.g., -v -nb gpu"
          />
        )}
      </div>
    </div>
  );
}

export function WorkflowView({
  activeStep,
  busy,
  canStart,
  handleFile,
  health,
  job,
  parameters,
  setActiveStep,
  setParameters,
  startSimulation,
  upload,
  uploads,
  selectUpload,
  dark,
  gmxOptions,
  handleNewRun,
}: WorkflowProps) {
  const selectedStep = steps[activeStep];
  const gpuAvailable = Boolean(health?.engine?.gpuAvailable);
  const configPreview = buildConfigPreview(parameters, upload, gpuAvailable);
  const resumeStep = suggestedResumeStep(job);

  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpModalCommand, setHelpModalCommand] = useState("");
  const [helpModalContent, setHelpModalContent] = useState("");

  const openHelp = async (cmd: string) => {
    setHelpModalCommand(cmd);
    setHelpModalContent("Loading help...");
    setHelpModalOpen(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/gromacs-help/${cmd}/`,
      );
      const data = await res.json();
      if (res.ok) {
        setHelpModalContent(data.helpText);
      } else {
        setHelpModalContent(data.error || "Failed to load help");
      }
    } catch (e) {
      setHelpModalContent("Failed to load help: " + String(e));
    }
  };

  return (
    <div className="grid h-full min-h-[960px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_minmax(520px,0.9fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_minmax(620px,0.95fr)]">
      <aside className="flex min-h-0 flex-col gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex justify-between items-center">
            <h3 className="text-base font-semibold">Input File</h3>
            <button
              onClick={handleNewRun}
              className="flex items-center gap-1 text-sm font-semibold text-ocean-600 hover:text-ocean-700 transition"
              title="Start a new run (resets configuration)"
            >
              <FileUp size={16} /> New Run
            </button>
          </div>
          <label className="mb-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ocean-200 bg-ocean-50/60 px-4 text-center transition hover:border-ocean-500 dark:border-slate-700 dark:bg-slate-950">
            <UploadCloud className="mb-2 text-ocean-600" size={26} />
            <span className="font-medium">
              {upload ? upload.originalName : "Upload new file"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              PDB, GRO, CIF, or MOL2
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".pdb,.gro,.cif,.mol2"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>
          <div className="max-h-56 space-y-2 overflow-auto">
            {uploads.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectUpload(item)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  upload?.id === item.id
                    ? "border-ocean-500 bg-ocean-50 dark:bg-ocean-950"
                    : "border-slate-200 hover:border-ocean-300 dark:border-slate-700"
                }`}
              >
                <span className="block truncate font-semibold">
                  {item.originalName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBytes(item.size)} · {formatRunTime(item.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Configure Step
          </div>
          <div className="space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const selected = activeStep === index;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                    selected
                      ? "border-ocean-500 bg-ocean-50 text-ocean-800 dark:border-ocean-500 dark:bg-ocean-950 dark:text-ocean-100"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon
                    className={selected ? "text-ocean-600" : "text-mint-600"}
                    size={20}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {step.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {step.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="flex min-h-0 flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedStep.name} Options
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedStep.detail}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {resumeStep && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  Resume suggestion: {stepName(resumeStep)}
                </span>
              )}
            </div>
          </div>
          <div className="mb-5 grid gap-4">
            <label className="block min-w-0">
              <span className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                Run name
                <InfoPopover
                  title="Run name"
                  body="Used in the run list and workspace folder. Renaming a run also renames its stored workspace folder."
                />
              </span>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
                value={parameters.runName}
                onChange={(event) =>
                  setParameters({ ...parameters, runName: event.target.value })
                }
              />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Current step:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedStep.name}
              </span>
              . Run only this step, configure the next step, or launch the
              complete pipeline from topology through production.
            </div>
          </div>
          <StepOptions
            activeStep={selectedStep.key}
            gpuAvailable={gpuAvailable}
            parameters={parameters}
            setParameters={setParameters}
            gmxOptions={gmxOptions}
            openHelp={openHelp}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Run Control</h3>
            <span className={statusClass(job?.status ?? "queued")}>
              {job?.status ?? "not started"}
            </span>
          </div>
          <div className="mb-4 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-ocean-500 to-mint-500 transition-all"
              style={{ width: `${job?.progress ?? 0}%` }}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatusDatum
                label="Input"
                value={upload?.originalName ?? "None"}
              />
              <StatusDatum label="Selected Step" value={selectedStep.name} />
              <StatusDatum
                label="Focused Run"
                value={job ? `#${job.id}` : "None"}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50 min-h-12 flex items-center justify-center gap-2"
                type="button"
                disabled={!canStart || busy}
                onClick={() =>
                  startSimulation({
                    runMode: "step",
                    startStep: selectedStep.key,
                    runUntil: selectedStep.key,
                  })
                }
              >
                <Play size={18} />
                {upload ? "Run this step" : "Missing Input"}
              </button>
              <button
                className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50 min-h-12 flex items-center justify-center gap-2"
                type="button"
                disabled={!canStart || busy}
                onClick={() =>
                  startSimulation({
                    runMode: "pipeline",
                    startStep: "topology",
                    runUntil: "production",
                  })
                }
              >
                <Rocket size={18} />
                {upload ? "Complete pipeline" : "Missing Input"}
              </button>
              <button
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 min-h-12"
                type="button"
                onClick={() =>
                  setActiveStep(Math.min(activeStep + 1, steps.length - 1))
                }
                disabled={activeStep >= steps.length - 1}
              >
                {activeStep >= steps.length - 1
                  ? "Configuration complete"
                  : "Configure next step"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <section className="min-h-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Molecule View</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {upload ? upload.originalName : "Select or upload a structure"}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              MolStar
            </span>
          </div>
          <div className="h-[360px]">
            <Viewer3D coordinateUrl={upload?.url} dark={dark} />
          </div>
        </section>
        <section className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Configuration Preview</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              live preview
            </span>
          </div>
          <pre className="h-[calc(100%-36px)] min-h-96 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-mint-100 whitespace-pre-wrap">
            {configPreview}
          </pre>
        </section>
      </aside>

      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-all">
          <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                GROMACS Help: gmx {helpModalCommand}
              </h2>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border dark:border-slate-800">
                {helpModalContent}
              </pre>
            </div>
            <div className="border-t px-6 py-4 dark:border-slate-800 text-right">
              <button
                onClick={() => setHelpModalOpen(false)}
                className="rounded-lg bg-ocean-600 px-6 py-2 font-semibold text-white shadow-soft transition hover:bg-ocean-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
