export type DevicePreset = {
  id: string;
  brand: string;
  model: string;
  portraitWidth: number;
  portraitHeight: number;
};

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: "freeshow-1920x1080",
    brand: "FreeShow",
    model: "Presentation 1920 × 1080",
    portraitWidth: 1080,
    portraitHeight: 1920,
  },
];
