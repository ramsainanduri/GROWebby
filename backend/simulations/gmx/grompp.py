from typing import Any


def build_grompp_cmd(
    gmx_bin: str,
    mdp_file: str,
    coord_file: str,
    top_file: str,
    out_tpr: str,
    parameters: dict[str, Any],
    ref_file: str | None = None,
    cpt_file: str | None = None,
) -> list[str]:
    """
    Builds the 'gmx grompp' command exhaustively mapping parameters.
    """
    cmd = [
        gmx_bin,
        "grompp",
        "-f",
        mdp_file,
        "-c",
        coord_file,
        "-p",
        top_file,
        "-o",
        out_tpr,
    ]

    # Optional inputs
    if ref_file:
        cmd.extend(["-r", ref_file])
    if cpt_file:
        cmd.extend(["-t", cpt_file])

    # Warnings
    maxwarn = str(parameters.get("maxwarn", 1))
    cmd.extend(["-maxwarn", maxwarn])

    # Additional flags
    if parameters.get("po"):
        cmd.extend(["-po", str(parameters["po"])])
    if parameters.get("pp"):
        cmd.extend(["-pp", str(parameters["pp"])])
    if "indexFile" in parameters or "n" in parameters:
        cmd.extend(["-n", str(parameters.get("indexFile") or parameters.get("n"))])
    if parameters.get("time"):
        cmd.extend(["-time", str(parameters["time"])])
    if parameters.get("rmvsbds"):
        cmd.append("-rmvsbds")
    if parameters.get("zero"):
        cmd.append("-zero")
    if parameters.get("renum"):
        cmd.append("-renum")

    return cmd
