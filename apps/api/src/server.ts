import { Hono } from "hono";

import {
  createAccountFullXml,
  createSourceProvidersXml,
  createPresetsXml,
  createSoftwareUpdateXml,
} from "./utils/marge-xml";
import { getStreamUrl, setStreamUrl } from "./utils/store";

const app = new Hono()
  .get("/streaming/sourceproviders", (ctx) =>
    ctx.body(createSourceProvidersXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )

  .get("/streaming/account/:accountId/full", (ctx) => {
    const accountId = ctx.req.param("accountId");
    return ctx.body(createAccountFullXml(accountId, getStreamUrl()), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    });
  })
  .post("/streaming/support/power_on", (ctx) =>
    ctx.body("", 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .get("/streaming/account/:accountId/device/:deviceId/presets", (ctx) =>
    ctx.body(createPresetsXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .get("/streaming/software/update/account/:accountId", (ctx) =>
    ctx.body(createSoftwareUpdateXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .post("/streaming/account/:accountId/device/:deviceId/recent", (ctx) =>
    ctx.body("", 201),
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
