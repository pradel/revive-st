import type { Preset } from "../db/schema.js";

export const XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function createSourceProvidersXml(): string {
  return `${XML_HEADER}
<sourceProviders>
  <sourceprovider id="10003">
    <createdOn>2012-09-19T12:43:00.000+00:00</createdOn>
    <name>LOCAL_INTERNET_RADIO</name>
    <updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn>
  </sourceprovider>
</sourceProviders>`;
}

export function createAccountFullXml(accountId: string): string {
  const safeAccountId = escapeXml(accountId);
  return `${XML_HEADER}
<account id="${safeAccountId}">
  <accountStatus>OK</accountStatus>
  <mode>global</mode>
  <preferredLanguage>en</preferredLanguage>
  <devices/>
  <sources>
    <source id="1" type="Audio">
      <createdOn>2012-09-19T12:43:00.000+00:00</createdOn>
      <credential type="token"></credential>
      <name>LOCAL_INTERNET_RADIO</name>
      <sourceproviderid>10003</sourceproviderid>
      <sourcename>Local Radio Source</sourcename>
      <sourceSettings/>
      <updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn>
      <username>${safeAccountId}</username>
    </source>
  </sources>
</account>`;
}

export function createPresetsXml(presets: Preset[] = []): string {
  if (!presets || presets.length === 0) {
    return `${XML_HEADER}\n<presets/>`;
  }

  let xml = `${XML_HEADER}\n<presets>\n`;
  for (const preset of presets) {
    const createdOnAttr = preset.createdOn
      ? ` createdOn="${preset.createdOn}"`
      : "";
    const updatedOnAttr = preset.updatedOn
      ? ` updatedOn="${preset.updatedOn}"`
      : "";

    xml += `  <preset id="${preset.id}"${createdOnAttr}${updatedOnAttr}>\n`;
    xml += `    <ContentItem source="${escapeXml(preset.contentItem.source)}" location="${escapeXml(preset.contentItem.location)}" sourceAccount="${escapeXml(preset.contentItem.sourceAccount)}" isPresetable="${preset.contentItem.isPresetable}">\n`;
    xml += `      <itemName>${escapeXml(preset.contentItem.itemName)}</itemName>\n`;
    xml += `    </ContentItem>\n`;
    xml += `  </preset>\n`;
  }
  xml += `</presets>`;
  return xml;
}

export function createStatusOkXml(): string {
  return `${XML_HEADER}\n<status>OK</status>`;
}

export function createSoftwareUpdateXml(): string {
  return `${XML_HEADER}
<software_update>
  <softwareUpdateLocation></softwareUpdateLocation>
</software_update>`;
}

export function createRecentItemResponseXml(id: string): string {
  const safeId = escapeXml(id);
  return `${XML_HEADER}
<recent id="${safeId}">
  <contentItemType>stationurl</contentItemType>
  <createdOn>2018-11-27T18:20:01.000+00:00</createdOn>
  <lastplayedat>2025-11-01T17:32:59.000+00:00</lastplayedat>
  <location>/v1/playback/station/s80044</location>
  <name>Local Radio</name>
  <source id="19989313" type="Audio">
    <createdOn>2018-08-11T08:55:41.000+00:00</createdOn>
    <credential type="token">eyDu=</credential>
    <name></name>
    <sourceproviderid>10003</sourceproviderid>
    <sourcename></sourcename>
    <sourceSettings/>
    <updatedOn>2019-07-20T17:48:31.000+00:00</updatedOn>
    <username></username>
  </source>
  <sourceid>19989313</sourceid>
  <updatedOn>2025-11-01T17:33:00.574+00:00</updatedOn>
</recent>`;
}
