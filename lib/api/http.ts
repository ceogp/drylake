import { NextResponse } from "next/server";
import { ZodError } from "zod";

type JsonBody = Record<string, unknown>;

export function ok(data: JsonBody, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function created(data: JsonBody) {
  return NextResponse.json({ ok: true, ...data }, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "bad_request",
        message,
        details,
      },
    },
    { status: 400 },
  );
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "unauthorized",
        message,
      },
    },
    { status: 401 },
  );
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "forbidden",
        message,
      },
    },
    { status: 403 },
  );
}

export function notFound(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "not_found",
        message,
      },
    },
    { status: 404 },
  );
}

export function notImplemented(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "not_implemented",
        message,
      },
    },
    { status: 501 },
  );
}

export function internalError(message = "Internal server error") {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message,
      },
    },
    { status: 500 },
  );
}

export function fromZodError(error: ZodError) {
  return badRequest("Request validation failed", error.flatten());
}
