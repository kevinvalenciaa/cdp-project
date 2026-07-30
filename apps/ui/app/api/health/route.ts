export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      service: "lift-compass-web",
      persistence: process.env.DATABASE_URL ? "postgres" : "local",
      mode: process.env.LIFT_MODE ?? "demo",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
