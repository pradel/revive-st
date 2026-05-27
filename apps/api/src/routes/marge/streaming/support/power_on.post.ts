import { defineEventHandler } from "h3";

export default defineEventHandler(
  () =>
    new Response("", {
      headers: { "Content-Type": "application/vnd.bose.streaming-v1.2+xml" },
    }),
);
