from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
import os

from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "growebby-backend",
            "engine": {
                "selected": os.environ.get("GROWEBBY_ENGINE", "unconfigured"),
                "executionMode": os.environ.get("GROMACS_EXECUTION_MODE", "development-fallback"),
                "gromacsBinary": os.environ.get("GROMACS_BINARY", ""),
            },
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("simulations.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
