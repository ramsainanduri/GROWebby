export function gpuSupportSummary(platform: "mac" | "linux-nvidia" | "linux-amd" | "linux-intel" | "unknown") {
  if (platform === "mac") {
    return {
      label: "Apple M-series",
      backend: "OpenCL",
      message: "Apple M-series Macs do not support CUDA. GROMACS lists Apple M-series GPU acceleration under OpenCL, so the CUDA engine is not the Mac GPU path."
    };
  }

  if (platform === "linux-nvidia") {
    return {
      label: "Linux NVIDIA",
      backend: "CUDA",
      message: "Use the Docker Compose gpu profile with the CUDA GROMACS engine on a Linux host with NVIDIA Container Toolkit."
    };
  }

  if (platform === "linux-amd") {
    return {
      label: "Linux AMD",
      backend: "SYCL",
      message: "GROMACS recommends SYCL for AMD GPUs. This needs a separate non-CUDA engine image."
    };
  }

  if (platform === "linux-intel") {
    return {
      label: "Linux Intel",
      backend: "SYCL",
      message: "GROMACS recommends SYCL for Intel GPUs. This needs a separate non-CUDA engine image."
    };
  }

  return {
    label: "Unknown",
    backend: "CPU fallback",
    message: "Use CPU execution until a matching GROMACS GPU backend is configured."
  };
}
