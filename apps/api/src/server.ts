import { Hono } from "hono";

import {
  createAccountFullXml,
  createSourceProvidersXml,
  createPresetsXml,
  createSoftwareUpdateXml,
  createRecentItemResponseXml,
} from "./utils/marge-xml";

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
  });

export default app;
