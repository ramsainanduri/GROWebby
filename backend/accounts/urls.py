from django.urls import path

from . import views

urlpatterns = [
    path("session/", views.session_detail),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("register/", views.register_view),
    # Admin endpoints
    path("admin/users/", views.admin_users_list),
    path("admin/users/<int:user_id>/approve/", views.admin_approve_user),
    path("admin/users/<int:user_id>/deny/", views.admin_deny_user),
]
