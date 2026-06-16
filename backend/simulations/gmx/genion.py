from typing import Any


def build_genion_cmd(gmx_bin: str, tpr_file: str, out_gro: str, top_file: str, parameters: dict[str, Any]) -> list[str]:
    """
    Builds the 'gmx genion' command exhaustively mapping parameters.
    """
    cmd = [
        gmx_bin,
        "genion",
        "-s",
        tpr_file,
        "-o",
        out_gro,
        "-p",
        top_file,
    ]

    # Ion types
    if "positiveIon" in parameters:
        cmd.extend(["-pname", str(parameters["positiveIon"])])
    elif "pname" in parameters:
        cmd.extend(["-pname", str(parameters["pname"])])

    if "negativeIon" in parameters:
        cmd.extend(["-nname", str(parameters["negativeIon"])])
    elif "nname" in parameters:
        cmd.extend(["-nname", str(parameters["nname"])])

    # Concentration or explicit numbers
    if parameters.get("npos") or parameters.get("np"):
        np_val = parameters.get("npos") or parameters.get("np")
        nn_val = parameters.get("nneg") or parameters.get("nn") or 0
        cmd.extend(["-np", str(np_val), "-nn", str(nn_val)])
    else:
        if "saltMolar" in parameters:
            cmd.extend(["-conc", str(parameters["saltMolar"])])
        elif "conc" in parameters:
            cmd.extend(["-conc", str(parameters["conc"])])

        if parameters.get("neutralize", True) or parameters.get("neutral"):
            cmd.append("-neutral")

    # Additional flags
    if parameters.get("pq"):
        cmd.extend(["-pq", str(parameters["pq"])])
    if parameters.get("nq"):
        cmd.extend(["-nq", str(parameters["nq"])])
    if parameters.get("rmin"):
        cmd.extend(["-rmin", str(parameters["rmin"])])
    if parameters.get("seed"):
        cmd.extend(["-seed", str(parameters["seed"])])

    if "indexFile" in parameters or "n" in parameters:
        cmd.extend(["-n", str(parameters.get("indexFile") or parameters.get("n"))])

    from .utils import append_custom_args

    custom_args_str = parameters.get("customArgs", {}).get("genion", "")
    append_custom_args(cmd, custom_args_str)

    return cmd
