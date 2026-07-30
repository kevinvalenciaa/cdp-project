import { rmSync } from "node:fs";
import { resolve } from "node:path";

export default function globalSetup() {
  rmSync(resolve(__dirname, "../../../.context/e2e-investigations-state.json"), {
    force: true,
  });
}
