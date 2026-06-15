import json

from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .models import SimulationJob, UploadedCoordinate


PDB_BYTES = b"ATOM      1  N   MET A   1      11.104  13.207   9.111  1.00 20.00           N\nEND\n"


class SimulationOwnershipTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.researcher = User.objects.create_user(username="researcher", email="researcher@example.org", password="SecureUserPass123")
        self.collaborator = User.objects.create_user(username="collaborator", email="collaborator@example.org", password="SecureUserPass123")
        self.admin = User.objects.create_user(username="admin", email="admin@example.org", password="SecureAdminPass123", is_staff=True)

    def upload_as(self, user, name):
        self.client.force_login(user)
        return self.client.post(
            "/api/uploads/coordinate/",
            {"file": SimpleUploadedFile(name, PDB_BYTES)},
        )

    def test_upload_is_owned_by_logged_in_user(self):
        response = self.upload_as(self.researcher, "researcher.pdb")
        self.assertEqual(response.status_code, 201)
        upload = UploadedCoordinate.objects.get(pk=response.json()["id"])
        self.assertEqual(upload.owner, self.researcher)

    def test_regular_user_only_sees_own_runs(self):
        researcher_upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        collaborator_upload = UploadedCoordinate.objects.create(owner=self.collaborator, original_name="collaborator.pdb", file=SimpleUploadedFile("collaborator.pdb", PDB_BYTES), size=len(PDB_BYTES))
        SimulationJob.objects.create(owner=self.researcher, upload=researcher_upload, parameters={})
        SimulationJob.objects.create(owner=self.collaborator, upload=collaborator_upload, parameters={})

        self.client.force_login(self.researcher)
        response = self.client.get("/api/simulations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 1)
        self.assertEqual(response.json()["results"][0]["owner"], "researcher")

    def test_staff_user_sees_all_runs(self):
        researcher_upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        collaborator_upload = UploadedCoordinate.objects.create(owner=self.collaborator, original_name="collaborator.pdb", file=SimpleUploadedFile("collaborator.pdb", PDB_BYTES), size=len(PDB_BYTES))
        SimulationJob.objects.create(owner=self.researcher, upload=researcher_upload, parameters={})
        SimulationJob.objects.create(owner=self.collaborator, upload=collaborator_upload, parameters={})

        self.client.force_login(self.admin)
        response = self.client.get("/api/simulations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 2)

    def test_example_setup_creates_owned_upload_and_parameters(self):
        self.client.force_login(self.researcher)
        response = self.client.post("/api/examples/lysozyme/")
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["upload"]["owner"], "researcher")
        self.assertEqual(payload["parameters"]["exampleName"], "Lysozyme tutorial example")
        self.assertTrue(UploadedCoordinate.objects.filter(original_name="lysozyme-tutorial-example.pdb", owner=self.researcher).exists())

    def test_owner_can_delete_run(self):
        upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        job = SimulationJob.objects.create(owner=self.researcher, upload=upload, parameters={})

        self.client.force_login(self.researcher)
        response = self.client.delete(f"/api/simulations/{job.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["deleted"])
        self.assertFalse(SimulationJob.objects.filter(pk=job.id).exists())

    def test_owner_can_rename_run(self):
        upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        job = SimulationJob.objects.create(owner=self.researcher, upload=upload, name="Initial run", workspace_slug="run-1-initial-run", parameters={"runName": "Initial run"})

        self.client.force_login(self.researcher)
        response = self.client.patch(
            f"/api/simulations/{job.id}/",
            data=json.dumps({"name": "Renamed run"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["name"], "Renamed run")
        self.assertIn("renamed-run", payload["workspaceSlug"])

    def test_owner_can_cancel_queued_run(self):
        upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        job = SimulationJob.objects.create(owner=self.researcher, upload=upload, status=SimulationJob.Status.QUEUED, parameters={})

        self.client.force_login(self.researcher)
        response = self.client.post(f"/api/simulations/{job.id}/cancel/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], SimulationJob.Status.CANCELLED)
        self.assertIsNone(payload["processPid"])
        job.refresh_from_db()
        self.assertEqual(job.status, SimulationJob.Status.CANCELLED)
        self.assertEqual(job.error, "Run was cancelled by the user.")

    def test_completed_run_cannot_be_cancelled(self):
        upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        job = SimulationJob.objects.create(owner=self.researcher, upload=upload, status=SimulationJob.Status.COMPLETED, parameters={})

        self.client.force_login(self.researcher)
        response = self.client.post(f"/api/simulations/{job.id}/cancel/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Cannot cancel", response.json()["error"])

    def test_later_step_requires_previous_output(self):
        upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))

        self.client.force_login(self.researcher)
        response = self.client.post(
            "/api/simulations/",
            data=json.dumps({"uploadId": upload.id, "parameters": {"startStep": "box", "runUntil": "box"}}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("previous step", response.json()["error"])

    def test_owner_can_read_and_save_artifact(self):
        upload = UploadedCoordinate.objects.create(owner=self.researcher, original_name="researcher.pdb", file=SimpleUploadedFile("researcher.pdb", PDB_BYTES), size=len(PDB_BYTES))
        job = SimulationJob.objects.create(owner=self.researcher, upload=upload, name="Artifact run", workspace_slug="run-artifact", parameters={})
        artifact_path = settings.MEDIA_ROOT / "workspaces" / job.workspace_slug / "minim.mdp"
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text("integrator = steep\n", encoding="utf-8")
        artifact = {"name": "minim.mdp", "kind": "config", "path": "minim.mdp", "url": f"/media/workspaces/{job.workspace_slug}/minim.mdp"}

        self.client.force_login(self.researcher)
        response = self.client.post(
            f"/api/simulations/{job.id}/artifacts/",
            data=json.dumps({"artifact": artifact}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("steep", response.json()["content"])

        response = self.client.put(
            f"/api/simulations/{job.id}/artifacts/",
            data=json.dumps({"artifact": artifact, "content": "integrator = cg\n"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(artifact_path.read_text(encoding="utf-8"), "integrator = cg\n")
