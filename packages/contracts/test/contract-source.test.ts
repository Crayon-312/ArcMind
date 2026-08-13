import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("generated phase-one contract", () => {
  it("is generated from the reviewed OpenAPI source", () => {
    const generated = readFileSync(
      resolve(import.meta.dirname, "../src/generated/phase-1.ts"),
      "utf8",
    );

    expect(generated).toContain("createAuthSession");
    expect(generated).toContain("streamResponseEvents");
    expect(generated).toContain("AUTH_SESSION_EXPIRED");
  });
});
