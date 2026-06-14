from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create a local admin account if the requested username does not already exist."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)

    def handle(self, *args, **options):
        username = options["username"].strip()
        email = options["email"].strip()
        password = options["password"]

        if len(password) < 8:
            raise CommandError("Admin password must be at least 8 characters.")

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            raise CommandError(f"User '{username}' already exists. Use Django admin to update or promote existing users.")

        user = User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created admin user '{user.get_username()}'."))
