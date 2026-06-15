from django.db import migrations, models
from django.utils.text import slugify


def populate_run_identity(apps, schema_editor):
    SimulationJob = apps.get_model("simulations", "SimulationJob")
    for job in SimulationJob.objects.all():
        if not job.name:
            created = job.created_at.strftime("%Y%m%d-%H%M%S") if job.created_at else f"id-{job.id}"
            job.name = f"Run {created}"
        if not job.workspace_slug:
            job.workspace_slug = f"run-{job.id}-{slugify(job.name)[:80]}"
        job.save(update_fields=["name", "workspace_slug"])


class Migration(migrations.Migration):
    dependencies = [
        ("simulations", "0002_ownership"),
    ]

    operations = [
        migrations.AddField(
            model_name="simulationjob",
            name="name",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="simulationjob",
            name="workspace_slug",
            field=models.SlugField(blank=True, max_length=180),
        ),
        migrations.RunPython(populate_run_identity, migrations.RunPython.noop),
    ]
