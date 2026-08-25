/** Single-flight guard - one engine run at a time (a second concurrent run would
 *  double-spawn subprocesses and double-spend). Module-level, single-user. */
let active: { id: string } | null = null;

export function tryAcquire(id: string): boolean {
  if (active) return false;
  active = { id };
  return true;
}

export function release(id: string): void {
  if (active?.id === id) active = null;
}

export function isRunning(): boolean {
  return active !== null;
}
