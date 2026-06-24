import { Hono } from "hono";
import { logger } from "hono/logger";
import { z } from "zod";

import { getPresets, savePresets } from "./db";
import {
  createAccountFullXml,
  createSourceProvidersXml,
  createPresetsXml,
  createStatusOkXml,
  createSoftwareUpdateXml,
  createRecentItemResponseXml,
} from "./utils/marge-xml";

const presetSchema = z.object({
  id: z.number(),
  createdOn: z.number().optional(),
  updatedOn: z.number().optional(),
  contentItem: z.object({
    source: z.string(),
    location: z.string(),
    sourceAccount: z.string(),
    isPresetable: z.boolean(),
    itemName: z.string(),
  }),
});

const presetsPayloadSchema = z.object({
  presets: z.array(presetSchema),
});

const app = new Hono({ strict: false });

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
  .get(
    "/streaming/account/:accountId/device/:deviceId/presets",
    async (ctx) => {
      const deviceId = ctx.req.param("deviceId");
      const presets = await getPresets(deviceId);
      return ctx.body(createPresetsXml(presets), 200, {
        "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
        ETag: "1",
      });
    },
  )
  .post("/api/internal/device/:deviceId/presets", async (ctx) => {
    const deviceId = ctx.req.param("deviceId");
    try {
      const payload = presetsPayloadSchema.parse(await ctx.req.json());
      const { presets } = payload;
      await savePresets(deviceId, presets);
      return ctx.json({ success: true });
    } catch (err) {
      return ctx.json({ success: false, error: String(err) }, 500);
    }
  })
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
  .post("/streaming/support/power_on", (ctx) =>
    ctx.body(createStatusOkXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )
  .post("/streaming/account/:accountId/device", (ctx) =>
    ctx.body(createStatusOkXml(), 200, {
      "Content-Type": "application/vnd.bose.streaming-v1.2+xml",
    }),
  )

  // BMX Registry Endpoint
  .get("/v2/registry.json", (ctx) => {
    const url = new URL(ctx.req.url);
    const host = url.host;
    const scheme = url.protocol;
    const baseUrl = `${scheme}//${host}`;

    return ctx.json({
      _links: {
        bmx_services_availability: {
          href: "../servicesAvailability",
        },
      },
      askAgainAfter: 1230482,
      bmx_services: [
        {
          _links: {
            bmx_token: {
              href: "/token",
            },
            self: {
              href: "/",
            },
          },
          askAdapter: false,
          assets: {
            color: "#000000",
            description: "Custom radio stations with BMX.",
            icons: {
              largeSvg: `${baseUrl}/media/orion-monochrome.svg`,
              monochromePng: `${baseUrl}/media/orion-monochrome_v2.png`,
              monochromeSvg: `${baseUrl}/media/orion-monochrome.svg`,
              smallSvg: `${baseUrl}/media/orion-monochrome.svg`,
            },
            name: "Custom Stations",
          },
          authenticationModel: {
            anonymousAccount: {
              autoCreate: true,
              enabled: true,
            },
          },
          baseUrl: `${baseUrl}/core02/svc-bmx-adapter-orion/prod/orion`,
          id: {
            name: "LOCAL_INTERNET_RADIO",
            value: 11,
          },
          streamTypes: ["liveRadio"],
        },
      ],
    });
  })

  // BMX Custom Stream Endpoint
  .get("/core02/svc-bmx-adapter-orion/prod/orion/station", (ctx) => {
    const data = ctx.req.query("data");
    if (!data) {
      return ctx.text("Missing data parameter", 400);
    }

    try {
      // Decode base64 URL-safe JSON string
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const jsonObj = JSON.parse(jsonStr) as {
        streamUrl: string;
        name?: string;
        imageUrl?: string;
      };

      const streamUrl = jsonObj.streamUrl;
      const name = jsonObj.name ?? "Custom Stream";
      const imageUrl = jsonObj.imageUrl ?? "";

      return ctx.json({
        audio: {
          hasPlaylist: true,
          isRealtime: true,
          streamUrl,
          streams: [
            {
              hasPlaylist: true,
              isRealtime: true,
              streamUrl,
            },
          ],
        },
        imageUrl,
        name,
        streamType: "liveRadio",
      });
    } catch {
      return ctx.text("Invalid data parameter", 400);
    }
  });

export default app;
