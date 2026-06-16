import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Ensure a default admin superuser exists. "
        "Skips silently if the user already exists. "
        "Defaults can be overridden via arguments or environment variables."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default=os.environ.get("GROWEBBY_ADMIN_USERNAME", "admin"),
        )
        parser.add_argument(
            "--email",
            default=os.environ.get("GROWEBBY_ADMIN_EMAIL", "admin@growebby.local"),
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("GROWEBBY_ADMIN_PASSWORD", "admin"),
        )

    def handle(self, *args, **options):
        username = options["username"].strip()
        email = options["email"].strip()
        password = options["password"]

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"Admin user '{username}' already exists — skipping.")
            return

        user = User.objects.create_superuser(
            username=username, email=email, password=password
        )
        self.stdout.write(
            self.style.SUCCESS(f"Created admin user '{user.get_username()}'.")
        )
