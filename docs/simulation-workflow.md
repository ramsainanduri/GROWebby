# Simulation Workflow Reference

GROWebby models a GROMACS workflow as explicit steps. Each step has its own options, generated files, command preview, logs, and result artifacts.

---

## Result Storage

Run results are stored **per user** to prevent filename collisions between accounts.

### Physical layout on the host

```text
<project-root>/.app_state/media/workspaces/u<user_id>/<workspace_slug>/
```

### Inside the backend container

```text
/app/media/workspaces/u<user_id>/<workspace_slug>/
```

### Inside GROMACS engine containers

```text
/work/workspaces/u<user_id>/<workspace_slug>/
```

The `u<user_id>` prefix is an integer derived from the Django user primary key (anonymous runs use `u0`). Two users can both have a run named `my-protein` and their workspaces will never overlap.

### Workspace directory structure

```text
u<user_id>/<workspace_slug>/
├── <input>.pdb / .gro / .cif       ← uploaded coordinate file
├── topol.top                        ← GROMACS topology
├── posre.itp                        ← position restraint include
├── ions.mdp                         ← MDP for ion grompp step
├── minim.mdp                        ← MDP for minimisation
├── nvt.mdp                          ← MDP for NVT equilibration
├── npt.mdp                          ← MDP for NPT equilibration
├── production.mdp                   ← MDP for production MD
├── workflow-preview.txt             ← configuration summary snapshot
├── run-manifest.json                ← full job + parameters JSON
├── outputs/
│   ├── processed.gro                ← pdb2gmx output
│   ├── boxed.gro                    ← editconf output
│   ├── solvated.gro                 ← solvate output
│   └── ionized.gro                  ← genion output
├── minim.{tpr,gro,edr,log,trr}
├── nvt.{tpr,gro,cpt,edr,log,xtc}
├── npt.{tpr,gro,cpt,edr,log,xtc}
├── production.{tpr,gro,cpt,edr,log,xtc,trr}
├── analysis/
│   ├── topology-metrics.csv
│   ├── minimize-metrics.csv
│   ├── nvt-metrics.csv
│   ├── npt-metrics.csv
│   ├── production-metrics.csv
│   └── *-gromacs-energy.xvg        ← raw XVG from gmx energy
└── logs/
    └── *.log                        ← per-command stdout/stderr
```

---

## Step Summary

| Step | Main GROMACS commands | Primary input | Primary output |
|------|------------------------|---------------|----------------|
| Topology | `pdb2gmx` | Uploaded coordinate file | `outputs/processed.gro`, `topol.top`, `posre.itp` |
| Box | `editconf` | `outputs/processed.gro` | `outputs/boxed.gro` |
| Solvation | `solvate` | `outputs/boxed.gro`, `topol.top` | `outputs/solvated.gro`, updated topology |
| Ions | `grompp`, `genion` | `outputs/solvated.gro`, `topol.top`, `ions.mdp` | `outputs/ionized.gro`, updated topology |
| Minimize | `grompp`, `mdrun` | `outputs/ionized.gro`, `minim.mdp` | `minim.gro`, `minim.edr`, `minim.log`, `minim.tpr` |
| NVT | `grompp`, `mdrun` | `minim.gro`, `nvt.mdp` | `nvt.gro`, `nvt.cpt`, `nvt.edr`, `nvt.log` |
| NPT | `grompp`, `mdrun` | `nvt.gro`, `nvt.cpt`, `npt.mdp` | `npt.gro`, `npt.cpt`, `npt.edr`, `npt.log` |
| Production | `grompp`, `mdrun` | `npt.gro`, `npt.cpt`, `production.mdp` | `production.gro`, `production.xtc`, `production.edr`, `production.log` |

---

## Force Fields

All force fields below are shipped with GROMACS and selectable via the `forceField` parameter
(the value must match the directory name under `share/gromacs/top/`).

### AMBER family

| `forceField` value | Display name | Notes |
|--------------------|--------------|-------|
| `amber94` | AMBER94 | Classic |
| `amber96` | AMBER96 | |
| `amber99` | AMBER99 | |
| `amber99sb` | AMBER99SB | |
| `amber99sb-ildn` | AMBER99SB-ILDN *(recommended)* | Best general protein FF for GROMACS |
| `amberGS` | AMBER-GS | |
| `amber03` | AMBER03 | |
| `amber03ws` | AMBER03ws | Optimised for water interactions |
| `amber14sb` | AMBER14SB | Improved side-chain torsions |
| `amber14sb_OL15` | AMBER14SB + OL15 | AMBER14SB with RNA/DNA OL15 modifications |

### CHARMM family

| `forceField` value | Display name | Notes |
|--------------------|--------------|-------|
| `charmm27` | CHARMM27 | |
| `charmm36` | CHARMM36 | |
| `charmm36-feb2021` | CHARMM36 (Feb 2021) | Latest CHARMM36 port |
| `charmm36m` | CHARMM36m | Improved for IDPs |
| `charmmm36-mar2019` | CHARMM36 (Mar 2019) | |

### GROMOS family

| `forceField` value | Display name | Notes |
|--------------------|--------------|-------|
| `gromos43a1` | GROMOS43A1 | |
| `gromos43a2` | GROMOS43A2 | |
| `gromos45a3` | GROMOS45A3 | |
| `gromos53a5` | GROMOS53A5 | |
| `gromos53a6` | GROMOS53A6 | |
| `gromos54a7` | GROMOS54A7 | Recommended GROMOS for proteins |

### OPLS family

| `forceField` value | Display name | Notes |
|--------------------|--------------|-------|
| `oplsaa` | OPLS-AA/L | All-atom, excellent for organic molecules |
| `oplsaa_SEI` | OPLS-AA/L + SEI | With improved SEI ion parameters |

### Polarisable / Other

| `forceField` value | Display name | Notes |
|--------------------|--------------|-------|
| `amoeba` | AMOEBA | Polarisable, computationally expensive |

---

## Water Models

| `waterModel` value | Display name | Sites | Notes |
|--------------------|--------------|-------|-------|
| `tip3p` | TIP3P | 3 | Most widely used; good compatibility |
| `tip4p` | TIP4P | 4 | Better density |
| `tip4pew` | TIP4P/Ew | 4 | Optimised for particle mesh Ewald |
| `tip4p2005` | TIP4P/2005 | 4 | Best TIP4P density/diffusion |
| `tip5p` | TIP5P | 5 | Good liquid structure |
| `tip5pe` | TIP5P-E | 5 | |
| `spc` | SPC | 3 | Simple, fast |
| `spce` | SPC/E | 3 | Extended SPC; recommended over SPC |
| `spceb` | SPC/Eb | 3 | |
| `opc` | OPC | 4 | Best thermodynamic accuracy |
| `opc3` | OPC3 | 3 | 3-site OPC |
| `fb3` | FB3 | 3 | Force-balanced |
| `fb4` | FB4 | 4 | Force-balanced |
| `none` | None | — | Implicit solvent or dry systems |

---

## Step 1 — Topology (`pdb2gmx`)

Converts the uploaded coordinate file into a GROMACS processed structure and topology.

### All supported parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `forceField` | string | `amber99sb-ildn` | Force field to use (see table above) |
| `waterModel` | string | `tip3p` | Water model (see table above) |
| `ter` | bool | `false` | Interactively set termini (prompts in logs) |
| `merge` | `all` / `interactive` | — | Merge chains into single residue |
| `renum` | bool | `false` | Renumber residues sequentially |
| `heavyh` | bool | `false` | Make hydrogen masses heavier (virtual sites) |
| `chainsep` | string | — | Chain separation criterion (`id`, `ter`, `id_or_ter`, …) |
| `his` | string | — | Histidine protonation (`HIE`, `HID`, `HIP`, `H`, `D`, …) |

### Important output

- `outputs/processed.gro` — solvation-ready structure
- `topol.top` — topology (includes force field, atom types, bonds, angles, dihedrals)
- `posre.itp` — position restraint include for equilibration

### Troubleshooting

- **Unsupported residues**: use `gmx pdb2gmx -ff amber99sb-ildn -h` to list supported residues; use AmberTools or CHARMM-GUI for ligands.
- **Missing atoms**: use `gmx pdb2gmx -ignh` (default) to let GROMACS add hydrogens.
- **Termini prompts**: enable `ter` if N/C termini need non-default capping.

---

## Step 2 — Box (`editconf`)

Defines the simulation box dimensions and geometry.

### All supported parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `boxType` | string | `dodecahedron` | Box geometry: `cubic`, `triclinic`, `dodecahedron`, `octahedron` |
| `distanceNm` | float | `1.0` | Minimum solute-to-box-edge distance (nm) |
| `boxX`, `boxY`, `boxZ` | float | — | Explicit box dimensions (nm); overrides `-d` if all three provided |
| `angles` | [α, β, γ] | — | Box angles in degrees (triclinic boxes) |
| `translate` | [x, y, z] | — | Translate molecule (nm) |
| `rotate` | [x, y, z] | — | Rotate molecule (degrees) |

### Box type guide

| Type | Shape | Volume efficiency | Use case |
|------|-------|-------------------|----------|
| `dodecahedron` | Rhombic dodecahedron | ~71% of cubic | Globular proteins (recommended) |
| `octahedron` | Truncated octahedron | ~77% of cubic | Globular proteins |
| `cubic` | Cube | 100% | Membrane proteins, fibrils |
| `triclinic` | Custom | Variable | Custom unit cells |

---

## Step 3 — Solvation (`solvate`)

Fills the box with solvent and updates the topology.

### All supported parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `solventStructure` | string | `spc216.gro` | Solvent configuration file; `spc216.gro` for most water models, `tip4p.gro` for TIP4P |
| `solventScale` | float | `0.57` | Scale factor for solvent-solute van der Waals overlap cutoff |
| `maxsolv` | int | — | Maximum number of solvent molecules (leave empty for automatic) |
| `shell` | float | — | Solvate only within a shell of this thickness (nm) around the solute |

### Common `solventStructure` values

| Water model | Solvent file |
|-------------|-------------|
| TIP3P / SPC / SPC/E | `spc216.gro` |
| TIP4P / TIP4P-Ew | `tip4p.gro` |
| TIP5P | `tip5p.gro` |
| OPC | `opc.gro` |

---

## Step 4 — Ions (`grompp` + `genion`)

Adds ions to neutralise the system and set the desired salt concentration.

### All supported parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `positiveIon` | string | `NA` | Positive ion residue name (GROMACS convention): `NA`, `K`, `MG`, `CA`, `ZN` |
| `negativeIon` | string | `CL` | Negative ion residue name: `CL`, `BR`, `F`, `I` |
| `saltMolar` | float | `0.15` | Target salt concentration (mol/L); `0` = neutralise only |
| `npos` | int | — | Explicit number of positive ions (overrides `saltMolar`; use with `nneg`) |
| `nneg` | int | — | Explicit number of negative ions (used when `npos` is set) |
| `maxwarn` | int | `1` | Maximum warnings tolerated by `grompp` |
| `ionEmtol` | float | `1000` | Energy tolerance for ion-step `grompp` minimisation |
| `ionEmstep` | float | `0.01` | Step size for ion-step minimisation |

### Common ion names

| Ion | `positiveIon` / `negativeIon` value |
|-----|--------------------------------------|
| Sodium (Na⁺) | `NA` |
| Potassium (K⁺) | `K` |
| Magnesium (Mg²⁺) | `MG` |
| Calcium (Ca²⁺) | `CA` |
| Zinc (Zn²⁺) | `ZN` |
| Chloride (Cl⁻) | `CL` |
| Bromide (Br⁻) | `BR` |
| Fluoride (F⁻) | `F` |
| Iodide (I⁻) | `I` |

---

## Step 5 — Energy Minimisation (`grompp` + `mdrun`)

Relaxes steric clashes before MD equilibration.

### All supported parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `minimizer` | string | `steep` | Integrator: `steep` (steepest descent), `cg` (conjugate gradient), `l-bfgs` (L-BFGS quasi-Newton) |
| `emtol` | float | `1000.0` | Convergence criterion: max force (kJ/mol/nm) |
| `emstep` | float | `0.01` | Initial step size (nm) |
| `minimizationSteps` | int | `50000` | Maximum number of minimisation steps |
| `constraints` | string | `none` | Constraint algorithm: `none`, `h-bonds`, `all-bonds`, `h-angles`, `all-angles` |
| `cutoffScheme` | string | `Verlet` | Neighbour list scheme: `Verlet`, `group` (deprecated) |
| `nstlist` | int | `1` | Neighbour list update frequency |
| `rcoulomb` | float | `1.0` | Coulomb cutoff (nm) |
| `rvdw` | float | `1.0` | VdW cutoff (nm) |
| `coulombtype` | string | `PME` | Electrostatics method: `PME`, `Cut-off`, `Ewald`, `P3M-AD`, `Reaction-Field` |
| `pmeOrder` | int | `4` | PME interpolation order |
| `fourierspacing` | float | `0.12` | PME grid spacing (nm) |
| `vdwtype` | string | `Cut-off` | VdW type: `Cut-off`, `PME`, `Shift`, `Switch` |
| `vdwModifier` | string | `Force-switch` | VdW modifier: `None`, `Potential-switch`, `Force-switch`, `Potential-shift` |
| `rvdwSwitch` | float | `0.9` | VdW switch start (nm) |
| `lbfgsInitStep` | float | `0.01` | L-BFGS initial step size (only with `minimizer=l-bfgs`) |
| `nbfgsCorrections` | int | `10` | L-BFGS number of corrections (only with `minimizer=l-bfgs`) |
| `useGpu` | bool | `false` | Request GPU acceleration for non-bonded calculation |
| `gpuBonded` | string | `cpu` | Run bonded interactions on: `cpu`, `gpu` |
| `gpuPme` | string | `cpu` | Run PME on: `cpu`, `gpu` (requires CUDA) |
| `ntomp` | int | `0` | Number of OpenMP threads (0 = auto) |
| `ntmpi` | int | `0` | Number of MPI thread-MPI ranks (0 = auto) |

---

## Step 6 — NVT Equilibration (`grompp` + `mdrun`)

Equilibrates the system at constant volume (canonical ensemble) to reach target temperature.

### All supported parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `nvtPs` | float | `100` | NVT simulation duration (ps) |
| `dt` | float | `0.002` | Integration time step (ps) |
| `temperature` | float | `300` | Reference temperature (K) |
| `thermostat` | string | `V-rescale` | Temperature coupling: `V-rescale`, `Nose-Hoover`, `Berendsen`, `Andersen`, `velocity-rescaling` |
| `tauT` | float | `0.1` | Temperature coupling time constant (ps) |
| `tcGroups` | string | `Protein Non-Protein` | Temperature coupling groups (space-separated; must match topology) |
| `nhChainLength` | int | `10` | Nosé-Hoover chain length (only for `Nose-Hoover`) |
| `constraints` | string | `h-bonds` | Constraint algorithm |
| `constraintAlgorithm` | string | `LINCS` | Constraint solver: `LINCS`, `SHAKE` |
| `lincsIter` | int | `1` | LINCS number of iterations |
| `lincsOrder` | int | `4` | LINCS expansion order |
| `genSeed` | int | `-1` | Velocity generation seed (-1 = random) |
| `cutoffScheme` | string | `Verlet` | Neighbour list scheme |
| `nstlist` | int | `10` | Neighbour list update frequency |
| `rcoulomb` | float | `1.0` | Coulomb cutoff (nm) |
| `rvdw` | float | `1.0` | VdW cutoff (nm) |
| `coulombtype` | string | `PME` | Electrostatics method |
| `coulombModifier` | string | `Potential-shift` | Coulomb modifier |
| `pmeOrder` | int | `4` | PME interpolation order |
| `fourierspacing` | float | `0.12` | PME grid spacing (nm) |
| `ewaldRtol` | string | `1e-05` | Ewald real-space tolerance |
| `vdwtype` | string | `Cut-off` | VdW type |
| `vdwModifier` | string | `Force-switch` | VdW modifier |
| `rvdwSwitch` | float | `0.9` | VdW switch start (nm) |
| `dispCorr` | string | `EnerPres` | Long-range dispersion correction: `no`, `EnerPres`, `Ener` |
| `pbc` | string | `xyz` | Periodic boundary conditions: `xyz`, `xy`, `no` |
| `commMode` | string | `Linear` | COM motion removal: `Linear`, `Angular`, `None` |
| `nstcomm` | int | `100` | COM removal frequency |
| `outputEveryPs` | float | `10` | Output interval (ps) — sets nstxout-compressed, nstenergy, nstlog |
| `nstxout` | int | `0` | Full coordinate output interval (0 = off) |
| `nstvout` | int | `0` | Velocity output interval (0 = off) |
| `nstfout` | int | `0` | Force output interval (0 = off) |
| `compressedXPrecision` | int | `1000` | xtc lossy compression precision |
| `useGpu`, `gpuBonded`, `gpuPme`, `ntomp`, `ntmpi` | — | — | Same as Minimisation |

---

## Step 7 — NPT Equilibration (`grompp` + `mdrun`)

Equilibrates pressure and density at constant number-of-particles, pressure, temperature.

### Additional parameters beyond NVT

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `nptPs` | float | `100` | NPT simulation duration (ps) |
| `barostat` | string | `Parrinello-Rahman` | Pressure coupling: `Parrinello-Rahman`, `Berendsen`, `C-rescale`, `MTTK`, `no` |
| `pressure` | float | `1.0` | Reference pressure (bar) |
| `tauP` | float | `2.0` | Pressure coupling time constant (ps) |
| `compressibility` | string | `4.5e-5` | Isothermal compressibility (bar⁻¹); water ≈ `4.5e-5` |
| `pcoupltype` | string | `isotropic` | Pressure coupling type: `isotropic`, `semiisotropic`, `anisotropic`, `surface-tension` |
| `refcoordScaling` | string | `com` | Position restraint reference scaling: `no`, `all`, `com` |
| `targetDensity` | float | `1000` | Expected density for metric plots (kg/m³); not passed to GROMACS |

### Barostat guide

| Barostat | Use case |
|----------|----------|
| `Parrinello-Rahman` | Production quality; requires pre-equilibrated pressure |
| `C-rescale` | New in GROMACS 2021; stochastic; good for NPT equilibration |
| `Berendsen` | Fast relaxation; artefacts in production — use for equilibration only |
| `MTTK` | Martyna-Tobias-Klein; rigorous but slow |

---

## Step 8 — Production MD (`grompp` + `mdrun`)

The final production run. Position restraints are removed.

### Additional parameters beyond NVT/NPT

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `productionNs` | float | `10` | Production length (ns) |
| `integrator` | string | `md` | MD integrator: `md` (leap-frog), `md-vv` (velocity Verlet), `sd` (stochastic dynamics / Langevin), `bd` (Brownian dynamics) |
| `freeEnergy` | string | `no` | Enable free energy perturbation: `no`, `yes` (advanced; requires `lambda` parameters in MDP) |

### Integrator guide

| `integrator` | Description |
|--------------|-------------|
| `md` | Leap-frog; default, fastest |
| `md-vv` | Velocity Verlet; conserves energy more accurately |
| `sd` | Stochastic dynamics (Langevin thermostat); no separate `tcoupl` needed |
| `bd` | Brownian dynamics; for coarse-grained models |

---

## MDP Generation

GROWebby writes all five MDP files before any step runs, using the parameters from the workflow form. This means you can inspect and edit them as artifacts before launching any step.

Generated files:
- `ions.mdp` — minimal steep descent for `grompp` ion placement
- `minim.mdp` — energy minimisation
- `nvt.mdp` — NVT equilibration
- `npt.mdp` — NPT equilibration
- `production.mdp` — production MD

All generated MDP files include sections for: output control, neighbour searching, electrostatics, van der Waals, bonds/constraints, temperature coupling, pressure coupling, velocity generation, free energy, PBC, and COM motion removal.

---

## GPU Behaviour

| Engine | `-nb` | `-bonded` | `-pme` |
|--------|-------|-----------|--------|
| CPU only | CPU | CPU | CPU |
| CUDA (NVIDIA) | `gpu` | `cpu` or `gpu` | `cpu` or `gpu` |
| OpenCL (Apple Metal) | `gpu` | `cpu` | `cpu` |

If a run requests GPU but the active engine does not support it, the runner logs the condition and falls back to CPU transparently.

---

## GROMACS Plugins and Extensions

GROMACS integrates with several external tools and plugin frameworks:

| Plugin / Extension | Description |
|--------------------|-------------|
| **gmxapi** | Python API (≥ 0.4) for scripting and workflow automation |
| **MDAnalysis** | Python library for trajectory analysis (not built into GROMACS) |
| **PLUMED** | Enhanced sampling (metadynamics, umbrella sampling); compile GROMACS with `-DGMX_PLUMED=ON` |
| **GROMACS–AMBER plugin** | Hybrid force field combining GROMACS topology handling with AMBER parameters |
| **GROMACS–NAMD colvar module** | Collective variable interface (requires NAMD colvar module patch) |
| **GROMACS–OpenMM** | GPU-offload of force evaluations via OpenMM (experimental) |
| **Virtual sites (vsites)** | Built-in; enables 4 fs time step by replacing H atoms with virtual sites |
| **AWH (Accelerated Weight Histogram)** | Built-in enhanced sampling method; configured via MDP `awh-*` entries |
| **FEP / λ perturbation** | Built-in free energy perturbation; enable with `free-energy = yes` in MDP |
| **Martini CG** | Coarse-grained force field; use with `integrator = bd` or `md` |
| **replica exchange (REMD)** | Built-in; requires MPI build and `gmx mdrun -multidir` |
| **REST2 / REST** | Temperature-enhanced sampling; requires patched MDP setup |

---

## Advanced mdrun Flags

These can be passed via the `ntomp`, `ntmpi`, and related parameters:

| Flag | Parameter key | Description |
|------|---------------|-------------|
| `-ntomp N` | `ntomp` | OpenMP threads per rank |
| `-ntmpi N` | `ntmpi` | Thread-MPI ranks |
| `-pinoffset N` | `pinoffset` | CPU affinity pin offset |
| `-pinstride N` | `pinstride` | CPU affinity stride |
| `-nb gpu` | `useGpu=true` | Non-bonded on GPU |
| `-bonded gpu` | `gpuBonded=gpu` | Bonded on GPU (CUDA only) |
| `-pme gpu` | `gpuPme=gpu` | PME on GPU (CUDA only) |
| `-v` | always on for minimisation | Verbose mdrun output |
| `-maxh N` | — | Maximum wallclock hours |
| `-deffnm NAME` | auto-set per step | Default filename prefix |
