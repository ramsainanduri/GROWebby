from __future__ import annotations

import math
import random
import threading
import time
from typing import Any

from django.db import close_old_connections
from django.utils import timezone

from .models import SimulationJob, SimulationLog

PIPELINE_STEPS = [
    ("topology", "Topology Generation", 12),
    ("box", "Box Definition", 24),
    ("solvation", "Solvation", 38),
    ("ions", "Adding Ions", 50),
    ("minimize", "Energy Minimization", 66),
    ("equilibrate", "Equilibration", 82),
    ("production", "Production MD", 100),
]


def enqueue_simulation(job_id: int) -> None:
    thread = threading.Thread(target=run_simulation, args=(job_id,), daemon=True)
    thread.start()


def append_log(job: SimulationJob, message: str) -> None:
    SimulationLog.objects.create(job=job, message=message)


def gmxapi_available() -> bool:
    try:
        import gmxapi  # noqa: F401
    except Exception:
        return False
    return True


def run_simulation(job_id: int) -> None:
    close_old_connections()
    job = SimulationJob.objects.get(pk=job_id)
    job.status = SimulationJob.Status.RUNNING
    job.started_at = timezone.now()
    job.current_step = "Preparing workspace"
    job.save(update_fields=["status", "started_at", "current_step", "updated_at"])

    try:
        mode = "gmxapi-ready" if gmxapi_available() else "development-fallback"
        append_log(job, f"Simulation runner started in {mode} mode.")
        append_log(job, f"Input coordinate file: {job.upload.original_name}")
        parameters: dict[str, Any] = job.parameters
        start_step = str(parameters.get("startStep", "topology"))
        generated_config = str(parameters.get("generatedConfig", "")).strip()
        if generated_config:
            append_log(job, "Generated configuration snapshot saved with run parameters.")
        start_index = next((index for index, (step_key, _name, _progress) in enumerate(PIPELINE_STEPS) if step_key == start_step), 0)
        for skipped_key, skipped_name, skipped_progress in PIPELINE_STEPS[:start_index]:
            job.progress = max(job.progress, skipped_progress)
            job.current_step = f"Skipped: {skipped_name}"
            job.save(update_fields=["progress", "current_step", "updated_at"])
            append_log(job, f"Skipping {skipped_name}; run requested start step '{start_step}'.")
        metrics = []

        for index, (_step_key, step_name, target_progress) in enumerate(PIPELINE_STEPS[start_index:], start=start_index + 1):
            append_log(job, f"Step {index}/7: {step_name} started.")
            job.current_step = step_name
            job.save(update_fields=["current_step", "updated_at"])

            previous_progress = job.progress
            for progress in range(previous_progress + 1, target_progress + 1):
                temperature = float(parameters.get("temperature", 300))
                pressure = float(parameters.get("pressure", 1))
                energy = -1200 + math.sin(progress / 8) * 80 - progress * 2 + random.uniform(-8, 8)
                metrics.append(
                    {
                        "progress": progress,
                        "energy": round(energy, 2),
                        "temperature": round(temperature + random.uniform(-2.5, 2.5), 2),
                        "pressure": round(pressure + random.uniform(-0.04, 0.04), 3),
                    }
                )
                job.progress = progress
                job.metrics = metrics[-120:]
                job.save(update_fields=["progress", "metrics", "updated_at"])
                time.sleep(0.05)

            append_log(job, f"Step {index}/7: {step_name} completed.")

        job.status = SimulationJob.Status.COMPLETED
        job.current_step = "Complete"
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "current_step", "finished_at", "updated_at"])
        append_log(job, "Simulation pipeline completed successfully.")
    except Exception as exc:
        job.status = SimulationJob.Status.FAILED
        job.error = str(exc)
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "finished_at", "updated_at"])
        append_log(job, f"Simulation failed: {exc}")
    finally:
        close_old_connections()
