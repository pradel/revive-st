import { escapeXml } from "bose-api-speaker-client";

export function buildMargeRadioPayload(uri: string, name: string): string {
  const data = {
    streamUrl: uri,
    name,
    imageUrl: "",
  };
  const base64Data = btoa(JSON.stringify(data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const locationUrl = `https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion/station?data=${encodeURIComponent(
    base64Data,
  )}`;
  return `<ContentItem source="LOCAL_INTERNET_RADIO" type="stationurl" location="${escapeXml(
    locationUrl,
  )}" sourceAccount="revivest-user"><itemName>${escapeXml(
    name,
  )}</itemName></ContentItem>`;
}
