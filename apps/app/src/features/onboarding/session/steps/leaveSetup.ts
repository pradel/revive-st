import { SETUP_IP, speakerRequest, type StepEnv } from "./env";

/**
 * Sends `SETUP_LEAVE` over the link so the speaker ends setup mode. Errors are
 * tolerated (the speaker restarts its networking; verify repeats it over the
 * home network if needed). The session releases the link afterwards.
 */
export async function leaveSetup(
  env: StepEnv,
  signal: AbortSignal,
): Promise<void> {
  const { speaker, log } = env.deps;
  env.working("leaveSetup", { kind: "leavingSetup" });
  const reply = await speakerRequest(env.deps, signal, async (request) =>
    speaker.leaveSetup(SETUP_IP, request),
  );
  log.event("leaveSetup.link", {
    result: reply.isOk() ? "ok" : reply.error.name,
  });
}
