export function calculateAudioLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample;
  const center = sum / samples.length;
  let energy = 0;
  for (const sample of samples) energy += (sample - center) ** 2;
  const level = Math.sqrt(energy / samples.length);
  return level < 0.008 ? 0 : Math.min(1, level);
}

export function resolveAudioInput(
  devices: MediaDeviceInfo[],
  selectedId: string,
): MediaDeviceInfo | null {
  return devices.find((device) => device.kind === "audioinput" && device.deviceId === selectedId) ?? null;
}
