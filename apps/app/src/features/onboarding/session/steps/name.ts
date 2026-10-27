import { retryWithin } from "../async";
import { SpeakerTransportError } from "../errors";
import { NAME_SUGGESTIONS, validateSpeakerName } from "../naming";
import { speakerRequest, type StepEnv } from "./env";

/** The API can still pause right after setup mode ends; retry `/name` within this budget. */
export const RENAME_BUDGET_MS = 10_000;
export const RENAME_INTERVAL_MS = 2000;

export interface Named {
  /** The speaker's name after this step. */
  name: string;
  /** The user picked a new name but the speaker did not take it. */
  renameFailed: boolean;
}

/**
 * Asks for a name (prefilled with `currentName`) and renames the speaker at
 * `host` over the home network. Keeping the name sends nothing; a failed
 * rename keeps the old name and does not fail setup.
 */
export async function nameSpeaker(
  env: StepEnv,
  signal: AbortSignal,
  host: string,
  currentName: string,
): Promise<Named> {
  const { speaker, clock, log } = env.deps;
  const chosen = await env.ask(
    signal,
    {
      kind: "nameSpeaker",
      currentName,
      suggestions: [...NAME_SUGGESTIONS],
    },
    (answer): { name: string | null } | undefined => {
      if (answer.kind !== "name") {
        return undefined;
      }
      if (answer.name === null) {
        return { name: null };
      }
      if (validateSpeakerName(answer.name) !== undefined) {
        log.event("name.invalid");
        return undefined;
      }
      return { name: answer.name.trim() };
    },
  );
  const name = chosen.name;
  if (name === null || name === currentName) {
    log.event("name.kept");
    return { name: currentName, renameFailed: false };
  }

  env.working("name", { kind: "renaming", name });
  const renamed = await retryWithin(
    clock,
    signal,
    { budgetMs: RENAME_BUDGET_MS, intervalMs: RENAME_INTERVAL_MS },
    async (attempt) =>
      speakerRequest(env.deps, attempt, async (request) =>
        speaker.setName(host, name, request),
      ),
    (last) =>
      last ??
      new SpeakerTransportError({
        message: `No answer within ${RENAME_BUDGET_MS} ms`,
      }),
  );
  if (renamed.isErr()) {
    log.event("name.failed", { error: renamed.error.name });
    return { name: currentName, renameFailed: true };
  }
  log.event("name.renamed");
  return { name, renameFailed: false };
}
