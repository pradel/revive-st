import {
  type IncomingMessage,
  type OutgoingHttpHeader,
  type OutgoingHttpHeaders,
  ServerResponse,
} from "node:http";

/**
 * Writes the `etag` header as `ETag`. Header names are case-insensitive, but
 * SoundTouch firmware only recognises this exact spelling: under any other it
 * never sends `If-None-Match`. Effect lowercases every header name, so the
 * spelling is restored where Node writes the response head.
 */
export class EtagCasingServerResponse<
  Request extends IncomingMessage = IncomingMessage,
> extends ServerResponse<Request> {
  override writeHead(
    statusCode: number,
    statusMessage?: string | OutgoingHttpHeaders | OutgoingHttpHeader[],
    headers?: OutgoingHttpHeaders | OutgoingHttpHeader[],
  ): this {
    // Node takes headers from the second argument unless it is a string, and
    // Effect passes an undefined status message with headers third.
    if (typeof statusMessage === "string" || headers !== undefined) {
      return super.writeHead(
        statusCode,
        statusMessage as string | undefined,
        withEtagCasing(headers),
      );
    }
    return super.writeHead(statusCode, withEtagCasing(statusMessage));
  }
}

const withEtagCasing = (
  headers: OutgoingHttpHeaders | OutgoingHttpHeader[] | undefined,
) => {
  if (headers === undefined || Array.isArray(headers) || !("etag" in headers)) {
    return headers;
  }
  const { etag, ...rest } = headers;
  return { ...rest, ETag: etag };
};
