# Revive ST

> Open-source replacement for the discontinued Bose SoundTouch app.

Bose shut down the SoundTouch cloud in May 2026, leaving thousands of speakers without app control, broken preset buttons, and no way to play internet radio. Revive ST brings it all back — and then some.

**Available on:** [iOS (coming soon)](#TODO) · [Android (coming soon)](#TODO)

**Website & Documentation:** [revivest.app](https://www.revivest.app)

---

## Features

- **Full playback control** — play, pause, skip, volume, and more
- **Volume & multi-room zones** — group speakers, control per-speaker volume
- **Hardware preset restoration** — physical buttons 1–6 work again
- **Internet radio** — thousands of stations via Radio Browser
- **Custom scenes** — trigger multi-speaker groups with a single tap
- **EQ & audio modes** — bass, treble, Dialog/Night/Direct DSP modes
- **Real-time sync** — WebSocket-based, instant state updates across devices
- **Setup wizard** — easy onboarding with automatic speaker discovery
- **No account required** — works entirely on your local network

---

## Development

### Prerequisites

Before you start, ensure you have the following prerequisites installed:

- **Node.js**: v24 or newer.
- **Vite+**: We use Vite+ (`vp`) as our unified toolchain for package and runtime management.
- **Expo CLI**: Required for mobile development.

### Setup

- Setup the monorepo:

```bash
vp run ready
```

---

## Contributing

We welcome contributions of all kinds, whether you want to fix a bug, add a new feature, or improve the documentation, this guide will help you get started.

1. **Fork the repository** on GitHub.
2. **Create a branch** for your feature or bug fix (`git checkout -b feature/my-new-feature`).
3. **Write your code** and ensure it passes all tests (`vp check`, `vp test`).
4. **Commit your changes** using [Conventional Commits](https://www.conventionalcommits.org/).
5. **Add a changeset** if you modify any packages or apps: `vp run changeset`.
6. **Open a Pull Request** against the `main` branch.

For large features or architecture changes, please open an issue first to discuss what you would like to change.

---

## License

_Revive ST is not affiliated with or endorsed by Bose Corporation. Bose and SoundTouch are trademarks of Bose Corporation._
