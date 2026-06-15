from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
import os
import shutil
import subprocess

from django.http import JsonResponse
from django.urls import include, path


def gpu_available() -> bool:
    mode = os.environ.get("GROMACS_EXECUTION_MODE", "")
    engine = os.environ.get("GROWEBBY_ENGINE", "")
    if "cuda" in mode or "cuda" in engine:
        return True
    if "native-opencl" not in mode and "mac-opencl-native" not in engine:
        return False
    binary = os.environ.get("GROMACS_BINARY", "").strip() or shutil.which("gmx")
    if not binary:
        return False
    try:
        completed = subprocess.run(
            [binary, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
            timeout=5,
        )
    except Exception:
        return False
    return "GPU support:" in completed.stdout and "OpenCL" in completed.stdout


def health(_request):
    has_gpu = gpu_available()
    return JsonResponse(
        {
            "status": "ok",
            "service": "growebby-backend",
            "engine": {
                "selected": os.environ.get("GROWEBBY_ENGINE", "unconfigured"),
                "executionMode": os.environ.get("GROMACS_EXECUTION_MODE", "development-fallback"),
                "gromacsBinary": os.environ.get("GROMACS_BINARY", ""),
                "gpuAvailable": has_gpu,
                "gpuBackend": "OpenCL" if has_gpu and "native-opencl" in os.environ.get("GROMACS_EXECUTION_MODE", "") else "CUDA" if has_gpu else "none",
            },
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("simulations.urls")),
]

if settings.GROWEBBY_SERVE_MEDIA:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
