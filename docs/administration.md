# Administration and Access Control

GROWebby uses Django session authentication and local user accounts. It is designed for local or lab-managed deployments where an admin approves access.

## Account Lifecycle

1. A user registers from the login screen.
2. The account is created inactive.
3. An admin reviews the request in the Admin Panel.
4. The admin approves or denies access.
5. Approved users can sign in and manage their own uploads and runs.

## Creating the First Admin

Create the first admin from the project root after services are running:

```bash
docker compose exec backend python manage.py ensure_admin \
  --username admin \
  --email admin@example.com \
  --password "change-this-password"
```

Requirements:

- Password must be at least 8 characters.
- If the username already exists, the command exits with an error.
- The command does not overwrite an existing user.

You can also use Django's interactive command:

```bash
docker compose exec backend python manage.py createsuperuser
```

## Promoting Existing Users

To grant staff access:

```bash
docker compose exec backend python manage.py promote_admin researcher
```

To grant full superuser access:

```bash
docker compose exec backend python manage.py promote_admin researcher --superuser
```

Use superuser permissions sparingly. A staff user can access admin tools; a superuser can bypass normal permission checks.

## Admin Panel

The in-app Admin Panel supports:

- Listing users.
- Reviewing pending registrations.
- Approving users.
- Denying users.
- Seeing staff and active status.

Django's built-in admin remains available at:

```text
http://localhost:8000/admin/
```

Use Django admin for lower-level changes such as group assignment and direct permission edits.

## Ownership

Uploads and runs have an owner. Regular users can see:

- Their own uploads.
- Their own runs.
- Records assigned to groups they belong to.

Staff users can see all uploads and runs.

## Groups

Groups provide a path for team or lab visibility. Assign users and records to Django groups when a project should be shared by a defined set of users.

Recommended group practices:

- Use one group per lab, project, or class.
- Keep staff users separate from ordinary group membership.
- Assign uploaded files and runs to the group that owns the work.
- Avoid using superuser permissions for routine review.

## Security Notes

GROWebby is intended for trusted local or internal deployments unless hardened further.

Create `.env` from the checked-in example before running the application:

```bash
cp .env.example .env
```

Recommended production hardening:

- Set `DJANGO_DEBUG=0`.
- Set strong `DJANGO_SECRET_KEY`.
- Restrict `DJANGO_ALLOWED_HOSTS`.
- Use HTTPS in front of the backend.
- Use a persistent database service instead of local SQLite.
- Back up media workspaces and the database.
- Rotate admin credentials when sharing a machine.
