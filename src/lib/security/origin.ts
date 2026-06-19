export class InvalidOriginError extends Error {
  status = 403;

  constructor(message = "Invalid request origin.") {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    throw new InvalidOriginError();
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new InvalidOriginError();
  }

  if (originUrl.host !== host) {
    throw new InvalidOriginError();
  }
}
