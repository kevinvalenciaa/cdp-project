/** Demo (default) vs live mode — server-only (reads LIFT_MODE). */
export const MODE: "demo" | "live" = process.env.LIFT_MODE === "live" ? "live" : "demo";
