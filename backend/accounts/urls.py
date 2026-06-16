from django.urls import path

from . import views

urlpatterns = [
    path("session/", views.session_detail),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("register/", views.register_view),
    # Admin endpoints
    path("admin/users/", views.admin_users_list),
    path("admin/users/create/", views.admin_create_user),
    path("admin/users/<int:user_id>/update/", views.admin_update_user),
    path("admin/users/<int:user_id>/reset-password/", views.admin_reset_user_password),
    path("admin/users/<int:user_id>/approve/", views.admin_approve_user),
    path("admin/users/<int:user_id>/delete/", views.admin_delete_user),
    # Admin Group endpoints
    path("admin/groups/", views.admin_list_groups),
    path("admin/groups/create/", views.admin_create_group),
    path("admin/groups/<int:group_id>/update/", views.admin_update_group),
    path("admin/groups/<int:group_id>/delete/", views.admin_delete_group),
]
