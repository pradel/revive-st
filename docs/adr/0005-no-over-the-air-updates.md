# Ship app changes only through store builds, without over-the-air updates

The app doesn't use EAS Update (`expo-updates`): every change, fixes included, reaches users as a new build through the App Store and Google Play. This is a deliberate choice, not a missing piece, so the absence of over-the-air updates isn't a gap to flag.

## Consequences

- A fix reaches users once its store build passes review.
- Each app version and build number names one JavaScript bundle, so crash reports are attributed by `$app_version` and `$app_build`; they carry no EAS Update tags (`eas/update_id`, `eas/channel`, `eas/runtime_version`).
- The app config and `eas.json` have no `runtimeVersion`, `updates` or `channel`.
