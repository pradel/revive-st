import { escapeXml } from "bose-api-speaker-client";

import { APP_CONFIG } from "@/config";

export function buildMargeRadioPayload(uri: string, name: string): string {
  const data = {
    streamUrl: uri,
    name,
    imageUrl: "",
  };
  const base64Data = btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(data)), (byte) =>
      String.fromCodePoint(byte),
    ).join(""),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const locationUrl = `${APP_CONFIG.API_URL}/core02/svc-bmx-adapter-orion/prod/orion/station?data=${encodeURIComponent(
    base64Data,
  )}`;
  return `<ContentItem source="LOCAL_INTERNET_RADIO" type="stationurl" location="${escapeXml(
    locationUrl,
  )}" sourceAccount="revivest-user"><itemName>${escapeXml(
    name,
  )}</itemName></ContentItem>`;
}
