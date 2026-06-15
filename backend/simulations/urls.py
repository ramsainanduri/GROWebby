from django.urls import path

from . import views

urlpatterns = [
    path("uploads/", views.uploads),
    path("uploads/coordinate/", views.upload_coordinate),
    path("demos/<slug:demo_key>/", views.create_demo),
    path("simulations/", views.simulations),
    path("simulations/<int:job_id>/", views.simulation_detail),
    path("simulations/<int:job_id>/cancel/", views.cancel_simulation),
    path("simulations/<int:job_id>/artifacts/", views.simulation_artifact),
    path("simulations/<int:job_id>/logs/", views.simulation_logs),
    path("simulations/<int:job_id>/logs/history/", views.simulation_log_history),
]
