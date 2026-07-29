import { demoProvider } from "./demo-provider";
import type { DataProvider } from "./types";

/** Select the active provider by LIFT_MODE (default: demo). */
export async function getProvider(): Promise<DataProvider> {
  if (process.env.LIFT_MODE === "live") {
    const { liveProvider } = await import("./live-provider");
    return liveProvider;
  }
  return demoProvider;
}
