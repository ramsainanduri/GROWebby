from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("simulations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="uploadedcoordinate",
            name="owner",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="coordinate_uploads", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="uploadedcoordinate",
            name="group",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="coordinate_uploads", to="auth.group"),
        ),
        migrations.AddField(
            model_name="simulationjob",
            name="owner",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="simulation_jobs", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="simulationjob",
            name="group",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="simulation_jobs", to="auth.group"),
        ),
    ]
