# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

- take screenshots of the app: `adb exec-out screencap -p > screenshot.png`
- see bose wifi module logs: `adb logcat -s BoseWifi:D`

## Release the Android beta

Until the app is on Google Play, each app version ships as an APK attached to its GitHub Release.

After the version PR (`chore(release): version packages`) merges and the Release workflow has created the `@revive-st/app@<version>` release, run from the repository root:

```bash
vp run release:app
```

It checks out the release's tag, builds the APK on EAS (build profile `apk`: the production build, as an APK), checks its signing key and attaches it to the release. If it stops halfway, run it again: it reuses a finished build of the tag and does nothing once the release has its APK. `vp run release:store` builds the release for the stores instead (`vp run release:store --platform ios --auto-submit`; `--help` lists the options).

The commands live in `packages/release` (Effect), whose tests (`vp run release#test`) cover these rules with fake tools.

The APK only contains the 64-bit ARM native libraries (`ORG_GRADLE_PROJECT_reactNativeArchitectures` in the `apk` profile of `eas.json`): every phone that runs Android 11 except a few 32-bit-only ones. The store build keeps every architecture, since Google Play sends each phone only its own. Release builds are shrunk with R8 (`enableMinifyInReleaseBuilds` in `app.json`); a native module that's only reached through reflection can need a keep rule, so test a release build on a phone after adding one.

You need `gh` and EAS logged in (`gh auth login`, `vpx eas-cli@latest login`) and the Android SDK build-tools (`ANDROID_HOME`, else `~/Library/Android/sdk`).

### Signing key

Every build is signed with the EAS keystore (`eas credentials`, SHA-256 `33:8F:03:C5:56:57:5C:A1:DC:01:AB:D9:D2:85:2B:ED:86:CC:1E:C3:88:C1:5B:F0:97:E3:78:FD:D3:27:22:12`, `APP_SIGNING_CERT_SHA256` in `packages/release/src/release.ts`). Android only updates an installed app with an APK signed by the same key, so:

- Never remove or regenerate it in `eas credentials`. `vp run release:app` refuses an APK signed with another key.
- Keep a copy outside Expo: `eas credentials` → Android → `credentials.json` → Download, then move the keystore and its passwords to the password manager. Don't commit them.
- On Google Play, set up Play App Signing with this key ("Use a different key" → export it from the Java keystore), so the Play version can update the beta APKs.
