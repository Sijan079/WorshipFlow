import type { Prisma } from "@prisma/client";
import type { BackgroundGenerationEstimate, BackgroundGenerationRequest } from "../media-generation";

export type BackgroundGenerationProviderResult = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  providerMetadata: Prisma.InputJsonObject;
  actualUsage: Prisma.InputJsonObject | null;
};

export type BackgroundGenerationProvider = {
  generateBackground(params: {
    request: BackgroundGenerationRequest;
    prompt: string;
    estimate: BackgroundGenerationEstimate;
  }): Promise<BackgroundGenerationProviderResult>;
};
