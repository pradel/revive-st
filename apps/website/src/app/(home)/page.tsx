import {
  ArrowRight,
  Check,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  Terminal,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { FAQPage, SoftwareApplication, WithContext } from "schema-dts";

import { Equalizer } from "@/components/equalizer";
import { Footer } from "@/components/footer";
import { GitHubIcon } from "@/components/github-icon";
import { HeroPhone } from "@/components/hero-phone";
import { LogoMark } from "@/components/logo-mark";
import { PresetDemo } from "@/components/preset-demo";
import { StickyCta } from "@/components/sticky-cta";
import { StoreBadges } from "@/components/store-badges";
import { SupportedSpeakers } from "@/components/supported-speakers";
import { WEBSITE_CONFIG } from "@/config";

export const metadata: Metadata = {
  title: "Revive ST — SoundTouch Controller App for iPhone and Android",
  description:
    "The SoundTouch app was shut down, but your speakers still work perfectly. Revive ST is the open-source replacement that brings back your preset buttons, internet radio, and full control. Get your speakers working again today!",
  alternates: {
    canonical: "/",
  },
};

/** Store price of the app, shown on the page and in its structured data. */
const PRICE = { amount: "9.99", currency: "USD", label: "$9.99" };

const FAQS = [
  {
    question: "Which speakers does Revive ST work with?",
    answer:
      "Every Bose SoundTouch speaker that used the original app — the SoundTouch 10, 20, 30, Portable. If the original SoundTouch app controlled it, Revive ST will too.",
    link: {
      text: "See supported speakers \u2192",
      href: "/docs/supported-speakers",
    },
  },
  {
    question: "Is it a subscription?",
    answer:
      "No. You pay once on the App Store or Google Play and get every update. The source code is free on GitHub if you'd rather build the app yourself.",
  },
  {
    question: "How hard is the setup?",
    answer:
      "The app walks you through it step by step. Open Revive ST, and it automatically finds every SoundTouch speaker on your network. A one-time configuration wizard connects each speaker to your network — after that, everything just works.",
  },
  {
    question: "What features are supported?",
    answer:
      "Playback control (play, pause, skip, volume), hardware presets, internet radio with favorites, bass and treble EQ, speaker renaming, source switching (Bluetooth, AUX, Wi‑Fi Audio), and real-time sync across devices. Multi-room zone control is coming soon.",
  },
  {
    question: "What if Revive ST shuts down one day?",
    answer:
      "Your speakers keep working. The app and its server are open source under the MIT licence, so you can run the server at home with Docker and point your speakers at it, whatever happens to this project.",
    link: {
      text: "Read the self-hosting guide \u2192",
      href: "/docs/self-hosting",
    },
  },
  {
    question: "How can I help?",
    answer:
      "Revive ST is a community project. Share feedback and ideas in GitHub Discussions, and report bugs or contribute code on GitHub. If you want to support the work, buy the app from the store or sponsor the project on GitHub Sponsors.",
  },
];

const BEFORE = [
  "Preset buttons stopped responding",
  "Internet radio stations disappeared",
  "No app left to control your speakers",
  "Multi-room groups broke",
];

const AFTER: { text: string; soon?: boolean }[] = [
  { text: "Presets work again, set from your phone" },
  { text: "Thousands of internet radio stations" },
  { text: "Playback, volume, sources and EQ in one app" },
  { text: "Multi-room zones", soon: true },
];

export default function HomePage() {
  const softwareLd: WithContext<SoftwareApplication> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Revive ST",
    operatingSystem: "iOS, Android",
    applicationCategory: "MultimediaApplication",
    offers: {
      "@type": "Offer",
      price: PRICE.amount,
      priceCurrency: PRICE.currency,
    },
  };

  const faqLd: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg text-fg selection:bg-accent-muted">
      <script
        type="application/ld+json"
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
      />
      <script
        type="application/ld+json"
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <main className="flex flex-col flex-1">
        {/* Hero */}
        <section
          id="hero"
          className="relative isolate overflow-hidden px-4 pt-20 pb-20 lg:pt-28 lg:pb-28"
        >
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--accent-muted),transparent_65%)]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--surface-3)_1px,transparent_1px)] bg-[length:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-20 lg:gap-8 items-center">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <Link
                href="/docs/supported-speakers"
                className="group mb-8 inline-flex items-center gap-2 rounded-full bg-surface-1 py-1.5 pr-3 pl-2.5 text-xs font-medium text-fg-secondary ring-1 ring-separator transition-colors hover:text-fg"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                Works with SoundTouch 10, 20, 30 & Portable
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-balance max-w-2xl mb-6 text-fg">
                Your Bose speakers still work.{" "}
                <span className="text-accent">Now your app does too.</span>
              </h1>
              <p className="text-lg md:text-xl text-fg-secondary text-pretty max-w-xl mb-10">
                The SoundTouch app stopped working in May 2026. Revive ST brings
                back your preset buttons, internet radio and full control of
                your speakers. No account, no subscription.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <StoreBadges className="justify-center" />
                <a
                  href={WEBSITE_CONFIG.GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[45px] items-center gap-2 rounded-lg bg-surface-1 px-4 text-sm font-semibold text-fg ring-1 ring-separator transition-colors hover:bg-surface-2"
                >
                  <GitHubIcon className="size-4" />
                  View source
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-fg-secondary">
                {["One-time purchase", "No sign-up", "Open source"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check className="size-4 text-accent" strokeWidth={3} />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="relative flex justify-center lg:justify-end lg:pr-24 xl:pr-28">
              <HeroPhone />
            </div>
          </div>
        </section>

        <SupportedSpeakers />

        {/* Preset demo */}
        <section id="presets" className="px-4 py-24 lg:py-32">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left">
              <Eyebrow>The feature you missed most</Eyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-balance mb-6">
                Your six preset buttons work again.
              </h2>
              <p className="text-lg text-fg-secondary text-pretty max-w-lg mx-auto lg:mx-0">
                Pick a station in Revive ST, hold a preset button on the speaker
                until it beeps, and it&apos;s saved. From then on, one press on
                the speaker or the remote starts your music. No phone needed,
                just like the day you bought it. Bluetooth, AUX, Spotify and
                AirPlay show up too, so you always know what&apos;s playing.
              </p>
            </div>
            <PresetDemo />
          </div>
        </section>

        {/* Before / after */}
        <section id="why" className="px-4 pb-24 lg:pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <Eyebrow>What happened</Eyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-balance max-w-3xl mx-auto mb-5">
                The servers went dark. Your speakers didn&apos;t.
              </h2>
              <p className="text-lg text-fg-secondary text-pretty max-w-2xl mx-auto">
                In May 2026 the SoundTouch cloud was switched off, and speakers
                that cost hundreds of dollars lost their best features
                overnight. The hardware is fine. All it needed was a new app.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-3xl bg-surface-1 p-8">
                <p className="mb-6 text-xs font-bold uppercase tracking-widest text-fg-tertiary">
                  Since May 2026
                </p>
                <ul className="space-y-4">
                  {BEFORE.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-fg-secondary"
                    >
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-danger-muted text-danger">
                        <X className="size-3.5" strokeWidth={3} />
                      </span>
                      <span className="line-through decoration-fg-tertiary/60">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-surface-1 p-8 ring-1 ring-accent/40">
                <div className="absolute -top-24 -right-24 size-64 rounded-full bg-accent-muted blur-3xl" />
                <p className="relative mb-6 text-xs font-bold uppercase tracking-widest text-accent">
                  With Revive ST
                </p>
                <ul className="relative space-y-4">
                  {AFTER.map((item) => (
                    <li
                      key={item.text}
                      className="flex items-start gap-3 font-medium text-fg"
                    >
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      <span>
                        {item.text}
                        {item.soon && (
                          <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
                            Coming soon
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-4 pb-24 lg:pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <Eyebrow>What you get back</Eyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-balance max-w-3xl mx-auto">
                Everything the original app did. None of the lock-in.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                title="Internet radio, rebuilt"
                description="Search thousands of stations from Radio Browser by name or genre, save your favorites, and put any of them on a preset."
                className="md:col-span-2"
              >
                <ScreenshotPeek
                  src="/app-3.webp"
                  alt="Radio browser with trending stations"
                />
              </FeatureCard>
              <FeatureCard
                title="Now playing, whatever the source"
                description="See what's on from radio, Spotify, Bluetooth or AUX, switch sources, and control playback and volume from anywhere in the house."
                className="md:row-span-2"
              >
                <ScreenshotPeek
                  src="/app-2.webp"
                  alt="Now playing screen with album art and controls"
                  tall
                />
              </FeatureCard>
              <FeatureCard
                title="Sound tuned to your room"
                description="Bass and treble EQ, plus Dialog, Night and Direct modes on speakers that support them."
              >
                <div aria-hidden className="mt-auto space-y-3 pt-8">
                  {[
                    { label: "Bass", value: 64 },
                    { label: "Treble", value: 42 },
                  ].map((band) => (
                    <div
                      key={band.label}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="w-12 text-fg-tertiary">
                        {band.label}
                      </span>
                      <div className="h-1.5 flex-1 rounded-full bg-surface-3">
                        <div
                          className="relative h-full rounded-full bg-accent"
                          style={{ width: `${band.value}%` }}
                        >
                          <span className="absolute top-1/2 right-0 size-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    {["Dialog", "Night", "Direct"].map((mode) => (
                      <span
                        key={mode}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          mode === "Night"
                            ? "bg-accent text-on-accent"
                            : "bg-surface-3 text-fg-secondary"
                        }`}
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>
              </FeatureCard>
              <FeatureCard
                title="Set up in minutes"
                description="Revive ST finds every SoundTouch on your Wi‑Fi, and a guided setup connects new or reset speakers."
              >
                <ul aria-hidden className="mt-auto space-y-2 pt-8">
                  {[
                    { room: "Living room", model: "SoundTouch 20" },
                    { room: "Kitchen", model: "SoundTouch 10" },
                    { room: "Garden", model: "SoundTouch Portable" },
                  ].map((speaker) => (
                    <li
                      key={speaker.room}
                      className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm"
                    >
                      <span>
                        <span className="font-medium text-fg">
                          {speaker.room}
                        </span>
                        <span className="ml-2 text-xs text-fg-tertiary">
                          {speaker.model}
                        </span>
                      </span>
                      <Check className="size-4 text-accent" strokeWidth={3} />
                    </li>
                  ))}
                </ul>
              </FeatureCard>
              <div className="md:col-span-3 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-surface-1 px-8 py-6">
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-secondary">
                  {[
                    "Rename speakers",
                    "Real-time sync across phones",
                    "Bluetooth & AUX switching",
                    "No account to create",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check className="size-4 text-accent" strokeWidth={3} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={WEBSITE_CONFIG.FEEDBACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-accent hover:underline"
                >
                  Next up: multi-room zones
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & open source */}
        <section id="pricing" className="px-4 pb-24 lg:pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <Eyebrow>Built to last</Eyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-balance mb-5">
                Pay once. Or build it yourself.
              </h2>
              <p className="text-lg text-fg-secondary text-pretty max-w-2xl mx-auto">
                Revive ST is open source, so nobody can switch your speakers off
                again. Buying the app gets you store updates and keeps the
                project going.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative flex flex-col overflow-hidden rounded-3xl bg-surface-1 p-8 ring-1 ring-accent/40">
                <div className="absolute -top-24 -left-24 size-64 rounded-full bg-accent-muted blur-3xl" />
                <p className="relative text-sm font-semibold text-accent">
                  Revive ST app
                </p>
                <p className="relative mt-3 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tighter">
                    {PRICE.label}
                  </span>
                  <span className="text-fg-secondary">one time</span>
                </p>
                <PlanList
                  items={[
                    "iPhone and Android",
                    "Every update, automatically",
                    "No subscription, no account",
                    "Funds the project's development",
                  ]}
                />
                <StoreBadges className="relative mt-auto pt-8" />
              </div>

              <div className="flex flex-col rounded-3xl bg-surface-1 p-8">
                <p className="text-sm font-semibold text-fg-secondary">
                  Open source
                </p>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tighter">
                    Free
                  </span>
                  <span className="text-fg-secondary">MIT licence</span>
                </p>
                <PlanList
                  items={[
                    "Read, fork and build the app yourself",
                    "Run the server at home with Docker",
                  ]}
                />
                <div className="dark mt-6 overflow-hidden rounded-2xl bg-bg text-left font-mono text-[13px] ring-1 ring-white/10">
                  <div className="flex items-center gap-2 border-b border-separator px-4 py-2.5 text-xs text-fg-tertiary">
                    <Terminal className="size-3.5" />
                    self-host
                  </div>
                  <pre className="overflow-x-auto px-4 py-3.5 leading-relaxed text-fg-secondary">
                    <code>
                      <span className="text-fg-tertiary">$ </span>
                      <span className="text-fg">docker run</span>
                      {` -d --name revive-st --restart unless-stopped \\
    -p 3000:3000 -v revive-st-data:/data \\
    `}
                      <span className="text-accent">
                        ghcr.io/pradel/revive-st-api:latest
                      </span>
                    </code>
                  </pre>
                </div>
                <div className="mt-auto flex flex-wrap gap-3 pt-8">
                  <a
                    href={WEBSITE_CONFIG.GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85"
                  >
                    <GitHubIcon className="size-4" />
                    View on GitHub
                  </a>
                  <Link
                    href="/docs/self-hosting"
                    className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-3"
                  >
                    Self-hosting guide
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-fg-secondary">
              Already have it and want to give back?{" "}
              <a
                href={WEBSITE_CONFIG.SPONSOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                <Heart className="size-3.5" />
                Sponsor on GitHub
              </a>
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-4 pb-24 lg:pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-balance">
                Back up and running in five minutes.
              </h2>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Step
                number="01"
                title="Download the app"
                description="Install Revive ST from the App Store or Google Play."
              />
              <Step
                number="02"
                title="Find your speakers"
                description="The app scans your Wi‑Fi and finds every SoundTouch on it. No IP addresses, no manual setup."
              />
              <Step
                number="03"
                title="Press play"
                description="Play music, set your presets and use the buttons on your speakers again."
              />
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-4 pb-24 lg:pb-32">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
            <div className="md:col-span-5 lg:col-span-4 flex flex-col">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6 text-balance">
                Questions, answered
              </h2>
              <p className="text-lg text-fg-secondary mb-8 text-pretty">
                Can&apos;t find the answer you&apos;re looking for? The
                community is here to help.
              </p>
              <a
                href={WEBSITE_CONFIG.FEEDBACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-surface-1 px-5 py-3 text-sm font-semibold text-fg ring-1 ring-separator transition-colors hover:bg-surface-2 self-start"
              >
                Ask the community
                <MessageCircle className="size-4 ml-2" />
              </a>
            </div>

            <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-3">
              {FAQS.map((faq) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  link={faq.link}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="download" className="px-4 pb-24 lg:pb-32">
          <div className="relative max-w-6xl mx-auto overflow-hidden rounded-[2.5rem] bg-surface-1 px-6 py-20 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,var(--accent-muted),transparent_70%)]" />
            <Equalizer
              bars={64}
              className="absolute inset-x-0 bottom-0 h-20 gap-1 px-6 opacity-20"
              barClassName="bg-accent rounded-b-none"
            />
            <div className="relative">
              <LogoMark className="mx-auto mb-10 h-20 dark:drop-shadow-[0_0_24px_var(--accent)]" />
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-balance max-w-3xl mx-auto mb-6">
                Your speakers are still good. Get them working again.
              </h2>
              <p className="text-lg text-fg-secondary mb-10 text-pretty">
                {PRICE.label} once. No subscription, no account, open source.
              </p>
              <StoreBadges className="justify-center" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <StickyCta />
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-accent">
      {children}
    </span>
  );
}

function FeatureCard({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-3xl bg-surface-1 p-8 pb-0 ${className}`}
    >
      <h3 className="mb-2 text-xl font-bold tracking-tight text-fg">{title}</h3>
      <p className="max-w-md text-fg-secondary text-pretty">{description}</p>
      <div className="flex flex-1 flex-col pb-8 has-[.screenshot-peek]:pb-0">
        {children}
      </div>
    </div>
  );
}

/** The top of an app screenshot in a phone frame, rising from a card's bottom edge. */
function ScreenshotPeek({
  src,
  alt,
  tall = false,
}: {
  src: string;
  alt: string;
  tall?: boolean;
}) {
  return (
    <div
      className={`screenshot-peek relative mx-auto mt-10 w-full max-w-[280px] overflow-hidden rounded-t-[2rem] border-[8px] border-b-0 border-device-frame bg-device-bezel ${
        tall ? "h-80 md:h-auto md:flex-1 md:min-h-96" : "h-64"
      }`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="280px"
        className="object-cover object-top"
      />
    </div>
  );
}

function PlanList({ items }: { items: string[] }) {
  return (
    <ul className="relative mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-fg-secondary">
          <Check
            className="mt-0.5 size-4 shrink-0 text-accent"
            strokeWidth={3}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <li className="rounded-3xl bg-surface-1 p-8">
      <span className="font-mono text-sm font-bold text-accent">{number}</span>
      <h3 className="mt-6 mb-2 text-xl font-bold tracking-tight text-fg">
        {title}
      </h3>
      <p className="text-fg-secondary text-pretty">{description}</p>
    </li>
  );
}

function FaqItem({
  question,
  answer,
  link,
}: {
  question: string;
  answer: string;
  link?: { text: string; href: string };
}) {
  return (
    <details className="group rounded-2xl bg-surface-1 text-left overflow-hidden [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between p-5 md:p-6 font-semibold text-base text-fg focus-visible:outline-none focus-visible:bg-surface-2 hover:bg-surface-2 transition-colors">
        {question}
        <div className="ml-4 shrink-0 size-8 rounded-full bg-surface-2 flex items-center justify-center text-fg-secondary transition-colors group-hover:bg-accent-muted group-hover:text-accent group-open:bg-accent group-open:text-on-accent">
          <Plus className="size-4 block group-open:hidden" />
          <Minus className="size-4 hidden group-open:block" />
        </div>
      </summary>
      <div className="px-5 md:px-6 pb-5 md:pb-6 text-fg-secondary leading-relaxed text-pretty">
        <p>{answer}</p>
        {link && (
          <Link
            href={link.href}
            className="inline-block mt-2 font-medium text-accent hover:underline"
          >
            {link.text}
          </Link>
        )}
      </div>
    </details>
  );
}
