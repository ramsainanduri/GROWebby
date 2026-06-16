from typing import Any


def build_mdrun_cmd(
    gmx_bin: str, deffnm: str, parameters: dict[str, Any], gpu_args: list[str], perf_args: list[str], step_key: str = ""
) -> list[str]:
    """
    Builds the 'gmx mdrun' command exhaustively mapping parameters.
    """
    cmd = [
        gmx_bin,
        "mdrun",
        "-deffnm",
        deffnm,
    ]

    if parameters.get("v") or parameters.get("verbose", True):
        if step_key == "minimize":
            cmd.append("-v")

    # Custom mdrun flags
    if "nt" in parameters:
        cmd.extend(["-nt", str(parameters["nt"])])
    if "ntomp" in parameters:
        cmd.extend(["-ntomp", str(parameters["ntomp"])])
    if "ntmpi" in parameters:
        cmd.extend(["-ntmpi", str(parameters["ntmpi"])])
    if "pin" in parameters:
        cmd.extend(["-pin", str(parameters["pin"])])
    if "pinstride" in parameters:
        cmd.extend(["-pinstride", str(parameters["pinstride"])])
    if "pme" in parameters:
        cmd.extend(["-pme", str(parameters["pme"])])
    if "pmefft" in parameters:
        cmd.extend(["-pmefft", str(parameters["pmefft"])])
    if "gpu_id" in parameters:
        cmd.extend(["-gpu_id", str(parameters["gpu_id"])])
    if "gputasks" in parameters:
        cmd.extend(["-gputasks", str(parameters["gputasks"])])

    # Additional overrides
    if "s" in parameters:
        cmd.extend(["-s", str(parameters["s"])])
    if "o" in parameters:
        cmd.extend(["-o", str(parameters["o"])])
    if "x" in parameters:
        cmd.extend(["-x", str(parameters["x"])])
    if "c" in parameters:
        cmd.extend(["-c", str(parameters["c"])])
    if "e" in parameters:
        cmd.extend(["-e", str(parameters["e"])])
    if "g" in parameters:
        cmd.extend(["-g", str(parameters["g"])])
    if "cpo" in parameters:
        cmd.extend(["-cpo", str(parameters["cpo"])])
    if "cpt" in parameters:
        cmd.extend(["-cpt", str(parameters["cpt"])])

    cmd.extend(gpu_args)
    cmd.extend(perf_args)

    from .utils import append_custom_args

    custom_args_str = parameters.get("customArgs", {}).get("mdrun", "")
    append_custom_args(cmd, custom_args_str)

    return cmd
