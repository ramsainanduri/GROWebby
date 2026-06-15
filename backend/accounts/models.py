from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        get_user_model(),
        on_delete=models.CASCADE,
        related_name="profile",
    )
    purpose = models.TextField(
        blank=True,
        help_text="Reason provided by the user when registering.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Profile<{self.user.username}>"
