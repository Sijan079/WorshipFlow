import assert from "node:assert/strict";
import { analyzeServiceText } from "./service-text-analysis.ts";

export function runServiceTextAnalysisTests() {
  const draft = analyzeServiceText(
    [
      "WS PARTICIPANTS",
      "June 14, Young People",
      "",
      "Call To Worship - Ptr. Darwin",
      "MC - Sis. Dawn",
      "Scripture Reading - Sis. Angel",
      "Offering - Sis. Samantha & Sis. Sandra Marie",
      "",
      "DETAILS:",
      "",
      "Tawag ng Pagsamba - Awit 36:5-9",
      "Speaker - Sis. Juliet",
      "Bible Reading - Hebrews 12:1-13",
      "Awit ng Pakikinig - Kahanga-hangang Salita ng Buhay, p.44",
      "Awit ng Pagtugon - Si Cristo'y Batong Matibay, p.99",
      "Pag-awit ng Himno - Dakilang Katapatan, p.12",
    ].join("\n"),
    new Date("2026-06-20T00:00:00.000Z")
  );

  assert.equal(draft.serviceDate, "2026-06-14");
  assert.equal(draft.ministryName, "Young People");

  assert.deepEqual(draft.servantAssignments, [
    { role: "CALL_TO_WORSHIP", personName: "Darwin" },
    { role: "EMCEE", personName: "Dawn" },
    { role: "SCRIPTURE_READER", personName: "Angel" },
    { role: "OFFERING", personName: "Samantha" },
    { role: "OFFERING", personName: "Sandra Marie" },
    { role: "SERMON_SPEAKER", personName: "Juliet" },
  ]);

  assert.equal(draft.sermonVerse, "Hebrews 12:1-13");
  assert.deepEqual(draft.bibleVerses, [{ verse: "Awit 36:5-9", order: 0 }]);
  assert.deepEqual(draft.hymnals, [
    { role: "HYMN_OF_PREPARATION", title: "044 - Kahanga-hangang Salita ng Buhay" },
    { role: "HYMN_OF_RESPONSE", title: "099 - Si Cristo'y Batong Matibay" },
    { role: "SONG_OF_HYMNS", title: "012 - Dakilang Katapatan" },
  ]);
}
