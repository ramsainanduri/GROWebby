import shlex


def append_custom_args(cmd: list[str], custom_args_str: str) -> None:
    """
    Appends custom arguments to the command list, preventing duplicates of boolean flags
    that were already added by the default builders.

    If an argument (e.g., -ignh) is in custom_args_str, we remove any existing occurrence
    of it from `cmd` before appending the custom ones to ensure the custom args take precedence.
    """
    if not custom_args_str.strip():
        return

    try:
        custom_args = shlex.split(custom_args_str)
    except ValueError:
        # If parsing fails due to unbalanced quotes, just split by whitespace
        custom_args = custom_args_str.split()

    # Find flags in custom_args (arguments starting with '-')
    custom_flags = {arg for arg in custom_args if arg.startswith("-")}

    # Remove any existing flags from cmd that are overridden in custom_args
    # We do a simple pass: if the item is in custom_flags, we remove it.
    # Note: this might orphan values if the flag takes a value, but for boolean flags it's perfect.
    filtered_cmd = [arg for arg in cmd if arg not in custom_flags]

    cmd.clear()
    cmd.extend(filtered_cmd)
    cmd.extend(custom_args)
