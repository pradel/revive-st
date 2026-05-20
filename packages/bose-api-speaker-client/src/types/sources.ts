import type { SourceStatus } from "./common.ts";

export interface SourceItem {
  source: string;
  sourceAccount: string;
  status: SourceStatus;
  name: string;
}

export interface SourcesResponse {
  deviceID: string;
  sourceItems: SourceItem[];
}
