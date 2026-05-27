export let currentStreamUrl = "http://localhost:8000/stream.mp3";

export function setStreamUrl(url: string) {
  currentStreamUrl = url;
}

export function getStreamUrl(): string {
  return currentStreamUrl;
}
