export interface BoseSpeakerInfo {
  deviceID: string;
  name: string;
  type: string;
  ipAddress: string;
}

export interface BoseNowPlaying {
  deviceID: string;
  source: string;
  playStatus: string;
  track?: string;
  artist?: string;
  album?: string;
  artUrl?: string;
}

export interface BoseVolume {
  deviceID: string;
  targetVolume: number;
  actualVolume: number;
  muteEnabled: boolean;
}

export interface BosePreset {
  id: string;
  name: string;
  source: string;
  sourceAccount?: string;
  location?: string;
}

export interface BoseBass {
  targetBass: number;
  actualBass: number;
}

function unescapeXml(val: string): string {
  if (!val) return "";
  return val
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function parseInfoResponse(xml: string): BoseSpeakerInfo {
  const deviceIDMatch =
    xml.match(/<info[^>]+deviceID="([^"]+)"/) ||
    xml.match(/deviceID="([^"]+)"/);
  const nameMatch = xml.match(/<name>(.*?)<\/name>/);
  const typeMatch = xml.match(/<type>(.*?)<\/type>/);
  const ipAddressMatch = xml.match(/<ipAddress>(.*?)<\/ipAddress>/);

  return {
    deviceID: deviceIDMatch ? deviceIDMatch[1] : "",
    name: nameMatch ? unescapeXml(nameMatch[1]) : "Bose Speaker",
    type: typeMatch ? unescapeXml(typeMatch[1]) : "SoundTouch",
    ipAddress: ipAddressMatch ? ipAddressMatch[1] : "",
  };
}

export function parseNowPlayingResponse(xml: string): BoseNowPlaying {
  const deviceIDMatch = xml.match(/<nowPlaying[^>]+deviceID="([^"]+)"/);
  const sourceMatch = xml.match(/<nowPlaying[^>]+source="([^"]+)"/);
  const playStatusMatch = xml.match(/<playStatus>(.*?)<\/playStatus>/);
  const trackMatch = xml.match(/<track>(.*?)<\/track>/);
  const artistMatch = xml.match(/<artist>(.*?)<\/artist>/);
  const albumMatch = xml.match(/<album>(.*?)<\/album>/);
  const artMatch = xml.match(/<art[^>]*>(.*?)<\/art>/);

  return {
    deviceID: deviceIDMatch ? deviceIDMatch[1] : "",
    source: sourceMatch ? sourceMatch[1] : "STANDBY",
    playStatus: playStatusMatch ? playStatusMatch[1] : "STANDBY",
    track: trackMatch ? unescapeXml(trackMatch[1]) : undefined,
    artist: artistMatch ? unescapeXml(artistMatch[1]) : undefined,
    album: albumMatch ? unescapeXml(albumMatch[1]) : undefined,
    artUrl: artMatch ? unescapeXml(artMatch[1]) : undefined,
  };
}

export function parseVolumeResponse(xml: string): BoseVolume {
  const deviceIDMatch = xml.match(/<volume[^>]+deviceID="([^"]+)"/);
  const targetMatch = xml.match(/<targetvolume>(\d+)<\/targetvolume>/);
  const actualMatch = xml.match(/<actualvolume>(\d+)<\/actualvolume>/);
  const muteMatch = xml.match(/<muteenabled>(true|false)<\/muteenabled>/);

  return {
    deviceID: deviceIDMatch ? deviceIDMatch[1] : "",
    targetVolume: targetMatch ? parseInt(targetMatch[1], 10) : 0,
    actualVolume: actualMatch ? parseInt(actualMatch[1], 10) : 0,
    muteEnabled: muteMatch ? muteMatch[1] === "true" : false,
  };
}

const SPEAKER_PORT = 8090;

export async function fetchSpeakerInfo(
  ip: string,
  timeout = 2000,
): Promise<BoseSpeakerInfo> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/info`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to fetch /info from ${ip}`);
    }
    const text = await response.text();
    return parseInfoResponse(text);
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchNowPlaying(
  ip: string,
  timeout = 2000,
): Promise<BoseNowPlaying> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/nowPlaying`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to fetch /nowPlaying from ${ip}`);
    }
    const text = await response.text();
    return parseNowPlayingResponse(text);
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchVolume(
  ip: string,
  timeout = 2000,
): Promise<BoseVolume> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/volume`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to fetch /volume from ${ip}`);
    }
    const text = await response.text();
    return parseVolumeResponse(text);
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function sendKeyCommand(
  ip: string,
  key: string,
  timeout = 2000,
): Promise<void> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const pressPayload = `<key state="press" sender="Gabbo">${key}</key>`;
    const response1 = await fetch(`http://${ip}:${SPEAKER_PORT}/key`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: pressPayload,
      signal: controller.signal,
    });
    if (!response1.ok) {
      throw new Error(`Failed to send press key ${key} to ${ip}`);
    }

    const releasePayload = `<key state="release" sender="Gabbo">${key}</key>`;
    const response2 = await fetch(`http://${ip}:${SPEAKER_PORT}/key`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: releasePayload,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response2.ok) {
      throw new Error(`Failed to send release key ${key} to ${ip}`);
    }
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function setSpeakerVolume(
  ip: string,
  volume: number,
  timeout = 2000,
): Promise<void> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const payload = `<volume>${volume}</volume>`;
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/volume`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to set volume to ${volume} on ${ip}`);
    }
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function selectSpeakerSource(
  ip: string,
  source: string,
  sourceAccount = "",
  timeout = 2000,
): Promise<void> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    let payload = "";
    if (sourceAccount) {
      payload = `<ContentItem source="${source}" sourceAccount="${sourceAccount}"></ContentItem>`;
    } else {
      payload = `<ContentItem source="${source}"></ContentItem>`;
    }
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/select`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to select source ${source} on ${ip}`);
    }
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export function parsePresetsResponse(xml: string): BosePreset[] {
  const presets: BosePreset[] = [];
  const presetRegex = /<preset id="(\d+)"[^>]*>([\s\S]*?)<\/preset>/g;
  let match;
  while ((match = presetRegex.exec(xml)) !== null) {
    const id = match[1];
    const block = match[2];

    const sourceMatch = block.match(/<ContentItem source="([^"]+)"/);
    const sourceAccountMatch = block.match(/sourceAccount="([^"]+)"/);
    const locationMatch = block.match(/location="([^"]+)"/);
    const itemNameMatch = block.match(/<itemName>(.*?)<\/itemName>/);

    presets.push({
      id,
      name: itemNameMatch ? unescapeXml(itemNameMatch[1]) : `Preset ${id}`,
      source: sourceMatch ? sourceMatch[1] : "UNKNOWN",
      sourceAccount: sourceAccountMatch ? sourceAccountMatch[1] : undefined,
      location: locationMatch ? locationMatch[1] : undefined,
    });
  }
  return presets;
}

export function parseBassResponse(xml: string): BoseBass {
  const targetMatch = xml.match(/<targetbass>(-?\d+)<\/targetbass>/);
  const actualMatch = xml.match(/<actualbass>(-?\d+)<\/actualbass>/);
  return {
    targetBass: targetMatch ? parseInt(targetMatch[1], 10) : 0,
    actualBass: actualMatch ? parseInt(actualMatch[1], 10) : 0,
  };
}

export async function fetchPresets(
  ip: string,
  timeout = 2000,
): Promise<BosePreset[]> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/presets`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to fetch /presets from ${ip}`);
    }
    const text = await response.text();
    return parsePresetsResponse(text);
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchSpeakerBass(
  ip: string,
  timeout = 2000,
): Promise<BoseBass> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/bass`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to fetch /bass from ${ip}`);
    }
    const text = await response.text();
    return parseBassResponse(text);
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function setSpeakerBass(
  ip: string,
  bass: number,
  timeout = 2000,
): Promise<void> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const payload = `<bass>${bass}</bass>`;
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/bass`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to set bass to ${bass} on ${ip}`);
    }
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function sendLongKeyCommand(
  ip: string,
  key: string,
  durationMs = 2000,
  timeout = 5000,
): Promise<void> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const pressPayload = `<key state="press" sender="Gabbo">${key}</key>`;
    const response1 = await fetch(`http://${ip}:${SPEAKER_PORT}/key`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: pressPayload,
      signal: controller.signal,
    });
    if (!response1.ok) {
      throw new Error(`Failed to send press key ${key} to ${ip}`);
    }

    await new Promise((resolve) => setTimeout(resolve, durationMs));

    const releasePayload = `<key state="release" sender="Gabbo">${key}</key>`;
    const response2 = await fetch(`http://${ip}:${SPEAKER_PORT}/key`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: releasePayload,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response2.ok) {
      throw new Error(`Failed to send release key ${key} to ${ip}`);
    }
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function playSpeakerUri(
  ip: string,
  uri: string,
  name: string,
  source = "INTERNET_RADIO",
  timeout = 5000,
): Promise<void> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const escapedName = name
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedUri = uri
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const payload = `<ContentItem source="${source}" location="${escapedUri}" sourceAccount=""><itemName>${escapedName}</itemName></ContentItem>`;
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/select`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`Failed to play URI ${uri} on ${ip}`);
    }
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
