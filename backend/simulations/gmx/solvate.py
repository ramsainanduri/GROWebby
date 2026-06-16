from typing import Any


def build_solvate_cmd(
    gmx_bin: str, input_file: str, output_file: str, top_file: str, parameters: dict[str, Any]
) -> list[str]:
    """
    Builds the 'gmx solvate' command exhaustively mapping parameters.
    """
    cmd = [
        gmx_bin,
        "solvate",
        "-cp",
        input_file,
        "-o",
        output_file,
        "-p",
        top_file,
    ]

    # Core solvent parameters
    if "solventStructure" in parameters:
        cmd.extend(["-cs", str(parameters["solventStructure"])])
    if "solventScale" in parameters:
        cmd.extend(["-scale", str(parameters["solventScale"])])

    # Optional flags
    if parameters.get("maxsolv") or parameters.get("maxSolventMolecules"):
        max_sol = parameters.get("maxsolv") or parameters.get("maxSolventMolecules")
        if int(max_sol) > 0:
            cmd.extend(["-maxsol", str(max_sol)])
    if "shell" in parameters:
        cmd.extend(["-shell", str(parameters["shell"])])
    if "radius" in parameters:
        cmd.extend(["-radius", str(parameters["radius"])])
    if "vel" in parameters:
        cmd.extend(["-vel", str(parameters["vel"])])

    # Explicit box
    if "box" in parameters:
        box = parameters["box"]
        cmd.extend(["-box", str(box[0]), str(box[1]), str(box[2])])

    from .utils import append_custom_args

    custom_args_str = parameters.get("customArgs", {}).get("solvate", "")
    append_custom_args(cmd, custom_args_str)

    return cmd
