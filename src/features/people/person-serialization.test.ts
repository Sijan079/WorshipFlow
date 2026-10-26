import assert from "node:assert/strict";
import { serializePerson } from "./person-serialization.ts";

export function runPersonSerializationTests() {
  const record = serializePerson(
    {
      id: "p1",
      firstName: "Angel Evee",
      lastName: "Hipolito",
      status: "MEMBER",
      gender: "FEMALE",
      birthdate: new Date("1952-03-04T00:00:00.000Z"),
      baptismStatus: "BAPTIZED",
      baptismDate: new Date("2019-03-10T00:00:00.000Z"),
      createdByUserId: "u1",
      updatedByUserId: "u2",
      createdAt: new Date("2026-10-26T01:00:00.000Z"),
      updatedAt: new Date("2026-10-26T02:00:00.000Z"),
      ministries: [
        { ministry: { id: "m2", label: "Youth" } },
        { ministry: { id: "m1", label: "Church Leaders" } },
      ],
    },
    new Map([
      ["u1", "Artsijan Yu"],
      ["u2", "office@example.org"],
    ]),
  );

  assert.equal(record.birthdate, "1952-03-04");
  assert.equal(record.baptismDate, "2019-03-10");
  assert.deepEqual(record.ministries.map((ministry) => ministry.label), ["Church Leaders", "Youth"]);
  assert.equal(record.createdByName, "Artsijan Yu");
  assert.equal(record.updatedByName, "office@example.org");
  assert.equal(record.createdAt, "2026-10-26T01:00:00.000Z");

  const bare = serializePerson(
    {
      id: "p2", firstName: "Joel", lastName: "Dizon", status: "VISITOR", gender: null,
      birthdate: null, baptismStatus: "UNKNOWN", baptismDate: null,
      createdByUserId: null, updatedByUserId: null,
      createdAt: new Date("2026-10-26T01:00:00.000Z"), updatedAt: new Date("2026-10-26T01:00:00.000Z"),
      ministries: [],
    },
    new Map(),
  );
  assert.equal(bare.birthdate, null);
  assert.equal(bare.createdByName, null);
}
