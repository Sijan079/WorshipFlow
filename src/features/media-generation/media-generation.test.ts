import assert from "node:assert/strict";
import {
  buildBackgroundPrompt,
  estimateBackgroundGeneration,
  parseBackgroundGenerationRequest,
} from "./media-generation.ts";

export function runMediaGenerationTests() {
  const videoRequest = parseBackgroundGenerationRequest({
    mediaType: "video",
    purpose: "lyrics",
    mood: "reflective",
    visualStyle: "abstract-light",
    textSafeArea: "center-clear",
    promptDetails: "Blue and violet light, calm movement.",
    serviceId: "8d2a12ef-a909-4358-92fb-72a135600787",
    durationSeconds: 15,
    videoQuality: "480p",
  });

  assert.equal(videoRequest.mediaType, "video");
  assert.equal(videoRequest.durationSeconds, 15);
  assert.equal(videoRequest.videoQuality, "480p");

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
    /15 seconds/
  );

  const prompt = buildBackgroundPrompt(videoRequest);
  assert.match(prompt, /seamless 15-second loop/i);
  assert.match(prompt, /matching first and final frames/i);
  assert.match(prompt, /no text/i);
  assert.match(prompt, /calm movement/i);

  const estimate = estimateBackgroundGeneration(videoRequest);
  assert.equal(estimate.mediaType, "video");
  assert.equal(estimate.durationSeconds, 15);
  assert.equal(estimate.videoQuality, "480p");
  assert.equal(estimate.seamlessLoop, true);
  assert.equal(estimate.estimatedCostUsd, 0);
  assert.match(estimate.freeTierNote, /free-tier/i);

  const imageEstimate = estimateBackgroundGeneration(
    parseBackgroundGenerationRequest({
      mediaType: "image",
      purpose: "scripture",
      mood: "reverent",
      visualStyle: "stained-glass",
      textSafeArea: "lower-third-clear",
    })
  );
  assert.equal(imageEstimate.format, "presentation-16:9");
  assert.equal(imageEstimate.providerResolution, "1920x1080");
  assert.equal(imageEstimate.seamlessLoop, false);
}
