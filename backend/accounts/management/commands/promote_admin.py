from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Promote an existing local user to staff or superuser."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("--superuser", action="store_true", help="Grant full superuser permissions.")

    def handle(self, *args, **options):
        User = get_user_model()
        username = options["username"]
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as exc:
            raise CommandError(f"User '{username}' does not exist.") from exc

        user.is_staff = True
        if options["superuser"]:
            user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])

        role = "superuser" if user.is_superuser else "staff admin"
        self.stdout.write(self.style.SUCCESS(f"Promoted '{username}' to {role}."))
