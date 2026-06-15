import json

from django.contrib.auth import get_user_model
from django.test import TestCase


class AuthApiTests(TestCase):
    def test_register_login_session_logout_flow(self):
        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps({"username": "researcher", "email": "researcher@example.org", "password": "SecurePass123", "purpose": "Molecular dynamics workflow evaluation"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["registered"])

        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["isAuthenticated"])

        user = get_user_model().objects.get(username="researcher")
        user.is_active = True
        user.save(update_fields=["is_active"])

        response = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"username": "researcher", "password": "SecurePass123"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["isAuthenticated"])

        response = self.client.get("/api/auth/session/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "researcher")

    def test_duplicate_registration_is_rejected(self):
        User = get_user_model()
        User.objects.create_user(username="researcher", email="researcher@example.org", password="SecurePass123")

        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps({"username": "researcher", "email": "new-researcher@example.org", "password": "SecurePass123"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
