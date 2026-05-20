# bose-api-speaker-client

Typed HTTP client for the [Bose SoundTouch Web API](https://developer.bose.com/guides/bose-soundtouch-api) covering all 19 endpoints. Uses [`better-result`](https://better-result.dev) for railway-oriented error handling — no thrown exceptions, no `try/catch`.

## Install

```bash
pnpm add bose-api-speaker-client
```

## Quick start

```ts
import { boseSpeakerClient } from "bose-api-speaker-client";
import { Result } from "better-result";

const client = boseSpeakerClient({ ip: "192.168.1.100" });

const volume = await client.getVolume();
if (Result.isOk(volume)) {
  console.log(volume.value.actualvolume); // 42
  console.log(volume.value.muteenabled); // false
}

const set = await client.setVolume({ volume: 30 });
if (Result.isOk(set)) {
  console.log("volume updated");
}
```

## API

Each method returns `Promise<Result<T, BoseApiError>>` where `BoseApiError` is a union of `NetworkError | HttpError | XmlParseError | ApiError`.

| Method                                 | Route                        | HTTP |
| -------------------------------------- | ---------------------------- | ---- |
| `pressKey(params)`                     | `/key`                       | POST |
| `selectSource(params)`                 | `/select`                    | POST |
| `getSources()`                         | `/sources`                   | GET  |
| `getBassCapabilities()`                | `/bassCapabilities`          | GET  |
| `getBass()`                            | `/bass`                      | GET  |
| `setBass(value)`                       | `/bass`                      | POST |
| `getZone()`                            | `/getZone`                   | GET  |
| `setZone(params)`                      | `/setZone`                   | POST |
| `addZoneSlave(params)`                 | `/addZoneSlave`              | POST |
| `removeZoneSlave(params)`              | `/removeZoneSlave`           | POST |
| `getNowPlaying()`                      | `/nowPlaying`                | GET  |
| `getTrackInfo()`                       | `/trackInfo`                 | GET  |
| `getVolume()`                          | `/volume`                    | GET  |
| `setVolume(params)`                    | `/volume`                    | POST |
| `getPresets()`                         | `/presets`                   | GET  |
| `getInfo()`                            | `/info`                      | GET  |
| `setName(name)`                        | `/name`                      | POST |
| `getCapabilities()`                    | `/capabilities`              | GET  |
| `getAudioDspControls()`                | `/audiodspcontrols`          | GET  |
| `setAudioDspControls(params)`          | `/audiodspcontrols`          | POST |
| `getAudioProductToneControls()`        | `/audioproducttonecontrols`  | GET  |
| `setAudioProductToneControls(params)`  | `/audioproducttonecontrols`  | POST |
| `getAudioProductLevelControls()`       | `/audioproductlevelcontrols` | GET  |
| `setAudioProductLevelControls(params)` | `/audioproductlevelcontrols` | POST |

Default port is `8090`. Override with `boseSpeakerClient({ ip: "...", port: 8091 })`.

## Error handling

```ts
import { Result, matchError } from "better-result";
import type {
  HttpError,
  NetworkError,
  ApiError,
} from "bose-api-speaker-client";

const result = await client.getVolume();

const message = matchError(result.error!, {
  NetworkError: (e) => `Network error: ${e.message}`,
  HttpError: (e) => `HTTP ${e.statusCode}: ${e.statusText}`,
  ApiError: (e) => `API error: ${e.errors[0].name}`,
});
```
