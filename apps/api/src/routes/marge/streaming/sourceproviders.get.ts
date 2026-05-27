import { defineEventHandler } from "h3";

import { createSourceProvidersXml } from "../../../utils/marge-xml";

export default defineEventHandler(
  () =>
    new Response(createSourceProvidersXml(), {
      headers: { "Content-Type": "application/vnd.bose.streaming-v1.2+xml" },
    }),
);
