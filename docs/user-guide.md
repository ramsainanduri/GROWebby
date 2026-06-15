# User Guide

GROWebby is a local web application for preparing, running, inspecting, and comparing GROMACS molecular dynamics simulations. It is designed for practical lab workflows: upload a structure, configure each stage, run one step or the complete pipeline, inspect files and logs, and review results in one place.

## Opening the Application

Start the application from the project root:

```bash
./start.sh
```

Then open:

```text
http://localhost:5173
```

The backend API is available at:

```text
http://localhost:8000/api/
```

## Signing In

GROWebby uses local accounts.

1. Open the application.
2. Sign in with your username and password.
3. If you do not have an account, use the registration screen.
4. New accounts require admin approval before they can sign in.

There is no permanent shared default account. The first admin should be created during setup or with the documented admin command.

## Main Navigation

The application sidebar contains the primary work areas:

- Dashboard: recent activity, example setup actions, and high-level status.
- Workflow Setup: upload/select files, configure simulation steps, and start runs.
- Files: uploaded coordinate files and selected input.
- Simulation Runs: run history, current status, and run deletion.
- Results: focused run workspace with produced files, logs, plots, and next-step actions.
- Stats: aggregate run status and performance overview.
- Admin Panel: user approval and user status management for staff users.
- About: version and project information.

The sidebar can collapse to icons so more screen width is available for the workflow, molecule view, config preview, and results panels.

## Uploading Coordinate Files

Use the Files page or the Workflow Setup page to upload coordinate files. Supported formats are:

- `.pdb`
- `.gro`
- `.cif`
- `.mol2`

Uploaded files are owned by the signed-in user. Staff users can see all uploads.

## Creating a Run

Open Workflow Setup and select or upload a coordinate file.

Each run has a generated name based on the input and timestamp. You can rename it before starting. Renaming a completed run also renames its workspace folder.

There are two main execution choices:

- Run this step: runs only the currently selected step.
- Complete pipeline: runs from topology through production.

Configure next step only changes the selected setup screen. It does not start a simulation.

## Running One Step at a Time

Step-by-step execution is intended for inspection and correction.

1. Select the step in Workflow Setup.
2. Confirm or adjust the options.
3. Click Run this step.
4. Review the produced files and logs in Results.
5. Edit generated config files if needed.
6. Configure the next step from the Results page or Workflow Setup.

For a later step, GROWebby checks that the previous step has completed for the selected upload. The runner imports the previous completed step workspace before executing the new step, so the required topology, structure, checkpoint, and config files are available.

## Running the Complete Pipeline

Use Complete pipeline when you want the full standard pipeline:

1. Topology
2. Box
3. Solvation
4. Ions
5. Minimize
6. NVT
7. NPT
8. Production

The complete pipeline starts at topology and stops at production. Progress, logs, output files, and plots are available while the run is active and after it completes.

## Cancelling a Run

Open the active run in Results and click Cancel run. GROWebby stores the active GROMACS process PID while a command is running, sends a termination signal to that process group, marks the job as cancelled, and keeps the logs and files produced up to that point.

If a run is still queued or between commands, cancellation marks it as cancelled before the next GROMACS command starts.

## Results Workspace

The Results page is the main inspection page for a run. It includes:

- Run status and progress.
- Execution mode.
- Run name editing.
- Produced files.
- File preview and editing for stored artifacts.
- Live and stored logs.
- Metric plots.
- Export controls.
- Cancel run for queued or running jobs.
- Configure next step.

Use this page when a run fails, when you want to inspect intermediate files, or when you need to continue a stepwise workflow.

The log window shows clean run events. Full GROMACS command output is saved as log files in Run Files. When a command fails, the event log includes the final verbose error tail so you can see the useful diagnostic text immediately.

## Plots and Exports

GROWebby stores per-step metrics as CSV artifacts. The plotting panels support:

- Stage filtering.
- Editable plot titles.
- Area or line display.
- Auto, tight, or zero-baseline scaling.
- Grid and point toggles.
- Color selection.
- CSV export.
- SVG export.

The plots are meant for quick review. For publication-quality analysis, export the CSV files and process them with your lab's preferred analysis tools.

During active `mdrun` stages, plots update with live progress points first. Once GROMACS energy files are readable, the plot data is replaced with extracted GROMACS energy, temperature, pressure, and density values where available.

## Deleting Runs

Runs can be deleted from the Simulation Runs page. Deleting a run removes the run record from the app. Treat this as a cleanup action; export or preserve important output files first.

## Example Setups

The Dashboard can create example inputs:

- Lysozyme tutorial-style setup.
- Small molecule example setup.

These are intended to verify that the UI, upload handling, workflow configuration, and execution path are functioning. They are not substitutes for validated scientific input preparation.
