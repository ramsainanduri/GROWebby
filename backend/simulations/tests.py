import io
import json

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .models import SimulationJob, UploadedCoordinate


PDB_BYTES = b"ATOM      1  N   MET A   1      11.104  13.207   9.111  1.00 20.00           N\nEND\n"


class SimulationOwnershipTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="secret123")
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="secret123")
        self.admin = User.objects.create_user(username="admin", email="admin@example.com", password="secret123", is_staff=True)

    def upload_as(self, user, name):
        self.client.force_login(user)
        return self.client.post(
            "/api/uploads/coordinate/",
            {"file": SimpleUploadedFile(name, PDB_BYTES)},
        )

    def test_upload_is_owned_by_logged_in_user(self):
        response = self.upload_as(self.alice, "alice.pdb")
        self.assertEqual(response.status_code, 201)
        upload = UploadedCoordinate.objects.get(pk=response.json()["id"])
        self.assertEqual(upload.owner, self.alice)

    def test_regular_user_only_sees_own_runs(self):
        alice_upload = UploadedCoordinate.objects.create(owner=self.alice, original_name="alice.pdb", file=SimpleUploadedFile("alice.pdb", PDB_BYTES), size=len(PDB_BYTES))
        bob_upload = UploadedCoordinate.objects.create(owner=self.bob, original_name="bob.pdb", file=SimpleUploadedFile("bob.pdb", PDB_BYTES), size=len(PDB_BYTES))
        SimulationJob.objects.create(owner=self.alice, upload=alice_upload, parameters={})
        SimulationJob.objects.create(owner=self.bob, upload=bob_upload, parameters={})

        self.client.force_login(self.alice)
        response = self.client.get("/api/simulations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 1)
        self.assertEqual(response.json()["results"][0]["owner"], "alice")

    def test_staff_user_sees_all_runs(self):
        alice_upload = UploadedCoordinate.objects.create(owner=self.alice, original_name="alice.pdb", file=SimpleUploadedFile("alice.pdb", PDB_BYTES), size=len(PDB_BYTES))
        bob_upload = UploadedCoordinate.objects.create(owner=self.bob, original_name="bob.pdb", file=SimpleUploadedFile("bob.pdb", PDB_BYTES), size=len(PDB_BYTES))
        SimulationJob.objects.create(owner=self.alice, upload=alice_upload, parameters={})
        SimulationJob.objects.create(owner=self.bob, upload=bob_upload, parameters={})

        self.client.force_login(self.admin)
        response = self.client.get("/api/simulations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 2)
