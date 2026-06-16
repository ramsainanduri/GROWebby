from typing import Any


def build_editconf_cmd(gmx_bin: str, input_file: str, output_file: str, parameters: dict[str, Any]) -> list[str]:
    """
    Builds the 'gmx editconf' command exhaustively mapping parameters.
    """
    cmd = [
        gmx_bin,
        "editconf",
        "-f",
        input_file,
        "-o",
        output_file,
    ]

    # Core geometry parameters
    if "boxType" in parameters:
        cmd.extend(["-bt", str(parameters["boxType"])])
    if "distanceNm" in parameters:
        cmd.extend(["-d", str(parameters["distanceNm"])])
    if parameters.get("centerMolecule", True) or parameters.get("c"):
        cmd.append("-c")

    # Explicit box vectors
    if "box" in parameters:
        cmd.extend(["-box", str(parameters["box"][0]), str(parameters["box"][1]), str(parameters["box"][2])])
    elif parameters.get("boxX") and parameters.get("boxY") and parameters.get("boxZ"):
        cmd.extend(["-box", str(parameters["boxX"]), str(parameters["boxY"]), str(parameters["boxZ"])])

    # Angles and transforms
    if "angles" in parameters:
        cmd.extend(
            ["-angles", str(parameters["angles"][0]), str(parameters["angles"][1]), str(parameters["angles"][2])]
        )
    if "translate" in parameters:
        cmd.extend(
            [
                "-translate",
                str(parameters["translate"][0]),
                str(parameters["translate"][1]),
                str(parameters["translate"][2]),
            ]
        )
    if "rotate" in parameters:
        cmd.extend(
            ["-rotate", str(parameters["rotate"][0]), str(parameters["rotate"][1]), str(parameters["rotate"][2])]
        )
    if "center" in parameters:
        cmd.extend(
            ["-center", str(parameters["center"][0]), str(parameters["center"][1]), str(parameters["center"][2])]
        )

    # Additional flags
    if parameters.get("princ"):
        cmd.append("-princ")
    if parameters.get("pbc"):
        cmd.append("-pbc")
    if parameters.get("align"):
        cmd.extend(["-align", str(parameters["align"])])
    if "density" in parameters:
        cmd.extend(["-density", str(parameters["density"])])
    if "scale" in parameters:
        cmd.extend(["-scale", str(parameters["scale"][0]), str(parameters["scale"][1]), str(parameters["scale"][2])])
    if parameters.get("resnr"):
        cmd.extend(["-resnr", str(parameters["resnr"])])
    if parameters.get("mut"):
        cmd.extend(["-mut", str(parameters["mut"])])

    # Index and extra inputs
    if "indexFile" in parameters or "n" in parameters:
        cmd.extend(["-n", str(parameters.get("indexFile") or parameters.get("n"))])

    return cmd
