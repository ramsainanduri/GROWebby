from __future__ import annotations

import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.models import Group
from django.core.mail import send_mail
from django.conf import settings
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

    try:
        send_mail(
            subject="GROWebby Registration Pending",
            message=f"Hello {username},\n\nYour registration has been received and is pending admin approval.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=True,
        )
        admin_emails = [u.email for u in User.objects.filter(is_superuser=True) if u.email]
        if admin_emails:
            send_mail(
                subject="GROWebby: New User Registration",
                message=f"A new user '{username}' ({email}) has registered.\n\nPurpose: {purpose}\n\nPlease log in to approve or deny.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=admin_emails,
                fail_silently=True,
            )
    except Exception:
        pass

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
    for u in User.objects.select_related("profile").prefetch_related("groups").order_by("-date_joined"):
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
                "groups": [g.name for g in u.groups.all()],
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

    try:
        send_mail(
            subject="GROWebby Account Approved",
            message=f"Hello {u.username},\n\nYour account has been approved. You can now log in.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[u.email],
            fail_silently=True,
        )
    except Exception:
        pass

    return JsonResponse({"id": u.id, "isActive": True})


@require_POST
def admin_delete_user(request: HttpRequest, user_id: int) -> JsonResponse:
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


@require_POST
def admin_create_user(request: HttpRequest) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    username = str(body.get("username", "")).strip()
    email = str(body.get("email", "")).strip()
    password = str(body.get("password", ""))
    is_admin = bool(body.get("isAdmin", False))
    is_active = bool(body.get("isActive", True))
    group_names = body.get("groups")

    if not username or not email or len(password) < 8:
        return JsonResponse({"error": "Use a username, email, and password with at least 8 characters."}, status=400)

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "That username is already taken."}, status=400)
    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "That email is already registered."}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        is_active=is_active,
        is_staff=is_admin,
        is_superuser=is_admin,
    )
    if group_names is not None:
        groups = Group.objects.filter(name__in=group_names)
        user.groups.set(groups)
    
    UserProfile.objects.create(user=user, purpose="Created by admin")

    return JsonResponse({"id": user.id, "created": True})


@require_POST
def admin_update_user(request: HttpRequest, user_id: int) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    User = get_user_model()
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    email = str(body.get("email", "")).strip()
    is_admin = body.get("isAdmin")
    is_active = body.get("isActive")
    group_names = body.get("groups")

    if email and email != u.email:
        if User.objects.filter(email=email).exclude(pk=user_id).exists():
            return JsonResponse({"error": "That email is already registered."}, status=400)
        u.email = email

    if is_admin is not None:
        is_admin_bool = bool(is_admin)
        u.is_staff = is_admin_bool
        u.is_superuser = is_admin_bool

    if is_active is not None:
        u.is_active = bool(is_active)

    if group_names is not None:
        groups = Group.objects.filter(name__in=group_names)
        u.groups.set(groups)

    u.save()
    return JsonResponse({"id": u.id, "updated": True})


@require_POST
def admin_reset_user_password(request: HttpRequest, user_id: int) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    password = str(body.get("password", ""))
    if len(password) < 8:
        return JsonResponse({"error": "Password must be at least 8 characters."}, status=400)

    User = get_user_model()
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    u.set_password(password)
    u.save()
    return JsonResponse({"id": u.id, "passwordReset": True})

# ── Group endpoints ────────────────────────────────────────────────────────────

@require_GET
def admin_list_groups(request: HttpRequest) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err
    groups = [{"id": g.id, "name": g.name} for g in Group.objects.all().order_by("name")]
    return JsonResponse({"groups": groups})


@require_POST
def admin_create_group(request: HttpRequest) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err
    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    
    name = str(body.get("name", "")).strip()
    if not name:
        return JsonResponse({"error": "Group name is required."}, status=400)
    
    if Group.objects.filter(name__iexact=name).exists():
        return JsonResponse({"error": "A group with this name already exists."}, status=400)
        
    g = Group.objects.create(name=name)
    return JsonResponse({"id": g.id, "name": g.name, "created": True})


@require_POST
def admin_update_group(request: HttpRequest, group_id: int) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err
    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
        
    name = str(body.get("name", "")).strip()
    if not name:
        return JsonResponse({"error": "Group name is required."}, status=400)
        
    try:
        g = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found."}, status=404)
        
    if Group.objects.filter(name__iexact=name).exclude(pk=group_id).exists():
        return JsonResponse({"error": "A group with this name already exists."}, status=400)
        
    g.name = name
    g.save()
    return JsonResponse({"id": g.id, "name": g.name, "updated": True})


@require_POST
def admin_delete_group(request: HttpRequest, group_id: int) -> JsonResponse:
    err = _require_admin(request)
    if err:
        return err
    try:
        g = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found."}, status=404)
        
    if g.name in ["admin", "user"]:
        return JsonResponse({"error": f"Cannot delete default group '{g.name}'."}, status=400)
        
    g.delete()
    return JsonResponse({"deleted": True})

