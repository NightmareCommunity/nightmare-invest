import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseBody<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * Wrap an async route handler so that any thrown `Response` (e.g. from
 * `requireUser` / `requireAdmin` for 401/403) is propagated verbatim, while
 * genuine `Error`s become a clean 500 JSON response. Prevents auth failures
 * from leaking as confusing 500 errors.
 */
export function safeHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<Response>
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof Response) return e;
      return error(e instanceof Error ? e.message : "Internal server error", 500);
    }
  };
}
