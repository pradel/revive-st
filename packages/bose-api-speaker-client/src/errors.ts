import { TaggedError } from "better-result";

export class NetworkError extends TaggedError("NetworkError")<{
  message: string;
  cause?: unknown;
}>() {}

export class HttpError extends TaggedError("HttpError")<{
  statusCode: number;
  statusText: string;
  body: string;
}>() {}

export class XmlParseError extends TaggedError("XmlParseError")<{
  message: string;
  rawXml: string;
}>() {}

export class ApiError extends TaggedError("ApiError")<{
  deviceID: string;
  errors: Array<{
    value: number;
    name: string;
    severity: string;
    message: string;
  }>;
}>() {}

export type BoseApiError = NetworkError | HttpError | XmlParseError | ApiError;
