import assert from "node:assert/strict";
import { selectCurrentService } from "./service-display.ts";

export function runServiceDisplayTests() {
  const services = [
    { id: "past", serviceDate: "2026-07-01T09:00:00.000Z" },
    { id: "later", serviceDate: "2026-08-10T09:00:00.000Z" },
    { id: "next", serviceDate: "2026-08-05T09:00:00.000Z" },
  ];

  assert.equal(selectCurrentService(services, Date.parse("2026-08-04T00:00:00.000Z"))?.id, "next");
  assert.equal(selectCurrentService(services, Date.parse("2026-09-01T00:00:00.000Z"))?.id, "later");
  assert.equal(selectCurrentService([], Date.now()), undefined);
}
