from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("simulations", "0003_run_identity"),
    ]

    operations = [
        migrations.AddField(
            model_name="simulationjob",
            name="process_pid",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
