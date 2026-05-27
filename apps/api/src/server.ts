import { Elysia } from "elysia";

import {
  createAccountFullXml,
  createSourceProvidersXml,
  createSourcesXml,
} from "./utils/marge-xml";
import { getStreamUrl, setStreamUrl } from "./utils/store";

const app = new Elysia()
  .get("/marge/streaming/sourceproviders", ({ set }) => {
    set.headers["Content-Type"] = "application/vnd.bose.streaming-v1.2+xml";
    return createSourceProvidersXml();
  })
  .get(
    "/marge/streaming/account/:accountId/sources",
    ({ params: { accountId }, set }) => {
      set.headers["Content-Type"] = "application/vnd.bose.streaming-v1.2+xml";
      return createSourcesXml(accountId, getStreamUrl());
    },
  )
  .get(
    "/marge/streaming/account/:accountId/full",
    ({ params: { accountId }, set }) => {
      set.headers["Content-Type"] = "application/vnd.bose.streaming-v1.2+xml";
      return createAccountFullXml(accountId, getStreamUrl());
    },
  )
  .post("/marge/streaming/support/power_on", ({ set }) => {
    set.headers["Content-Type"] = "application/vnd.bose.streaming-v1.2+xml";
    return "";
  })
  .post("/api/stream-url", ({ body }) => {
    const bodyPayload = body as Record<string, unknown> | undefined;
    const url =
      typeof bodyPayload?.url === "string" ? bodyPayload.url : undefined;
    if (url) {
      setStreamUrl(url);
      return { success: true, url };
    }
    return {
      success: false,
      error: 'Please provide a "url" in the JSON body.',
    };
  });

export default app.handle;
