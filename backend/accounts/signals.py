from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()

@receiver(post_save, sender=User)
def sync_user_groups(sender, instance, created, **kwargs):
    """
    Ensure the user is assigned to the correct group based on their superuser status.
    If they are a superuser, they belong to the 'admin' group.
    If they are not a superuser, they belong to the 'user' group.
    """
    admin_group, _ = Group.objects.get_or_create(name='admin')
    user_group, _ = Group.objects.get_or_create(name='user')

    # Remove from both groups first to ensure clean state
    instance.groups.remove(admin_group, user_group)

    if instance.is_superuser:
        instance.groups.add(admin_group)
        # Ensure staff status is synced
        if not instance.is_staff:
            User.objects.filter(pk=instance.pk).update(is_staff=True)
    else:
        # Only active non-superusers belong to the 'user' group
        # If they are pending approval (is_active=False), they might not have any group yet,
        # but assigning them to 'user' is fine as long as they can't login anyway.
        instance.groups.add(user_group)
