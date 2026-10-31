import { boseSpeakerClient } from "bose-api-speaker-client";

import { usesOurServer } from "./marge-api";

/**
 * Whether the speaker at `host` is set up for internet radio: it calls our
 * server and is paired with an account. Throws when the speaker doesn't
 * answer.
 */
export async function isSetUpForRadio(host: string): Promise<boolean> {
  const info = await boseSpeakerClient({ ip: host }).getInfo();
  if (info.isErr()) {
    throw info.error;
  }
  return (
    usesOurServer(info.value.margeURL) && info.value.margeAccountUUID !== ""
  );
}
