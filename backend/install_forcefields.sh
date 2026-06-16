#!/usr/bin/env bash
set -e

echo "Installing missing CHARMM36 force fields for GROMACS..."

GMX_TOP="/usr/local/gromacs/share/gromacs/top"

# Ensure the top directory exists (it should, if GROMACS is installed)
if [ ! -d "$GMX_TOP" ]; then
    echo "Warning: GROMACS top directory $GMX_TOP not found. Skipping."
    exit 0
fi

cd "$GMX_TOP"

# Download and extract CHARMM36 (Feb 2021)
if [ ! -d "charmm36-feb2021.ff" ]; then
    echo "Downloading charmm36-feb2021.ff..."
    curl -sS -o charmm36-feb2021.ff.tgz "http://mackerell.umaryland.edu/download.php?filename=CHARMM_ff_params_files/charmm36-feb2021.ff.tgz"
    tar -xzf charmm36-feb2021.ff.tgz
    rm charmm36-feb2021.ff.tgz
fi

# Download and extract CHARMM36 (Mar 2019)
if [ ! -d "charmm36-mar2019.ff" ]; then
    echo "Downloading charmm36-mar2019.ff..."
    curl -sS -o charmm36-mar2019.ff.tgz "http://mackerell.umaryland.edu/download.php?filename=CHARMM_ff_params_files/charmm36-mar2019.ff.tgz"
    tar -xzf charmm36-mar2019.ff.tgz
    rm charmm36-mar2019.ff.tgz
fi

# Download and extract CHARMM36 (Jul 2022) to act as the default "charmm36.ff" and "charmm36m.ff"
if [ ! -d "charmm36.ff" ]; then
    echo "Downloading charmm36-jul2022.ff as default charmm36.ff..."
    curl -sS -o charmm36-jul2022.ff.tgz "http://mackerell.umaryland.edu/download.php?filename=CHARMM_ff_params_files/charmm36-jul2022.ff.tgz"
    tar -xzf charmm36-jul2022.ff.tgz
    mv charmm36-jul2022.ff charmm36.ff
    # GROMACS uses the directory name. The charmm36.ff contains both C36 and C36m options.
    cp -r charmm36.ff charmm36m.ff
    rm charmm36-jul2022.ff.tgz
fi

# Install amber03ws.ff from bestlab github
if [ ! -d "amber03ws.ff" ]; then
    echo "Downloading amber03ws.ff..."
    curl -sS -L -o bestlab.zip "https://github.com/bestlab/force_fields/archive/refs/heads/master.zip"
    unzip -q bestlab.zip "force_fields-master/gromacs_format/amber03ws.ff/*" -d /tmp/bestlab || true
    if [ -d "/tmp/bestlab/force_fields-master/gromacs_format/amber03ws.ff" ]; then
        mv /tmp/bestlab/force_fields-master/gromacs_format/amber03ws.ff .
    fi
    rm -rf bestlab.zip /tmp/bestlab
fi

# Install amber14sb_OL15.ff from intbio github
if [ ! -d "amber14sb_OL15.ff" ]; then
    echo "Downloading amber14sb_OL15.ff..."
    curl -sS -L -o intbio.zip "https://github.com/intbio/gromacs_ff/archive/refs/heads/master.zip"
    unzip -q intbio.zip "gromacs_ff-master/amber14sb_OL15.ff/*" -d /tmp/intbio || true
    if [ -d "/tmp/intbio/gromacs_ff-master/amber14sb_OL15.ff" ]; then
        mv /tmp/intbio/gromacs_ff-master/amber14sb_OL15.ff .
    fi
    rm -rf intbio.zip /tmp/intbio
fi

echo "Additional force fields installed successfully."
