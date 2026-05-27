import { defineEventHandler, readBody, type H3Event } from "h3";

import { setStreamUrl } from "../../utils/store";

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody<{ url?: string }>(event);

  if (body?.url) {
    setStreamUrl(body.url);
    return { success: true, url: body.url };
  }

  return { success: false, error: 'Please provide a "url" in the JSON body.' };
});
