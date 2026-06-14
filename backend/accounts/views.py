from __future__ import annotations

import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import UserProfile


def user_payload(user):
    if not user.is_authenticated:
        return {"isAuthenticated": False, "user": None}

    return {
        "isAuthenticated": True,
        "user": {
            "id": user.id,
            "username": user.get_username(),
            "email": user.email,
            "isStaff": user.is_staff,
            "isSuperuser": user.is_superuser,
            "isActive": user.is_active,
            "groups": [group.name for group in user.groups.all()],
        },
    }


@ensure_csrf_cookie
@require_GET
def session_detail(request: HttpRequest) -> JsonResponse:
    return JsonResponse(user_payload(request.user))


@require_POST
def login_view(request: HttpRequest) -> JsonResponse:
    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Enter a username and password."}, status=400)

    username = body.get("username", "")
    password = body.get("password", "")

    User = get_user_model()

    # Check if user exists but is inactive (pending approval)
    try:
        candidate = User.objects.get(username=username)
        if not candidate.is_active:
            return JsonResponse(
                {
                    "error": "Your account is pending admin approval. You will be notified when access is granted."
                },
                status=403,
            )
    except User.DoesNotExist:
        pass

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "The username or password is not correct."}, status=400)

    login(request, user)
    return JsonResponse(user_payload(user))


@require_POST
def logout_view(request: HttpRequest) -> JsonResponse:
    logout(request)
    return JsonResponse({"isAuthenticated": False, "user": None})


@require_POST
def register_view(request: HttpRequest) -> JsonResponse:
    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Enter a username, email, and password."}, status=400)

    username = str(body.get("username", "")).strip()
    email = str(body.get("email", "")).strip()
    password = str(body.get("password", ""))
    purpose = str(body.get("purpose", "")).strip()

    if not username or not email or len(password) < 8:
        return JsonResponse({"error": "Use a username, email, and password with at least 8 characters."}, status=400)
    if not purpose:
        return JsonResponse({"error": "Please describe your purpose for using GROWebby."}, status=400)

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "That username is already taken."}, status=400)
    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "That email is already registered."}, status=400)

    # Create inactive user — requires admin approval before login
    user = User.objects.create_user(username=username, email=email, password=password, is_active=False)
    UserProfile.objects.create(user=user, purpose=purpose)

    return JsonResponse(
        {"registered": True, "message": "Account created. Please wait for admin approval before logging in."},
        status=201,
    )


# ── Admin-only endpoints ───────────────────────────────────────────────────────

def _require_admin(request: HttpRequest):
    """Return None if OK, else a JsonResponse error."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({"error": "Admin access required."}, status=403)
    return None


@require_GET
def admin_users_list(request: HttpRequest) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err

    User = get_user_model()
    users = []
    for u in User.objects.select_related("profile").order_by("-date_joined"):
        profile = getattr(u, "profile", None)
        users.append(
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "isActive": u.is_active,
                "isStaff": u.is_staff,
                "isSuperuser": u.is_superuser,
                "dateJoined": u.date_joined.isoformat(),
                "purpose": profile.purpose if profile else "",
            }
        )
    return JsonResponse({"users": users})


@require_POST
def admin_approve_user(request: HttpRequest, user_id: int) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err

    User = get_user_model()
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    u.is_active = True
    u.save()
    return JsonResponse({"id": u.id, "isActive": True})


@require_POST
def admin_deny_user(request: HttpRequest, user_id: int) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err

    User = get_user_model()
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    u.delete()
    return JsonResponse({"deleted": True})
