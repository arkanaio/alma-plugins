/**
 * How a connector fails, without carrying what the provider answered.
 *
 * The error leaving a connector travels to a run's trace and to observability.
 * The body of a license provider's response contains emails, names and
 * sometimes the credential itself, so none of it is part of the error: only a
 * kind, a closed code and whether retrying makes sense. The original response
 * can stay in `cause` for local debugging, but no consumer writes it out.
 */

/**
 * The four kinds ask for different things: a rejected credential is entered
 * again, a missing permission is granted at the provider, a service error is
 * only retried, and a contract breach is a fault in the connector that no
 * organisation can fix.
 */
export const connectorFailureKinds = [
  "credentials",
  "permissions",
  "service",
  "contract",
] as const;

export type ConnectorFailureKind = (typeof connectorFailureKinds)[number];

const connectorErrorCodePattern = /^[a-z][a-z0-9_]{0,63}$/;

export class ConnectorError extends Error {
  readonly code: string;
  readonly kind: ConnectorFailureKind;
  readonly retryable: boolean;

  constructor(
    kind: ConnectorFailureKind,
    code: string,
    options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    // The message is the code, not a sentence: that way nobody can slip the
    // body of a response into it thinking they are only adding context.
    const safeCode = connectorErrorCodePattern.test(code)
      ? code
      : "unspecified";
    super(`${kind}:${safeCode}`, { cause: options.cause });
    this.code = safeCode;
    this.kind = kind;
    this.name = "ConnectorError";
    this.retryable = options.retryable ?? kind === "service";
  }
}

/**
 * Wraps anything a connector throws.
 *
 * A connector can throw a `TypeError` from one of its own lines, the network
 * error from `fetch`, or the object the provider returned. None of the three is
 * publishable as-is, and all three mean the same thing to whoever is waiting
 * for the sync: it could not be read, try again.
 */
export function asConnectorError(error: unknown): ConnectorError {
  if (error instanceof ConnectorError) return error;
  return new ConnectorError("service", "unexpected_error", { cause: error });
}
