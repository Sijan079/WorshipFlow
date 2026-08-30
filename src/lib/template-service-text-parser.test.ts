import assert from "node:assert/strict";
import { parseTemplateServiceText } from "./template-service-text-parser.ts";

export function runTemplateServiceTextParserTests() {
  const result = parseTemplateServiceText(
    `Welcome: Jane Doe\nMessage > Speaker: John Doe\nMessage > Duration: 35\nSong: Amazing Grace\nStream: Yes`,
    {
      blocks: [
        { id: "welcome", label: "Welcome", kind: "TEXT", fieldDefinition: { fields: [] } },
        {
          id: "message",
          label: "Message",
          kind: "TEXT",
          fieldDefinition: { fields: [
            { key: "speaker", label: "Speaker", type: "person", required: true, order: 0 },
            { key: "duration", label: "Duration", type: "duration", required: false, order: 1 },
          ] },
        },
        { id: "song", label: "Song", kind: "TEXT", fieldDefinition: { fields: [] } },
        { id: "stream", label: "Stream", kind: "TEXT", fieldDefinition: { fields: [{ key: "enabled", label: "Enabled", type: "checkbox", required: false, order: 0 }] } },
      ],
      servants: [{ id: "jane", name: "Jane Doe" }, { id: "john", name: "John Doe" }],
      songs: [{ id: "grace", title: "Amazing Grace" }],
    },
  );

  assert.deepEqual(result.values, {
    welcome: { text: "Jane Doe" },
    message: { speaker: "john", duration: 35 },
    song: { text: "Amazing Grace" },
    stream: { enabled: true },
  });
  assert.equal(result.warnings.length, 0);
}
