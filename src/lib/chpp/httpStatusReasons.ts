export type ChppAccessProblemKind =
  | "missing-token"
  | "client-error"
  | "server-error";

const CLIENT_STATUS_TEXT: Record<number, { label: string; reason: string }> = {
  400: {
    label: "Bad Request",
    reason: "Malformed or missing required request parameters.",
  },
  401: {
    label: "Unauthorized",
    reason: "Missing, invalid, or expired authentication/token.",
  },
  403: {
    label: "Forbidden",
    reason: "Authenticated, but not permitted or lacks required scope.",
  },
  404: {
    label: "Not Found",
    reason: "Resource or endpoint does not exist, or is hidden.",
  },
  405: {
    label: "Method Not Allowed",
    reason: "HTTP method is not supported for that endpoint.",
  },
  406: {
    label: "Not Acceptable",
    reason: "Requested response format is not supported.",
  },
  408: {
    label: "Request Timeout",
    reason: "Client took too long to complete the request.",
  },
  409: {
    label: "Conflict",
    reason: "Request conflicts with current resource/server state.",
  },
  410: {
    label: "Gone",
    reason: "Resource is no longer available.",
  },
  411: {
    label: "Length Required",
    reason: "Required Content-Length header is missing.",
  },
  412: {
    label: "Precondition Failed",
    reason: "Request precondition headers were not satisfied.",
  },
  413: {
    label: "Payload Too Large",
    reason: "Request body is too large.",
  },
  414: {
    label: "URI Too Long",
    reason: "Request URL is too long.",
  },
  415: {
    label: "Unsupported Media Type",
    reason: "Request content type is not supported.",
  },
  422: {
    label: "Unprocessable Content",
    reason: "Request is syntactically valid but semantically invalid.",
  },
  423: {
    label: "Locked",
    reason: "Resource is locked.",
  },
  424: {
    label: "Failed Dependency",
    reason: "Request failed because a dependent request/action failed.",
  },
  428: {
    label: "Precondition Required",
    reason: "Server requires a conditional request.",
  },
  429: {
    label: "Too Many Requests",
    reason: "Client exceeded rate limits.",
  },
  431: {
    label: "Request Header Fields Too Large",
    reason: "Request headers are too large.",
  },
  451: {
    label: "Unavailable For Legal Reasons",
    reason: "Resource is blocked for legal reasons.",
  },
};

const SERVER_STATUS_TEXT: Record<number, { label: string; reason: string }> = {
  500: {
    label: "Internal Server Error",
    reason: "Generic server-side failure.",
  },
  501: {
    label: "Not Implemented",
    reason: "Server does not support the requested functionality.",
  },
  502: {
    label: "Bad Gateway",
    reason: "Gateway/proxy received an invalid upstream response.",
  },
  503: {
    label: "Service Unavailable",
    reason: "Server is overloaded, down, or under maintenance.",
  },
  504: {
    label: "Gateway Timeout",
    reason: "Gateway/proxy timed out waiting for upstream response.",
  },
  505: {
    label: "HTTP Version Not Supported",
    reason: "Server does not support the HTTP version used.",
  },
  506: {
    label: "Variant Also Negotiates",
    reason: "Server has a content negotiation configuration error.",
  },
  507: {
    label: "Insufficient Storage",
    reason: "Server lacks storage to complete the request.",
  },
  508: {
    label: "Loop Detected",
    reason: "Server detected an infinite loop while processing.",
  },
  510: {
    label: "Not Extended",
    reason: "Further extensions are required for the request.",
  },
  511: {
    label: "Network Authentication Required",
    reason: "Client must authenticate to access the network.",
  },
};

export const getChppHttpStatusReason = (statusCode: number): string =>
  CLIENT_STATUS_TEXT[statusCode]?.reason ??
  SERVER_STATUS_TEXT[statusCode]?.reason ??
  "Unknown CHPP access problem.";

export const getChppHttpStatusLabel = (statusCode: number): string =>
  CLIENT_STATUS_TEXT[statusCode]?.label ??
  SERVER_STATUS_TEXT[statusCode]?.label ??
  "Unknown Status";

export const isChppClientProblemStatus = (statusCode: number): boolean =>
  Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500;

export const isChppServerProblemStatus = (statusCode: number): boolean =>
  Number.isInteger(statusCode) && statusCode >= 500 && statusCode < 600;
