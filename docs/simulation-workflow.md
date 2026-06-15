# Simulation Workflow Reference

GROWebby models a GROMACS workflow as explicit steps. Each step has its own options, generated files, command preview, logs, and result artifacts.

## Step Summary

| Step | Main GROMACS commands | Primary input | Primary output |
|------|------------------------|---------------|----------------|
| Topology | `pdb2gmx` | Uploaded coordinate file | `outputs/processed.gro`, `topol.top` |
| Box | `editconf` | `outputs/processed.gro` | `outputs/boxed.gro` |
| Solvation | `solvate` | `outputs/boxed.gro`, `topol.top` | `outputs/solvated.gro`, updated topology |
| Ions | `grompp`, `genion` | `outputs/solvated.gro`, `topol.top`, `ions.mdp` | `outputs/ionized.gro`, updated topology |
| Minimize | `grompp`, `mdrun` | `outputs/ionized.gro`, `minim.mdp` | `minim.gro`, `minim.edr`, `minim.log`, `minim.tpr` |
| NVT | `grompp`, `mdrun` | `minim.gro`, `nvt.mdp` | `nvt.gro`, `nvt.cpt`, `nvt.edr`, `nvt.log` |
| NPT | `grompp`, `mdrun` | `nvt.gro`, `nvt.cpt`, `npt.mdp` | `npt.gro`, `npt.cpt`, `npt.edr`, `npt.log` |
| Production | `grompp`, `mdrun` | `npt.gro`, `npt.cpt`, `production.mdp` | `production.gro`, `production.xtc`, `production.edr`, `production.log` |

## Topology

Purpose: convert the uploaded coordinate file into a GROMACS-ready processed structure and topology.

Typical options:

- Force field.
- Water model.
- Ignore input hydrogens.
- Termini handling.

Important output:

- `outputs/processed.gro`
- `topol.top`

If `pdb2gmx` fails, inspect the log for unsupported residues, atom naming problems, missing hydrogens, or termini prompts.

## Box

Purpose: define the simulation box.

Typical options:

- Box type.
- Solute-box distance.
- Center molecule.

Important output:

- `outputs/boxed.gro`

## Solvation

Purpose: fill the box with solvent and update the topology molecule counts.

Typical options:

- Solvent structure file.
- Solvent scaling.
- Optional maximum solvent molecules.

Important output:

- `outputs/solvated.gro`
- updated `topol.top`

## Ions

Purpose: prepare a temporary run input and replace solvent molecules with ions.

Typical options:

- Neutralization.
- Salt concentration.
- Positive ion name.
- Negative ion name.

Important output:

- `outputs/ionized.gro`
- updated `topol.top`
- `ions.tpr`

## Energy Minimization

Purpose: reduce steric clashes and relax the solvated system before equilibration.

Typical options:

- Minimizer.
- Energy tolerance.
- Step size.
- Maximum minimization steps.
- Constraints.

Important output:

- `minim.gro`
- `minim.edr`
- `minim.log`

## NVT Equilibration

Purpose: equilibrate temperature at constant volume.

Typical options:

- NVT duration.
- Temperature.
- Thermostat.
- Constraints.

Important output:

- `nvt.gro`
- `nvt.cpt`
- `nvt.edr`
- `nvt.log`

## NPT Equilibration

Purpose: equilibrate pressure and density.

Typical options:

- NPT duration.
- Pressure.
- Barostat.
- Target density reference for plots.

Important output:

- `npt.gro`
- `npt.cpt`
- `npt.edr`
- `npt.log`

Density should be reviewed after this stage. A stable density is one of the main checks before production MD.

## Production

Purpose: run the production MD simulation.

Typical options:

- Production length.
- Time step.
- Output interval.
- Constraints.
- GPU request, when supported by the active engine.

Important output:

- `production.gro`
- `production.xtc`
- `production.edr`
- `production.log`
- `production.tpr`

## GPU Behavior

The UI may show a GPU option only when the backend reports GPU support. The backend is the source of truth:

- Docker CPU backend: no GPU flags are sent.
- Native Apple OpenCL backend: `-nb gpu` can be used when native `gmx --version` reports `GPU support: OpenCL`.
- Linux CUDA backend: CUDA GPU mode can use GPU flags when the CUDA engine is active.

If a stale request asks for GPU while the active engine has no GPU support, the runner logs the condition and runs on CPU.

## Advanced Options

GROMACS exposes many command-line and MDP options. GROWebby currently provides a curated set of commonly used controls. It does not expose every optional flag from every command.

The intended future model is an Advanced options panel for each command, generated from validated GROMACS command metadata and guarded by safe defaults.

