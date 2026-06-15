import { Atom, Boxes, FlaskConical, Gauge, Network, Play, Rocket, Scale, Sparkles, UploadCloud, Waves } from "lucide-react";
import { SimulationJob, UploadedCoordinate } from "../lib/api";
import { defaults, StepKey, steps } from "../types";
import { Viewer3D } from "../components/Viewer3D";
import { StatusDatum } from "../components/ui";
import { InfoPopover } from "../components/InfoPopover";
import { NumberField, SelectField, Slider, ToggleField } from "../components/form";
import { buildConfigPreview, executionModeLabel, formatBytes, formatRunTime, groupRuns, statusClass, stepName, suggestedResumeStep } from "../lib/utils";

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
}

function StepOptions({ activeStep, gpuAvailable, parameters, setParameters }: { activeStep: StepKey; gpuAvailable: boolean; parameters: typeof defaults; setParameters: (parameters: typeof defaults) => void }) {
  if (activeStep === "topology") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Force field" help="Passed to gmx pdb2gmx with -ff. Choose the force field that matches your molecule and intended protocol." value={parameters.forceField} options={["amber99sb-ildn", "charmm27", "oplsaa", "gromos54a7"]} onChange={(value) => setParameters({ ...parameters, forceField: value })} />
        <SelectField label="Water model" help="Passed to pdb2gmx with -water. Keep this compatible with the selected force field." value={parameters.waterModel} options={["tip3p", "spce", "tip4p", "tip5p"]} onChange={(value) => setParameters({ ...parameters, waterModel: value })} />
        <SelectField label="Termini handling" value={parameters.termini} options={["interactive", "charged", "neutral"]} onChange={(value) => setParameters({ ...parameters, termini: value })} />
        <ToggleField label="Ignore input hydrogens" checked={parameters.ignoreHydrogens} onChange={(value) => setParameters({ ...parameters, ignoreHydrogens: value })} />
      </div>
    );
  }

  if (activeStep === "box") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Box type" help="Passed to gmx editconf with -bt. Dodecahedron is compact for solvated globular proteins." value={parameters.boxType} options={["dodecahedron", "cubic", "triclinic", "octahedron"]} onChange={(value) => setParameters({ ...parameters, boxType: value })} />
        <Slider label="Molecule distance" help="Passed to editconf with -d. This is the minimum solute-to-box-edge distance in nm." value={parameters.distanceNm} min={0.6} max={2.5} step={0.1} suffix="nm" onChange={(value) => setParameters({ ...parameters, distanceNm: value })} />
        <ToggleField label="Center molecule in box" checked={parameters.centerMolecule} onChange={(value) => setParameters({ ...parameters, centerMolecule: value })} />
      </div>
    );
  }

  if (activeStep === "solvation") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Solvent structure" value={parameters.solventStructure} options={["spc216.gro", "tip4p.gro", "tip5p.gro"]} onChange={(value) => setParameters({ ...parameters, solventStructure: value })} />
        <Slider label="Van der Waals scale" value={parameters.solventScale} min={0.45} max={0.75} step={0.01} suffix="" onChange={(value) => setParameters({ ...parameters, solventScale: value })} />
        <NumberField label="Max solvent molecules" value={parameters.maxSolventMolecules} min={0} step={100} onChange={(value) => setParameters({ ...parameters, maxSolventMolecules: value })} />
      </div>
    );
  }

  if (activeStep === "ions") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <ToggleField label="Neutralize total charge" checked={parameters.neutralize} onChange={(value) => setParameters({ ...parameters, neutralize: value })} />
        <Slider label="Salt concentration" help="Passed to gmx genion with -conc. 0.15 M is a common physiological default." value={parameters.saltMolar} min={0} max={1} step={0.05} suffix="M" onChange={(value) => setParameters({ ...parameters, saltMolar: value })} />
        <SelectField label="Positive ion" value={parameters.positiveIon} options={["NA", "K", "CA"]} onChange={(value) => setParameters({ ...parameters, positiveIon: value })} />
        <SelectField label="Negative ion" value={parameters.negativeIon} options={["CL", "BR"]} onChange={(value) => setParameters({ ...parameters, negativeIon: value })} />
      </div>
    );
  }

  if (activeStep === "minimize") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Integrator" value={parameters.minimizer} options={["steep", "cg", "l-bfgs"]} onChange={(value) => setParameters({ ...parameters, minimizer: value })} />
        <NumberField label="Maximum steps" value={parameters.minimizationSteps} min={100} step={1000} onChange={(value) => setParameters({ ...parameters, minimizationSteps: value })} />
        <NumberField label="Energy tolerance" help="MDP emtol. Minimization stops when the maximum force is below this threshold." value={parameters.emtol} min={10} step={100} onChange={(value) => setParameters({ ...parameters, emtol: value })} />
        <Slider label="Initial step size" value={parameters.emstep} min={0.001} max={0.05} step={0.001} suffix="nm" onChange={(value) => setParameters({ ...parameters, emstep: value })} />
      </div>
    );
  }

  if (activeStep === "nvt") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Slider label="NVT length" help="Constant-volume equilibration duration. The generated nvt.mdp uses position restraints by default." value={parameters.nvtPs} min={10} max={1000} step={10} suffix="ps" onChange={(value) => setParameters({ ...parameters, nvtPs: value })} />
        <Slider label="Temperature" help="MDP ref_t in Kelvin for temperature coupling." value={parameters.temperature} min={250} max={360} step={1} suffix="K" onChange={(value) => setParameters({ ...parameters, temperature: value })} />
        <SelectField label="Thermostat" help="MDP tcoupl. V-rescale is a common equilibration thermostat for biomolecular tutorials." value={parameters.thermostat} options={["V-rescale", "Berendsen", "Nose-Hoover", "no"]} onChange={(value) => setParameters({ ...parameters, thermostat: value })} />
        <SelectField label="Constraints" help="MDP constraints. Hydrogen-bond constraints allow a 2 fs timestep in many standard workflows." value={parameters.constraints} options={["h-bonds", "all-bonds", "none"]} onChange={(value) => setParameters({ ...parameters, constraints: value })} />
      </div>
    );
  }

  if (activeStep === "npt") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Slider label="NPT length" help="Constant-pressure equilibration duration. This stage is where density should settle." value={parameters.nptPs} min={10} max={1000} step={10} suffix="ps" onChange={(value) => setParameters({ ...parameters, nptPs: value })} />
        <Slider label="Pressure" help="MDP ref_p in bar for pressure coupling." value={parameters.pressure} min={0.5} max={2} step={0.1} suffix="bar" onChange={(value) => setParameters({ ...parameters, pressure: value })} />
        <Slider label="Target density" help="Analysis reference for density plots in kg/m^3. Water near room temperature is close to 1000 kg/m^3." value={parameters.targetDensity} min={850} max={1150} step={5} suffix="kg/m3" onChange={(value) => setParameters({ ...parameters, targetDensity: value })} />
        <SelectField label="Barostat" value={parameters.barostat} options={["Parrinello-Rahman", "Berendsen", "C-rescale", "no"]} onChange={(value) => setParameters({ ...parameters, barostat: value })} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Slider label="Production length" help="Converted into production.mdp nsteps using length / dt." value={parameters.productionNs} min={0.1} max={100} step={0.1} suffix="ns" onChange={(value) => setParameters({ ...parameters, productionNs: value })} />
      <Slider label="Time step" help="MDP dt in ps. 0.002 ps is a common value when constraining bonds to hydrogen." value={parameters.dt} min={0.001} max={0.004} step={0.001} suffix="ps" onChange={(value) => setParameters({ ...parameters, dt: value })} />
      <Slider label="Output interval" value={parameters.outputEveryPs} min={1} max={100} step={1} suffix="ps" onChange={(value) => setParameters({ ...parameters, outputEveryPs: value })} />
      <SelectField label="Constraints" value={parameters.constraints} options={["h-bonds", "all-bonds", "none"]} onChange={(value) => setParameters({ ...parameters, constraints: value })} />
      <ToggleField label={gpuAvailable ? "Request GPU acceleration" : "GPU unavailable in current engine"} checked={gpuAvailable && parameters.useGpu} disabled={!gpuAvailable} onChange={(value) => setParameters({ ...parameters, useGpu: value })} />
    </div>
  );
}

export function WorkflowView({ activeStep, busy, canStart, handleFile, health, job, parameters, setActiveStep, setParameters, startSimulation, upload, uploads, selectUpload, dark }: WorkflowProps) {
  const selectedStep = steps[activeStep];
  const gpuAvailable = Boolean(health?.engine?.gpuAvailable);
  const configPreview = buildConfigPreview(parameters, upload, gpuAvailable);
  const resumeStep = suggestedResumeStep(job);

  return (
    <div className="grid h-full min-h-[960px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_minmax(520px,0.9fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_minmax(620px,0.95fr)]">
      <aside className="flex min-h-0 flex-col gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold">Input File</h3>
          <label className="mb-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ocean-200 bg-ocean-50/60 px-4 text-center transition hover:border-ocean-500 dark:border-slate-700 dark:bg-slate-950">
            <UploadCloud className="mb-2 text-ocean-600" size={26} />
            <span className="font-medium">{upload ? upload.originalName : "Upload new file"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">PDB, GRO, CIF, or MOL2</span>
            <input className="sr-only" type="file" accept=".pdb,.gro,.cif,.mol2" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          <div className="max-h-56 space-y-2 overflow-auto">
            {uploads.map((item) => (
              <button key={item.id} type="button" onClick={() => selectUpload(item)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${upload?.id === item.id ? "border-ocean-500 bg-ocean-50 dark:bg-ocean-950" : "border-slate-200 hover:border-ocean-300 dark:border-slate-700"}`}>
                <span className="block truncate font-semibold">{item.originalName}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(item.size)} · {formatRunTime(item.createdAt)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Configure Step</div>
          <div className="space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const selected = activeStep === index;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${selected ? "border-ocean-500 bg-ocean-50 text-ocean-800 dark:border-ocean-500 dark:bg-ocean-950 dark:text-ocean-100" : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"}`}
                >
                  <Icon className={selected ? "text-ocean-600" : "text-mint-600"} size={20} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{step.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{step.detail}</span>
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
              <h3 className="text-lg font-semibold">{selectedStep.name} Options</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{selectedStep.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {resumeStep && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200">Resume suggestion: {stepName(resumeStep)}</span>}
            </div>
          </div>
          <div className="mb-5 grid gap-4">
            <label className="block min-w-0">
              <span className="mb-1 flex items-center gap-1.5 text-sm font-medium">Run name<InfoPopover title="Run name" body="Used in the run list and workspace folder. Renaming a run also renames its stored workspace folder." /></span>
              <input className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800" value={parameters.runName} onChange={(event) => setParameters({ ...parameters, runName: event.target.value })} />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Current step: <span className="font-semibold text-slate-900 dark:text-white">{selectedStep.name}</span>. Run only this step, configure the next step, or launch the complete pipeline from topology through production.
            </div>
          </div>
          <StepOptions activeStep={selectedStep.key} gpuAvailable={gpuAvailable} parameters={parameters} setParameters={setParameters} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Run Control</h3>
            <span className={statusClass(job?.status ?? "queued")}>{job?.status ?? "not started"}</span>
          </div>
          <div className="mb-4 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-3 rounded-full bg-gradient-to-r from-ocean-500 to-mint-500 transition-all" style={{ width: `${job?.progress ?? 0}%` }} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatusDatum label="Input" value={upload?.originalName ?? "None"} />
              <StatusDatum label="Selected Step" value={selectedStep.name} />
              <StatusDatum label="Focused Run" value={job ? `#${job.id}` : "None"} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50 min-h-12 flex items-center justify-center gap-2" type="button" disabled={!canStart || busy} onClick={() => startSimulation({ runMode: "step", startStep: selectedStep.key, runUntil: selectedStep.key })}>
                <Play size={18} />
                Run this step
              </button>
              <button className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50 min-h-12 flex items-center justify-center gap-2" type="button" disabled={!canStart || busy} onClick={() => startSimulation({ runMode: "pipeline", startStep: "topology", runUntil: "production" })}>
                <Rocket size={18} />
                Complete pipeline
              </button>
              <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-h-12" type="button" onClick={() => setActiveStep(Math.min(activeStep + 1, steps.length - 1))} disabled={activeStep >= steps.length - 1}>
                Configure next step
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
              <p className="text-xs text-slate-500 dark:text-slate-400">{upload ? upload.originalName : "Select or upload a structure"}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">MolStar</span>
          </div>
          <div className="h-[360px]">
            <Viewer3D coordinateUrl={upload?.url} dark={dark} />
          </div>
        </section>
        <section className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Configuration Preview</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">live preview</span>
          </div>
          <pre className="h-[calc(100%-36px)] min-h-96 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-mint-100">{configPreview}</pre>
        </section>
      </aside>
    </div>
  );
}
