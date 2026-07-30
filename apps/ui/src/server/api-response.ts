import { ZodError } from "zod";
import { AuthenticationError } from "@/server/auth";
import { RepositoryError } from "@/server/investigations/repository";

export function apiError(error: unknown): Response {
  if (error instanceof AuthenticationError) {
    return Response.json({ error: "Authentication required.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (error instanceof RepositoryError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "CONFLICT" ? 409 : 422;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "The request payload is invalid.",
        code: "VALIDATION_FAILED",
        issues: error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error.", code: "INTERNAL" }, { status: 500 });
}
