import { useQuery } from "@tanstack/react-query";

export interface RadioStation {
  changeid: string;
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  codec: string;
  bitrate: number;
}

function buildUrl(query: string, tag: string | null) {
  if (tag) {
    return `https://de1.api.radio-browser.info/json/stations/search?tag=${encodeURIComponent(tag.toLowerCase())}&limit=30&hidebroken=true&order=votes&reverse=true`;
  }
  if (query.trim()) {
    return `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query.trim())}&limit=30&hidebroken=true&order=votes&reverse=true`;
  }
  return "https://de1.api.radio-browser.info/json/stations/search?limit=30&hidebroken=true&order=votes&reverse=true";
}

async function fetchStations(
  query: string,
  tag: string | null,
): Promise<RadioStation[]> {
  const url = buildUrl(query, tag);
  const res = await fetch(url, {
    headers: { "User-Agent": "ReviveST/1.0" },
  });
  if (!res.ok) {
    throw new Error("API request failed");
  }
  return res.json() as Promise<RadioStation[]>;
}

export function useRadioStations(query: string, tag: string | null) {
  return useQuery({
    queryKey: ["radio-stations", query, tag],
    queryFn: async () => fetchStations(query, tag),
  });
}
