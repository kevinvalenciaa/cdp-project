/** Single-flight guard - one engine run at a time (a second concurrent run would
 *  double-spawn subprocesses and double-spend). Module-level, single-user. */
let active: { id: string } | null = null;
const waiters: Array<() => void> = [];

export function tryAcquire(id: string): boolean {
  if (active) return false;
  active = { id };
  return true;
}

/**
 * Wait for the lock rather than failing the caller.
 *
 * Refusing outright was worse than it looked: the live provider answered a
 * contended run with an `{kind:"error"}` event, the worker rethrows those, and a
 * rethrow is a failed attempt. Three quick retries all lost the same race and
 * the run was marked failed - the user saw "The investigation failed." for work
 * that was only ever queued behind another run.
 *
 * Returns false on timeout so the caller can leave the job for a later retry
 * instead of blocking a worker slot indefinitely.
 */
export async function acquire(id: string, timeoutMs = 5 * 60_000): Promise<boolean> {
  if (tryAcquire(id)) return true;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const index = waiters.indexOf(wake);
      if (index >= 0) waiters.splice(index, 1);
      resolve(false);
    }, timeoutMs);

    function wake() {
      if (settled) return;
      if (!tryAcquire(id)) {
        // Lost the race to another waiter; stay queued.
        waiters.push(wake);
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(true);
    }

    waiters.push(wake);
  });
}

export function release(id: string): void {
  if (active?.id !== id) return;
  active = null;
  waiters.shift()?.();
}
