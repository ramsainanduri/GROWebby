from __future__ import annotations

import json
import time
from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .models import SimulationJob, SimulationLog, UploadedCoordinate
from .runner import enqueue_simulation


def visible_uploads(request: HttpRequest):
    queryset = UploadedCoordinate.objects.all()
    if request.user.is_authenticated and request.user.is_staff:
        return queryset
    if request.user.is_authenticated:
        group_ids = request.user.groups.values_list("id", flat=True)
        return queryset.filter(owner=request.user) | queryset.filter(group_id__in=group_ids)
    return queryset.filter(owner__isnull=True)


def visible_jobs(request: HttpRequest):
    queryset = SimulationJob.objects.select_related("upload", "owner", "group")
    if request.user.is_authenticated and request.user.is_staff:
        return queryset
    if request.user.is_authenticated:
        group_ids = request.user.groups.values_list("id", flat=True)
        return queryset.filter(owner=request.user) | queryset.filter(group_id__in=group_ids)
    return queryset.filter(owner__isnull=True)


def upload_payload(upload: UploadedCoordinate) -> dict[str, Any]:
    return {
        "id": upload.id,
        "originalName": upload.original_name,
        "size": upload.size,
        "url": upload.file.url,
        "owner": upload.owner.get_username() if upload.owner else None,
        "group": upload.group.name if upload.group else None,
        "createdAt": upload.created_at.isoformat(),
    }


def job_payload(job: SimulationJob) -> dict[str, Any]:
    return {
        "id": job.id,
        "status": job.status,
        "currentStep": job.current_step,
        "progress": job.progress,
        "parameters": job.parameters,
        "metrics": job.metrics,
        "error": job.error,
        "upload": upload_payload(job.upload),
        "owner": job.owner.get_username() if job.owner else None,
        "group": job.group.name if job.group else None,
        "createdAt": job.created_at.isoformat(),
        "updatedAt": job.updated_at.isoformat(),
        "startedAt": job.started_at.isoformat() if job.started_at else None,
        "finishedAt": job.finished_at.isoformat() if job.finished_at else None,
    }


@csrf_exempt
@require_POST
def upload_coordinate(request: HttpRequest) -> JsonResponse:
    coordinate = request.FILES.get("file")
    if coordinate is None:
        return JsonResponse({"error": "Upload a coordinate file with the form field name 'file'."}, status=400)

    allowed_extensions = (".pdb", ".gro", ".cif", ".mol2")
    if not coordinate.name.lower().endswith(allowed_extensions):
        return JsonResponse({"error": "Supported coordinate formats: PDB, GRO, CIF, MOL2."}, status=400)

    first_group = request.user.groups.first() if request.user.is_authenticated else None
    upload = UploadedCoordinate.objects.create(
        owner=request.user if request.user.is_authenticated else None,
        group=first_group,
        original_name=coordinate.name,
        file=coordinate,
        size=coordinate.size,
    )
    return JsonResponse(upload_payload(upload), status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def simulations(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        latest = visible_jobs(request).select_related("upload").order_by("-created_at")[:50]
        return JsonResponse({"results": [job_payload(job) for job in latest]})

    try:
        body = json.loads(request.body.decode("utf-8"))
        upload = visible_uploads(request).get(pk=body["uploadId"])
    except (json.JSONDecodeError, KeyError, ObjectDoesNotExist):
        return JsonResponse({"error": "Provide a valid uploadId and parameters JSON body."}, status=400)

    job = SimulationJob.objects.create(
        upload=upload,
        owner=request.user if request.user.is_authenticated else upload.owner,
        group=upload.group,
        parameters=body.get("parameters", {}),
    )
    enqueue_simulation(job.id)
    return JsonResponse(job_payload(job), status=201)


@require_GET
def simulation_detail(_request: HttpRequest, job_id: int) -> JsonResponse:
    try:
        job = visible_jobs(_request).select_related("upload").get(pk=job_id)
    except SimulationJob.DoesNotExist:
        return JsonResponse({"error": "Simulation not found."}, status=404)
    return JsonResponse(job_payload(job))


@require_GET
def simulation_logs(_request: HttpRequest, job_id: int) -> StreamingHttpResponse:
    def events():
        last_id = 0
        while True:
            logs = SimulationLog.objects.filter(job_id=job_id, id__gt=last_id)
            for log in logs:
                last_id = log.id
                yield f"data: {json.dumps({'id': log.id, 'message': log.message, 'createdAt': log.created_at.isoformat()})}\n\n"

            try:
                job = visible_jobs(_request).get(pk=job_id)
            except SimulationJob.DoesNotExist:
                yield "event: error\ndata: {\"error\":\"Simulation not found\"}\n\n"
                break

            if job.status in {SimulationJob.Status.COMPLETED, SimulationJob.Status.FAILED, SimulationJob.Status.CANCELLED}:
                yield f"event: done\ndata: {json.dumps({'status': job.status})}\n\n"
                break

            time.sleep(1)

    response = StreamingHttpResponse(events(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_GET
def simulation_log_history(_request: HttpRequest, job_id: int) -> JsonResponse:
    if not visible_jobs(_request).filter(pk=job_id).exists():
        return JsonResponse({"error": "Simulation not found."}, status=404)

    logs = SimulationLog.objects.filter(job_id=job_id)
    return JsonResponse(
        {
            "results": [
                {
                    "id": log.id,
                    "message": log.message,
                    "createdAt": log.created_at.isoformat(),
                }
                for log in logs
            ]
        }
    )


@require_GET
def uploads(_request: HttpRequest) -> JsonResponse:
    latest = visible_uploads(_request).order_by("-created_at")[:20]
    return JsonResponse({"results": [upload_payload(upload) for upload in latest]})
