import {
  Code,
  Speaker,
  Radio,
  Settings2,
  PlayCircle,
  Apple,
  Store,
  ShieldCheck,
  WifiOff,
  Plus,
  Minus,
  MessageCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { FAQPage, SoftwareApplication, WithContext } from "schema-dts";

import { WEBSITE_CONFIG } from "@/config";

export const metadata: Metadata = {
  title: "Revive ST — SoundTouch Controller App for iPhone and Android",
  description:
    "The SoundTouch app was shut down, but your speakers still work perfectly. Revive ST is the open-source replacement that brings back your preset buttons, internet radio, and multi-room control. Get your speakers working again today!",
  alternates: {
    canonical: "/",
  },
};

const FAQS = [
  {
    question: "Which speakers does Revive ST work with?",
    answer:
      "Every Bose SoundTouch speaker that used the original app — the SoundTouch 10, 20, 30, Portable, Wave SoundTouch, SoundTouch SA‑4, SoundTouch 300 soundbar, and SoundTouch outdoor speaker systems. If the original SoundTouch app controlled it, Revive ST will too.",
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
    question: "How can I help?",
    answer:
      "Revive ST is a community project. You can report bugs, request features, or contribute code on GitHub. If you just want to support the work, downloading the app from the store is the easiest way.",
  },
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
      price: "9.99",
      priceCurrency: "USD",
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
    <div className="flex flex-col min-h-screen bg-neutral-50 text-neutral-900 selection:bg-emerald-200">
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
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-24 flex flex-col items-center justify-center text-center px-4">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-neutral-50 to-neutral-50" />

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance max-w-4xl mx-auto mb-6 text-neutral-900">
            Your Bose speakers still work.
            <br />
            <span className="text-emerald-600">Now your app does too.</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 text-pretty max-w-2xl mx-auto mb-10">
            The SoundTouch app stopped working in May 2026. Revive ST brings
            back full control of your speakers, no account needed.
          </p>

          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href={WEBSITE_CONFIG.IOS_APP_URL}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-6 py-3 text-base font-semibold hover:bg-emerald-700 transition-colors w-full sm:w-auto shadow-sm"
              >
                <Apple className="w-5 h-5 mr-2" />
                App Store
              </Link>
              <Link
                href={WEBSITE_CONFIG.ANDROID_APP_URL}
                className="inline-flex items-center justify-center rounded-md bg-neutral-200 text-neutral-900 px-6 py-3 text-base font-semibold hover:bg-neutral-300 transition-colors w-full sm:w-auto shadow-sm"
              >
                <Store className="w-5 h-5 mr-2" />
                Google Play
              </Link>
            </div>
            <span className="text-xs uppercase tracking-widest text-neutral-500 font-mono mt-4">
              One-time purchase &middot; No subscription &middot; Open source
            </span>
          </div>
        </section>

        {/* Trust / Open Source Strip */}
        <section className="py-4 border-y border-neutral-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center text-center md:text-left gap-4 md:gap-3 text-sm text-neutral-700">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-pretty">
              <strong>Revive ST is fully open source.</strong> The code lives on
              GitHub and anyone can run or compile it themselves, so nothing
              like this can ever happen to you again.
            </p>
            <a
              href={WEBSITE_CONFIG.GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center font-medium hover:underline text-emerald-600"
            >
              View source on GitHub &rarr;
            </a>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-24 px-4 bg-neutral-50">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 block">
                What happened
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-balance">
                The SoundTouch app was shut down. Your speakers lost their key
                features.
              </h2>
              <div className="prose prose-lg text-neutral-600">
                <p>
                  In May 2026, the SoundTouch cloud servers were switched off.
                  Preset buttons stopped responding, internet radio stations
                  disappeared, and multi-room control broke entirely. Speakers
                  that cost hundreds of dollars were left without a way to
                  control them.
                </p>
                <p className="font-medium text-neutral-900 mt-4">
                  Your hardware is perfectly fine. All it needed was a new app.
                </p>
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-16 flex flex-col items-center justify-center w-full max-w-sm aspect-square">
                <WifiOff className="w-16 h-16 text-red-500 mb-4" />
                <span className="text-red-500 font-mono text-sm tracking-tight">
                  Connection Failed
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-24 px-4 bg-white border-y border-neutral-200"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 block">
                What you get back
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-balance">
                Everything the original app had and a few things it never did.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <FeatureCard
                icon={<Settings2 className="w-5 h-5" />}
                title="Preset buttons restored"
                description="Your six physical buttons work again. Press them and your speaker plays exactly what you set, just like before."
                className="md:col-span-2 md:row-span-2"
              />
              <FeatureCard
                icon={<PlayCircle className="w-5 h-5" />}
                title="Full playback control"
                description="Play, pause, skip tracks, and adjust volume from your phone. Fast, responsive, no login screen in the way."
                className="md:col-span-2"
              />
              <FeatureCard
                icon={<Radio className="w-5 h-5" />}
                title="Internet radio"
                description="Thousands of stations available through Radio Browser. Find and save your favorites."
                className="md:col-span-2"
              />
              <FeatureCard
                icon={<Speaker className="w-5 h-5" />}
                title="Multi-room audio"
                description="Group any speakers on your home network and control them together or one at a time."
                className="md:col-span-4"
              />
              <FeatureCard
                icon={<Settings2 className="w-5 h-5" />}
                title="EQ and audio modes"
                description="Adjust bass and treble, or switch on Dialog, Night, or Direct DSP modes to get the right sound for any room."
                className="md:col-span-2"
              />
              <FeatureCard
                icon={<Code className="w-5 h-5" />}
                title="No account. No cloud."
                description="Revive ST runs entirely on your local Wi-Fi. Nothing leaves your home, and there is no server that can be switched off."
                className="md:col-span-4 bg-neutral-100"
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 px-4 bg-neutral-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Up and running in three steps.
              </h2>
            </div>

            <div className="relative flex flex-col md:flex-row justify-between items-center md:items-start gap-8 md:gap-4 mt-12">
              <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-0.5 bg-neutral-200 -z-10" />

              <Step
                number="1"
                title="Download the app"
                description="Install Revive ST from the App Store or Google Play."
                active
              />
              <Step
                number="2"
                title="Find your speakers"
                description="The setup wizard scans your home network and finds every SoundTouch speaker automatically. No IP addresses, no manual setup."
              />
              <Step
                number="3"
                title="Take control"
                description="Your speakers are back. Play music, restore your presets, group rooms, and use your physical buttons again."
              />
            </div>
          </div>
        </section>

        {/* Open Source Section */}
        <section
          id="open-source"
          className="py-24 px-4 bg-white border-y border-neutral-200 text-center"
        >
          <div className="max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 block">
              Built to last
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-balance">
              The code is yours, forever.
            </h2>
            <div className="text-lg text-neutral-600 mb-8 text-pretty space-y-4 max-w-2xl mx-auto">
              <p>
                Revive ST is fully open source, which means anyone can read it,
                check it, and run it. Even if the project stops being maintained
                one day, the app keeps working. You can download the code from
                GitHub and build it yourself for free, at any time.
              </p>
              <p>
                If you want to support the project and get automatic updates,
                you can grab it with a one-time purchase on the App Store or
                Google Play.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WEBSITE_CONFIG.GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-base font-semibold hover:bg-neutral-50 transition-colors text-neutral-900 shadow-sm"
              >
                View source on GitHub
              </a>
              <Link
                href="#download"
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-6 py-3 text-base font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Download the App
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 px-4 bg-neutral-50">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
            <div className="md:col-span-5 lg:col-span-4 flex flex-col">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-balance">
                Frequently asked questions
              </h2>
              <p className="text-lg text-neutral-600 mb-8 text-pretty">
                Can't find the answer you're looking for? We're here to help.
              </p>
              <a
                href={`mailto:${WEBSITE_CONFIG.CONTACT_EMAIL}`}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-6 py-3 text-base font-semibold hover:bg-emerald-700 transition-colors self-start shadow-sm"
              >
                Get in touch
                <MessageCircle className="w-5 h-5 ml-2" />
              </a>
            </div>

            <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-3">
              {FAQS.map((faq) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section
          id="download"
          className="py-24 px-4 bg-white border-t border-neutral-200 text-center"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-balance mb-6">
              Your speakers are still good.
              <br />
              Get them working again.
            </h2>
            <p className="text-lg text-neutral-600 mb-10 text-pretty">
              One purchase, no subscription, full control on your local network.
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href={WEBSITE_CONFIG.IOS_APP_URL}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-6 py-3 text-base font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Apple className="w-5 h-5 mr-2" />
                  Download for iOS
                </Link>
                <Link
                  href={WEBSITE_CONFIG.ANDROID_APP_URL}
                  className="inline-flex items-center justify-center rounded-md bg-neutral-200 text-neutral-900 px-6 py-3 text-base font-semibold hover:bg-neutral-300 transition-colors shadow-sm"
                >
                  <Store className="w-5 h-5 mr-2" />
                  Download for Android
                </Link>
              </div>
              <span className="text-xs uppercase tracking-widest text-neutral-500 font-mono mt-4">
                One-time purchase &middot; No subscription &middot; Open source
                &middot; Free to compile
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Note */}
      <footer className="py-8 px-6 border-t border-neutral-200 bg-white flex flex-col md:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
        <div className="font-bold text-neutral-900 text-sm">Revive ST</div>
        <p>
          &copy; {new Date().getFullYear()} Revive ST. Not affiliated with Bose
          Corporation. Bose and SoundTouch are trademarks of Bose Corporation.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="hover:text-neutral-900 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="hover:text-neutral-900 transition-colors"
          >
            Terms of Service
          </Link>
          <a
            href={WEBSITE_CONFIG.GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900 transition-colors"
          >
            GitHub Repository
          </a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={`p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-emerald-200 hover:bg-white transition-colors flex flex-col ${className}`}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 text-emerald-600 bg-emerald-50 shrink-0">
        {icon}
      </div>
      <h3 className="text-base font-bold mb-2 text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center flex-1 z-10 w-full max-w-[280px]">
      <div
        className={`w-16 h-16 rounded-full bg-white border-2 flex items-center justify-center text-2xl font-bold mb-4 shadow-sm transition-colors ${active ? "border-emerald-500 text-emerald-600" : "border-neutral-200 text-neutral-900"}`}
      >
        {number}
      </div>
      <h3 className="text-lg font-bold mb-2 text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-600">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group bg-white rounded-2xl border border-neutral-200 hover:border-emerald-200 shadow-sm text-left overflow-hidden [&_summary::-webkit-details-marker]:hidden transition-colors">
      <summary className="flex cursor-pointer items-center justify-between p-4 md:p-5 font-semibold text-base text-neutral-900 focus-visible:outline-none focus-visible:bg-neutral-50 hover:bg-neutral-50 transition-colors">
        {question}
        <div className="ml-4 shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 transition-colors group-hover:bg-emerald-100">
          <Plus className="w-4 h-4 block group-open:hidden" />
          <Minus className="w-4 h-4 hidden group-open:block" />
        </div>
      </summary>
      <div className="px-4 md:px-5 pb-4 md:pb-5 text-sm text-neutral-600 leading-relaxed text-pretty">
        {answer}
      </div>
    </details>
  );
}
