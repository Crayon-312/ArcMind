export const WORKSTATION_RUNTIME_STATUS = "deferred" as const;

export function describeWorkstationBoundary(): string {
  return "The workstation client runs on the user's computer, not on the VPS.";
}
