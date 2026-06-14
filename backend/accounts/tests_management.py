from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase


class AdminCommandTests(TestCase):
    def test_ensure_admin_creates_superuser(self):
        output = StringIO()

        call_command(
            "ensure_admin",
            username="admin",
            email="admin@example.com",
            password="correct-horse",
            stdout=output,
        )

        user = get_user_model().objects.get(username="admin")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertIn("Created admin user", output.getvalue())

    def test_ensure_admin_errors_when_user_exists(self):
        User = get_user_model()
        User.objects.create_user(username="admin", email="admin@example.com", password="correct-horse")

        with self.assertRaises(CommandError):
            call_command(
                "ensure_admin",
                username="admin",
                email="admin@example.com",
                password="correct-horse",
            )

    def test_promote_admin_promotes_existing_user(self):
        User = get_user_model()
        User.objects.create_user(username="researcher", email="r@example.com", password="correct-horse")

        call_command("promote_admin", "researcher", superuser=True)

        user = User.objects.get(username="researcher")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
