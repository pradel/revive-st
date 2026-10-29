import { escapeXml } from "bose-api-speaker-client";

import { getServerUrl } from "@/features/server/server";

/**
 * The ContentItem that plays `uri` through our Orion station adapter.
 * `accountId` is the speaker's Marge account: its local radio source is
 * registered under it.
 */
export function buildMargeRadioPayload(
  uri: string,
  name: string,
  accountId: string,
): string {
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
  const locationUrl = `${getServerUrl()}/core02/svc-bmx-adapter-orion/prod/orion/station?data=${encodeURIComponent(
    base64Data,
  )}`;
  return `<ContentItem source="LOCAL_INTERNET_RADIO" type="stationurl" location="${escapeXml(
    locationUrl,
  )}" sourceAccount="${escapeXml(accountId)}"><itemName>${escapeXml(
    name,
  )}</itemName></ContentItem>`;
}
