import assert from "node:assert/strict";
import {
  buildBackgroundPrompt,
  estimateBackgroundGeneration,
  parseBackgroundGenerationRequest,
} from "./media-generation.ts";

export function runMediaGenerationTests() {
  assert.throws(
    () =>
      parseBackgroundGenerationRequest({
        mediaType: "video",
        purpose: "lyrics",
        mood: "reflective",
        visualStyle: "abstract-light",
        textSafeArea: "center-clear",
        durationSeconds: 10,
        videoQuality: "480p",
      }),
    /Image backgrounds only/
  );

  assert.throws(
    () =>
      parseBackgroundGenerationRequest({
        mediaType: "image",
        purpose: "lyrics",
        mood: "",
        visualStyle: "abstract-light",
        textSafeArea: "center-clear",
      }),
    /Mood is required/
  );

  assert.throws(
    () =>
      parseBackgroundGenerationRequest({
        mediaType: "image",
        purpose: "lyrics",
        mood: "reflective",
        visualStyle: "",
        textSafeArea: "center-clear",
      }),
    /Style is required/
  );

  const imageEstimate = estimateBackgroundGeneration(
    parseBackgroundGenerationRequest({
      mediaType: "image",
      purpose: "scripture",
      mood: "reverent",
      visualStyle: "stained-glass",
      textSafeArea: "lower-third-clear",
    }),
    { estimatedImageCostUsd: 0.08 }
  );
  assert.equal(imageEstimate.provider, "openai");
  assert.equal(imageEstimate.mediaType, "image");
  assert.equal(imageEstimate.format, "presentation-16:9");
  assert.equal(imageEstimate.providerResolution, "1536x1024");
  assert.equal(imageEstimate.seamlessLoop, false);
  assert.equal(imageEstimate.estimatedCostUsd, 0.08);

  const prompt = buildBackgroundPrompt(
    parseBackgroundGenerationRequest({
      mediaType: "image",
      purpose: "lyrics",
      mood: "reflective",
      visualStyle: "abstract-light",
      textSafeArea: "center-clear",
      promptDetails: "Blue and violet light.",
    })
  );
  assert.doesNotMatch(prompt, /seamless 15-second loop/i);
  assert.match(prompt, /no text/i);
  assert.match(prompt, /Blue and violet light/i);
}
