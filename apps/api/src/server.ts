import { Hono } from "hono";
import { logger } from "hono/logger";

import {
  createAccountFullXml,
  createSourceProvidersXml,
  createPresetsXml,
  createSoftwareUpdateXml,
  createRecentItemResponseXml,
} from "./utils/marge-xml";

const app = new Hono();

app.use(logger());

app.use(async (ctx, next) => {
  if (
    ctx.req.header("content-type")?.includes("xml") ||
    ctx.req.header("content-type")?.includes("json")
  ) {
    const reqBody = await ctx.req.raw.clone().text();
    if (reqBody) {
      // eslint-disable-next-line no-console
      console.log(`[Req Body] ${ctx.req.method} ${ctx.req.path}:\n`, reqBody);
    }
  }

  await next();

  if (
    ctx.res.headers.get("content-type")?.includes("xml") ||
    ctx.res.headers.get("content-type")?.includes("json")
  ) {
    const resBody = await ctx.res.clone().text();
    // eslint-disable-next-line no-console
    console.log(`[Res Body] ${ctx.res.status} ${ctx.req.path}:\n`, resBody);
  }
});

app
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
