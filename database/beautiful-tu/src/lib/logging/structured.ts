import { randomUUID } from "crypto";

export type LogSeverity = "info" | "warn" | "error";

export type StructuredLogContext = {
  route: string;
  request_id: string;
  environment: string;
  user_id?: string | null;
  tournament_id?: string | null;
  battle_id?: string | null;
  stripe_event_id?: string | null;
};

type StructuredLogDetails = Record<string, unknown> | undefined;

function cleanDetails(details: StructuredLogDetails) {
  if (!details) return {};

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
}

export function createRequestLogContext(
  request: Request | { headers?: Headers },
  route: string,
  extra?: Partial<StructuredLogContext>,
): StructuredLogContext {
  const requestId =
    request.headers?.get("x-request-id")?.trim() ||
    request.headers?.get("cf-ray")?.trim() ||
    randomUUID();

  return {
    route,
    request_id: requestId,
    environment: process.env.NODE_ENV ?? "unknown",
    ...extra,
  };
}

export function withRequestId(response: Response, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export function logStructured(
  severity: LogSeverity,
  message: string,
  context: StructuredLogContext,
  details?: StructuredLogDetails,
) {
  const payload = {
    timestamp: new Date().toISOString(),
    severity,
    message,
    ...context,
    ...cleanDetails(details),
  };

  const line = JSON.stringify(payload);
  if (severity === "error") {
    console.error(line);
  } else if (severity === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  return payload;
}
