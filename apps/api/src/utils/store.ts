const streamUrls = new Map<string, string>();

export function setStreamUrl(accountId: string, url: string) {
  streamUrls.set(accountId, url);
}

export function getStreamUrl(accountId: string): string | undefined {
  return streamUrls.get(accountId);
}
