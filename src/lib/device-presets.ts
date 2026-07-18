export type DevicePreset = {
  id: string;
  brand: string;
  model: string;
  category: "phone" | "tablet" | "generic";
  portraitWidth: number;
  portraitHeight: number;
  aspectRatio: string;
  safeArea?: { top: number; right: number; bottom: number; left: number };
  cameraCutout?: {
    type: "none" | "notch" | "punch-hole" | "dynamic-island";
    position?: "left" | "center" | "right";
  };
};

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: "xiaomi-redmi-note-10-5g",
    brand: "Xiaomi",
    model: "Redmi Note 10 5G",
    category: "phone",
    portraitWidth: 1080,
    portraitHeight: 2400,
    aspectRatio: "20:9",
    cameraCutout: { type: "punch-hole", position: "center" },
  },
  { id: "ipad-10-2", brand: "Apple", model: "iPad 10.2-inch", category: "tablet", portraitWidth: 1620, portraitHeight: 2160, aspectRatio: "4:3" },
  { id: "ipad-10-9", brand: "Apple", model: "iPad 10.9-inch", category: "tablet", portraitWidth: 1640, portraitHeight: 2360, aspectRatio: "59:41" },
  { id: "ipad-air-11", brand: "Apple", model: "iPad Air 11-inch", category: "tablet", portraitWidth: 1640, portraitHeight: 2360, aspectRatio: "59:41" },
  { id: "ipad-air-13", brand: "Apple", model: "iPad Air 13-inch", category: "tablet", portraitWidth: 2048, portraitHeight: 2732, aspectRatio: "683:512" },
  { id: "ipad-pro-11", brand: "Apple", model: "iPad Pro 11-inch", category: "tablet", portraitWidth: 1668, portraitHeight: 2420, aspectRatio: "605:417" },
  { id: "ipad-pro-13", brand: "Apple", model: "iPad Pro 13-inch", category: "tablet", portraitWidth: 2064, portraitHeight: 2752, aspectRatio: "4:3" },
  { id: "generic-1080x1920", brand: "Generic", model: "1080 × 1920", category: "generic", portraitWidth: 1080, portraitHeight: 1920, aspectRatio: "16:9" },
  { id: "generic-1080x2160", brand: "Generic", model: "1080 × 2160", category: "generic", portraitWidth: 1080, portraitHeight: 2160, aspectRatio: "2:1" },
  { id: "generic-1080x2340", brand: "Generic", model: "1080 × 2340", category: "generic", portraitWidth: 1080, portraitHeight: 2340, aspectRatio: "13:6" },
  { id: "generic-1080x2400", brand: "Generic", model: "1080 × 2400", category: "generic", portraitWidth: 1080, portraitHeight: 2400, aspectRatio: "20:9" },
  { id: "generic-1440x3200", brand: "Generic", model: "1440 × 3200", category: "generic", portraitWidth: 1440, portraitHeight: 3200, aspectRatio: "20:9" },
];
