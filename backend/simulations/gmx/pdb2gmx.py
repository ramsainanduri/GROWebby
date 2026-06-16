from typing import Any


def build_pdb2gmx_cmd(
    gmx_bin: str, input_file: str, output_gro: str, top_file: str, posre_itp: str, parameters: dict[str, Any]
) -> list[str]:
    """
    Builds the 'gmx pdb2gmx' command exhaustively mapping parameters.
    """
    cmd = [
        gmx_bin,
        "pdb2gmx",
        "-f",
        input_file,
        "-o",
        output_gro,
        "-p",
        top_file,
        "-i",
        posre_itp,
    ]

    # Required core parameters
    if "forceField" in parameters:
        cmd.extend(["-ff", str(parameters["forceField"])])
    if "waterModel" in parameters:
        cmd.extend(["-water", str(parameters["waterModel"])])

    # Optional flags (boolean toggles)
    if parameters.get("ignoreHydrogens", True) or parameters.get("ignh"):
        cmd.append("-ignh")
    if parameters.get("missingAtoms") or parameters.get("missing"):
        cmd.append("-missing")
    if parameters.get("ter"):
        cmd.append("-ter")
    if parameters.get("inter"):
        cmd.append("-inter")
    if parameters.get("ss"):
        cmd.append("-ss")
    if parameters.get("lys"):
        cmd.append("-lys")
    if parameters.get("arg"):
        cmd.append("-arg")
    if parameters.get("asp"):
        cmd.append("-asp")
    if parameters.get("glu"):
        cmd.append("-glu")
    if parameters.get("gln"):
        cmd.append("-gln")
    if parameters.get("his"):
        cmd.append("-his")
    if parameters.get("una"):
        cmd.append("-una")
    if parameters.get("v") or parameters.get("verbose"):
        cmd.append("-v")
    if parameters.get("heavyh"):
        cmd.append("-heavyh")
    if parameters.get("deuterate"):
        cmd.append("-deuterate")
    if parameters.get("renum"):
        cmd.append("-renum")
    if not parameters.get("cmap", True):
        cmd.append("-nocmap")

    # Enum / value arguments
    if parameters.get("chainsep"):
        cmd.extend(["-chainsep", str(parameters["chainsep"])])
    if parameters.get("merge"):
        cmd.extend(["-merge", str(parameters["merge"])])
    if "angle" in parameters:
        cmd.extend(["-angle", str(parameters["angle"])])
    if "dist" in parameters:
        cmd.extend(["-dist", str(parameters["dist"])])
    if "posrefc" in parameters:
        cmd.extend(["-posrefc", str(parameters["posrefc"])])
    if parameters.get("vsite"):
        cmd.extend(["-vsite", str(parameters["vsite"])])
    if parameters.get("rtpres"):
        cmd.extend(["-rtpres", str(parameters["rtpres"])])

    # Optional output paths
    if parameters.get("indexFile") or parameters.get("n"):
        cmd.extend(["-n", str(parameters.get("indexFile") or parameters.get("n"))])
    if parameters.get("cleanPdb") or parameters.get("q"):
        cmd.extend(["-q", str(parameters.get("cleanPdb") or parameters.get("q"))])

    from .utils import append_custom_args

    custom_args_str = parameters.get("customArgs", {}).get("pdb2gmx", "")
    append_custom_args(cmd, custom_args_str)

    return cmd
