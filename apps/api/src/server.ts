import { Hono } from "hono";

import {
  createAccountFullXml,
  createSourceProvidersXml,
  createPresetsXml,
  createSoftwareUpdateXml,
  createRecentItemResponseXml,
} from "./utils/marge-xml";
import { setStreamUrl } from "./utils/store";

const app = new Hono()
  .get("/streaming/sourceproviders", (ctx) =>
    ctx.body(createSourceProvidersXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
      ETag: "1",
    }),
  )

  .get("/streaming/account/:accountId/full", (ctx) => {
    const accountId = ctx.req.param("accountId");
    return ctx.body(createAccountFullXml(accountId), 200, {
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
      ETag: "1",
    }),
  )
  .get("/streaming/software/update/account/:accountId", (ctx) =>
    ctx.body(createSoftwareUpdateXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .post("/streaming/account/:accountId/device/:deviceId/recent", (ctx) => {
    const accountId = ctx.req.param("accountId");
    const deviceId = ctx.req.param("deviceId");
    return ctx.body(createRecentItemResponseXml("1"), 201, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
      Location: `http://localhost:8000/account/${accountId}/device/${deviceId}/recent/1`,
    });
  })
  .post("/api/stream-url", async (ctx) => {
    const bodyPayload = (await ctx.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const url =
      typeof bodyPayload?.url === "string" ? bodyPayload.url : undefined;
    const accountId =
      typeof bodyPayload?.accountId === "string"
        ? bodyPayload.accountId
        : undefined;

    if (url && accountId) {
      setStreamUrl(accountId, url);
      return ctx.json({ success: true, accountId, url });
    }
    return ctx.json({
      success: false,
      error: 'Please provide "url" and "accountId" in the JSON body.',
    });
  });

export default app;
