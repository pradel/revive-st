import { Hono } from "hono";

import {
  createAccountFullXml,
  createSourceProvidersXml,
  createSourcesXml,
} from "./utils/marge-xml";
import { getStreamUrl, setStreamUrl } from "./utils/store";

const app = new Hono()
  .get("/marge/streaming/sourceproviders", (ctx) =>
    ctx.body(createSourceProvidersXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .get("/marge/streaming/account/:accountId/sources", (ctx) => {
    const accountId = ctx.req.param("accountId");
    return ctx.body(createSourcesXml(accountId, getStreamUrl()), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    });
  })
  .get("/marge/streaming/account/:accountId/full", (ctx) => {
    const accountId = ctx.req.param("accountId");
    return ctx.body(createAccountFullXml(accountId, getStreamUrl()), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    });
  })
  .post("/marge/streaming/support/power_on", (ctx) =>
    ctx.body("", 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .post("/api/stream-url", async (ctx) => {
    const bodyPayload = (await ctx.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const url =
      typeof bodyPayload?.url === "string" ? bodyPayload.url : undefined;
    if (url) {
      setStreamUrl(url);
      return ctx.json({ success: true, url });
    }
    return ctx.json({
      success: false,
      error: 'Please provide a "url" in the JSON body.',
    });
  });

export default app;
