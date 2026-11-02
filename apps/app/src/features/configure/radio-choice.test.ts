import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_SERVER_URL } from "../server/server-url";
import { radioStatus, type SpeakerRadio } from "../speakers/lib/speaker-radio";
import { currentChoice, defaultRadioChoice, keepOption } from "./radio-choice";

const SELF_HOSTED = "http://192.168.1.10:3000";
const BOTH = { radioBrowser: true, customStations: true };
const NONE = { radioBrowser: false, customStations: false };

const onBose: SpeakerRadio = {
  server: { kind: "bose", name: "Bose", setup: "setUp" },
  margeURL: "https://streaming.bose.com",
  paired: true,
  sources: BOTH,
};
const onSoundcork = (sources = BOTH): SpeakerRadio => ({
  server: { kind: "soundcork", name: "soundcork", setup: "warn" },
  margeURL: "http://192.168.1.20:8000/marge",
  paired: true,
  sources,
});
const onOurs: SpeakerRadio = {
  server: { kind: "revive", name: "Revive ST", setup: "setUp" },
  margeURL: SELF_HOSTED,
  paired: true,
  sources: BOTH,
};
const onHosted: SpeakerRadio = { ...onOurs, margeURL: DEFAULT_SERVER_URL };

const status = (radio: SpeakerRadio, ourServer = DEFAULT_SERVER_URL) =>
  radioStatus(radio, false, ourServer);

describe("currentChoice", () => {
  it.each([
    ["the hosted server", onHosted, DEFAULT_SERVER_URL, "hosted"],
    ["the hosted server, the app on its own", onHosted, SELF_HOSTED, "hosted"],
    ["the user's own server", onOurs, SELF_HOSTED, "own"],
  ] as const)(
    "tells a speaker already plays radio through %s",
    (_label, radio, ourServer, choice) => {
      expect(currentChoice(status(radio, ourServer), ourServer)).toBe(choice);
    },
  );

  it.each([
    ["another Revive ST server", onOurs, DEFAULT_SERVER_URL],
    ["a third-party server", onSoundcork(), DEFAULT_SERVER_URL],
    [
      "our server, without radio",
      { ...onHosted, paired: false },
      DEFAULT_SERVER_URL,
    ],
  ] as const)("is none for %s", (_label, radio, ourServer) => {
    expect(currentChoice(status(radio, ourServer), ourServer)).toBeUndefined();
  });
});

describe("keepOption", () => {
  it("keeps the server a speaker already plays radio through", () => {
    expect(keepOption(status(onSoundcork()), DEFAULT_SERVER_URL)?.title).toBe(
      "Keep soundcork",
    );
  });

  it("names another Revive ST server by its address", () => {
    expect(keepOption(status(onOurs), DEFAULT_SERVER_URL)?.title).toBe(
      "Keep 192.168.1.10:3000",
    );
  });

  it("doesn't repeat the option the speaker already plays radio through", () => {
    expect(keepOption(status(onHosted), DEFAULT_SERVER_URL)).toBeUndefined();
    expect(
      keepOption(status(onOurs, SELF_HOSTED), SELF_HOSTED),
    ).toBeUndefined();
  });

  it("isn't offered until the speaker's radio is checked", () => {
    expect(
      keepOption({ kind: "checking" }, DEFAULT_SERVER_URL),
    ).toBeUndefined();
  });

  it("keeps a server that isn't giving the speaker radio yet", () => {
    expect(
      keepOption(status(onSoundcork(NONE)), DEFAULT_SERVER_URL),
    ).toMatchObject({ title: "Keep soundcork", button: "Keep it as it is" });
  });

  it("never offers to keep Bose's servers, which are gone", () => {
    expect(keepOption(status(onBose), DEFAULT_SERVER_URL)).toMatchObject({
      title: "Not now",
      button: "Skip for now",
    });
  });
});

describe("defaultRadioChoice", () => {
  it("keeps a speaker that already plays radio where it is", () => {
    expect(defaultRadioChoice(status(onSoundcork()), DEFAULT_SERVER_URL)).toBe(
      "keep",
    );
  });

  it("selects the option a speaker already plays radio through", () => {
    expect(defaultRadioChoice(status(onHosted), DEFAULT_SERVER_URL)).toBe(
      "hosted",
    );
  });

  it.each([
    [DEFAULT_SERVER_URL, "hosted"],
    [SELF_HOSTED, "own"],
  ])(
    "offers the server the app is set to (%s) for a speaker without radio",
    (ourServer, choice) => {
      expect(defaultRadioChoice(status(onBose, ourServer), ourServer)).toBe(
        choice,
      );
    },
  );
});
