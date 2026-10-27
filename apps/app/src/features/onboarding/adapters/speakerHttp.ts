import {
  ApiError,
  boseSpeakerClient,
  HttpError,
  NetworkError,
  type BoseApiError,
} from "bose-api-speaker-client";

import {
  SpeakerApiError,
  SpeakerResponseError,
  SpeakerTransportError,
  type SpeakerError,
} from "../session/errors";
import type { SpeakerHttp } from "../session/ports";

function toSpeakerError(error: BoseApiError): SpeakerError {
  if (error instanceof NetworkError) {
    return new SpeakerTransportError({ message: error.message });
  }
  if (error instanceof ApiError) {
    // `requestXml` may contain the password: only the error entry is kept.
    const first = error.errors[0];
    return first
      ? new SpeakerApiError({
          errorName: first.name,
          value: first.value,
          message: first.message,
        })
      : new SpeakerResponseError({ message: "ApiError without errors" });
  }
  if (error instanceof HttpError) {
    return new SpeakerResponseError({
      message: `HTTP ${error.statusCode} ${error.statusText}`,
    });
  }
  return new SpeakerResponseError({ message: error.message });
}

export const boseSpeakerHttp: SpeakerHttp = {
  async info(ip, signal) {
    const result = await boseSpeakerClient({ ip }).getInfo({ signal });
    return result
      .map(({ deviceID, name, type }) => ({ deviceID, name, type }))
      .mapError(toSpeakerError);
  },
  async sendCredentials(ip, { ssid, password }, signal) {
    const result = await boseSpeakerClient({ ip }).sendCredentials(
      ssid,
      password,
      { signal },
    );
    return result.mapError(toSpeakerError);
  },
  async networkInfo(ip, signal) {
    const result = await boseSpeakerClient({ ip }).getNetworkInfo({ signal });
    return result
      .map(({ interfaces }) => ({
        interfaces: interfaces.map(
          ({ name, ipAddress, ssid, state, mode, frequencyKHz }) => ({
            name,
            ipAddress,
            ssid,
            state,
            mode,
            frequencyKHz,
          }),
        ),
      }))
      .mapError(toSpeakerError);
  },
  async setupState(ip, signal) {
    const result = await boseSpeakerClient({ ip }).getSetupState({ signal });
    return result.map(({ state }) => ({ state })).mapError(toSpeakerError);
  },
  async leaveSetup(ip, signal) {
    const result = await boseSpeakerClient({ ip }).setSetupState(
      "SETUP_LEAVE",
      { signal },
    );
    return result.mapError(toSpeakerError);
  },
};
