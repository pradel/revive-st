import type { AccountId } from "../marge/account.ts";
import {
  ACCOUNT_SOURCES,
  type MargeSource,
  SOURCE_PROVIDERS,
  sourceNamed,
} from "../marge/sources.ts";
import type { Preset } from "../presets/preset.ts";

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

/** The date Marge stamps on records it has no date for. */
const UNKNOWN_DATE = "2012-09-19T12:43:00.000+00:00";

/** Marge's timestamp format: UTC, milliseconds, explicit `+00:00`. */
export const formatMargeDate = (epochMillis: number | undefined): string =>
  epochMillis === undefined
    ? UNKNOWN_DATE
    : new Date(epochMillis).toISOString().replace("Z", "+00:00");

const element = (name: string, value: string) =>
  `<${name}>${escapeXml(value)}</${name}>`;

/**
 * A `<source>` as speakers decode it. Every field is required: one missing
 * aborts the speaker's whole account sync.
 */
function sourceXml(source: MargeSource, accountId: AccountId): string {
  return [
    `<source id="${source.id}" type="Audio">`,
    element("createdOn", source.createdOn),
    `<credential type="token">${escapeXml(source.credential)}</credential>`,
    element("name", source.name),
    element("sourceproviderid", String(source.providerId)),
    element("sourcename", source.sourceName),
    "<sourceSettings/>",
    element("updatedOn", source.updatedOn),
    element("username", source.username(accountId)),
    "</source>",
  ].join("");
}

export function createSourceProvidersXml(): string {
  const providers = SOURCE_PROVIDERS.map((provider) =>
    [
      `<sourceprovider id="${provider.id}">`,
      element("createdOn", provider.createdOn),
      element("name", provider.name),
      element("updatedOn", provider.createdOn),
      "</sourceprovider>",
    ].join(""),
  );
  return `${XML_HEADER}<sourceProviders>${providers.join("")}</sourceProviders>`;
}

export function createAccountFullXml(accountId: AccountId): string {
  const sources = ACCOUNT_SOURCES.map((source) => sourceXml(source, accountId));
  return [
    XML_HEADER,
    `<account id="${escapeXml(accountId)}">`,
    "<accountStatus>OK</accountStatus>",
    "<devices/>",
    "<mode>global</mode>",
    "<preferredLanguage>en</preferredLanguage>",
    `<sources>${sources.join("")}</sources>`,
    "</account>",
  ].join("");
}

/**
 * A preset in Marge's shape: flat fields plus the `<source>` it plays from,
 * left out when the account has no such source.
 */
function presetXml(preset: Preset, accountId: AccountId): string {
  const { contentItem } = preset;
  const source = sourceNamed(contentItem.source);
  return [
    `<preset buttonNumber="${preset.id}">`,
    element("containerArt", contentItem.containerArt),
    element("contentItemType", contentItem.type),
    element("createdOn", formatMargeDate(preset.createdOn)),
    element("location", contentItem.location),
    element("name", contentItem.itemName),
    source ? sourceXml(source, accountId) : "",
    element("updatedOn", formatMargeDate(preset.updatedOn)),
    element("username", contentItem.itemName),
    "</preset>",
  ].join("");
}

export function createPresetsXml(
  presets: readonly Preset[],
  accountId: AccountId,
): string {
  if (presets.length === 0) {
    return `${XML_HEADER}<presets/>`;
  }
  const items = presets.map((preset) => presetXml(preset, accountId));
  return `${XML_HEADER}<presets>${items.join("")}</presets>`;
}

export function createPresetXml(preset: Preset, accountId: AccountId): string {
  return `${XML_HEADER}${presetXml(preset, accountId)}`;
}

export interface Recent {
  readonly id: number;
  readonly source: MargeSource;
  readonly name: string;
  readonly location: string;
  readonly contentItemType: string;
  /** Epoch milliseconds. */
  readonly lastPlayedAt: number;
  /** Epoch milliseconds. */
  readonly createdOn: number;
}

export function createRecentXml(recent: Recent, accountId: AccountId): string {
  return [
    XML_HEADER,
    `<recent id="${recent.id}">`,
    element("contentItemType", recent.contentItemType),
    element("createdOn", formatMargeDate(recent.createdOn)),
    element("lastplayedat", formatMargeDate(recent.lastPlayedAt)),
    element("location", recent.location),
    element("name", recent.name),
    sourceXml(recent.source, accountId),
    element("sourceid", recent.source.id),
    element("updatedOn", formatMargeDate(recent.createdOn)),
    "</recent>",
  ].join("");
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
