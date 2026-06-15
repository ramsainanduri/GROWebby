from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models


def user_upload_path(instance, filename) -> str:
    user_id = instance.owner.id if instance.owner else 0
    return f"workspaces/u{user_id}/uploads/{filename}"


class UploadedCoordinate(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="coordinate_uploads")
    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.SET_NULL, related_name="coordinate_uploads")
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to=user_upload_path)
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.original_name


class SimulationJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    upload = models.ForeignKey(UploadedCoordinate, on_delete=models.CASCADE, related_name="jobs")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="simulation_jobs")
    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.SET_NULL, related_name="simulation_jobs")
    name = models.CharField(max_length=160, blank=True)
    workspace_slug = models.SlugField(max_length=180, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    current_step = models.CharField(max_length=80, default="Waiting to start")
    progress = models.PositiveSmallIntegerField(default=0)
    parameters = models.JSONField(default=dict)
    metrics = models.JSONField(default=list)
    error = models.TextField(blank=True)
    process_pid = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Simulation #{self.pk} ({self.status})"


class SimulationLog(models.Model):
    job = models.ForeignKey(SimulationJob, on_delete=models.CASCADE, related_name="logs")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
