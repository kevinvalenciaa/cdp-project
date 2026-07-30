import { runWorkerForever } from "./worker";

runWorkerForever().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
