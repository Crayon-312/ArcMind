import { describe, expect, it } from "vitest";

import {
  describeWorkstationBoundary,
  WORKSTATION_RUNTIME_STATUS,
} from "../src/index";

describe("workstation deployment boundary", () => {
  it("remains deferred from the first VPS release", () => {
    expect(WORKSTATION_RUNTIME_STATUS).toBe("deferred");
    expect(describeWorkstationBoundary()).toContain("not on the VPS");
  });
});
