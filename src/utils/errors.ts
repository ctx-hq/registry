import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    public statusCode: ContentfulStatusCode,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: this.code ?? "error",
      message: this.message,
    };
  }
}

export function notFound(message = "Not found") {
  return new AppError(404, message, "not_found");
}

export function badRequest(message: string) {
  return new AppError(400, message, "bad_request");
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(401, message, "unauthorized");
}

export function forbidden(message = "Forbidden") {
  return new AppError(403, message, "forbidden");
}

export function conflict(message: string) {
  return new AppError(409, message, "conflict");
}
