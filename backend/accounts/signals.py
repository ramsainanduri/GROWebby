from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()

@receiver(post_save, sender=User)
def sync_user_groups(sender, instance, created, **kwargs):
    """
    Assign users to the default group based on their initial superuser status
    only when the user is created. This allows manual group assignments later.
    """
    if not created:
        return

    admin_group, _ = Group.objects.get_or_create(name='admin')
    user_group, _ = Group.objects.get_or_create(name='user')

    if instance.is_superuser:
        instance.groups.add(admin_group)
        # Ensure staff status is synced
        if not instance.is_staff:
            User.objects.filter(pk=instance.pk).update(is_staff=True)
    else:
        # Only active non-superusers belong to the 'user' group initially
        instance.groups.add(user_group)
