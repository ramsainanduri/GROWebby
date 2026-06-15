from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="UploadedCoordinate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("original_name", models.CharField(max_length=255)),
                ("file", models.FileField(upload_to="uploads/")),
                ("size", models.PositiveBigIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="SimulationJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("queued", "Queued"), ("running", "Running"), ("completed", "Completed"), ("failed", "Failed"), ("cancelled", "Cancelled")], default="queued", max_length=20)),
                ("current_step", models.CharField(default="Waiting to start", max_length=80)),
                ("progress", models.PositiveSmallIntegerField(default=0)),
                ("parameters", models.JSONField(default=dict)),
                ("metrics", models.JSONField(default=list)),
                ("error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("upload", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="jobs", to="simulations.uploadedcoordinate")),
            ],
        ),
        migrations.CreateModel(
            name="SimulationLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("job", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="logs", to="simulations.simulationjob")),
            ],
            options={"ordering": ["id"]},
        ),
    ]
