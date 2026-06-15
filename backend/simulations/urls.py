from django.urls import path

from . import views

urlpatterns = [
    path("uploads/", views.uploads),
    path("uploads/coordinate/", views.upload_coordinate),
    path("examples/<slug:example_key>/", views.create_example),
    path("simulations/", views.simulations),
    path("simulations/admin/all/", views.admin_all_simulations),
    path("simulations/<int:job_id>/", views.simulation_detail),
    path("simulations/<int:job_id>/cancel/", views.cancel_simulation),
    path("simulations/<int:job_id>/artifacts/", views.simulation_artifact),
    path("simulations/<int:job_id>/logs/", views.simulation_logs),
    path("simulations/<int:job_id>/logs/history/", views.simulation_log_history),
    path("gromacs-options/", views.gromacs_options),
]
