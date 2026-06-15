from django.contrib import admin

from .models import SimulationJob, SimulationLog, UploadedCoordinate


@admin.register(UploadedCoordinate)
class UploadedCoordinateAdmin(admin.ModelAdmin):
    list_display = ("id", "original_name", "size", "created_at")


@admin.register(SimulationJob)
class SimulationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "upload", "status", "progress", "current_step", "created_at")


@admin.register(SimulationLog)
class SimulationLogAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "created_at")
