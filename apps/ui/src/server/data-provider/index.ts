import { demoProvider } from "./demo-provider";
import type { DataProvider } from "./types";

/**
 * Select the active provider by LIFT_MODE. The live provider (the real @lift/core
 * engine) is wired in P4; until then every mode resolves to the demo provider.
 */
export async function getProvider(): Promise<DataProvider> {
  return demoProvider;
}
