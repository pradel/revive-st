import { defineEventHandler, getRouterParam, type H3Event } from "h3";

import { createAccountFullXml } from "../../../../../utils/marge-xml";
import { getStreamUrl } from "../../../../../utils/store";

export default defineEventHandler((event: H3Event) => {
  const accountId = getRouterParam(event, "accountId") ?? "default";

  const dynamicStreamUrl = getStreamUrl();

  return new Response(createAccountFullXml(accountId, dynamicStreamUrl), {
    headers: { "Content-Type": "application/vnd.bose.streaming-v1.2+xml" },
  });
});
