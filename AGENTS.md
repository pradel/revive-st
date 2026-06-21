<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Agent skills

### Issue tracker

Issues live as GitHub issues on `pradel/revive-st`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) are used verbatim. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — `CONTEXT-MAP.md` at the root points to per-context `CONTEXT.md` files. System-wide ADRs at `docs/adr/`, context-scoped at `src/<context>/docs/adr/`. See `docs/agents/domain.md`.

## Repository Structure

- `apps/app/`: The Expo React Native mobile application.
- `apps/api/`: The Hono/Nitro API server that emulates the Bose Sountouch Marge streaming server.
- `apps/website/`: The Next.js website and documentation.
- `packages/bose-api-speaker-client/`: Typed HTTP client for the Bose Speaker API.
- `packages/bose-wifi/`: Expo native module for Wi-Fi speaker setup.
- `docs/` — Project documentation including Bose API reference, agent skills guides.
- `.github/workflows/` — CI/CD pipeline definitions.
