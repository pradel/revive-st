import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { WEBSITE_CONFIG } from "@/config";

export const metadata: Metadata = {
  title: "Privacy Policy — Revive ST",
  alternates: {
    canonical: "/privacy",
  },
};

const contactLink = (
  <a href={`mailto:${WEBSITE_CONFIG.CONTACT_EMAIL}`}>
    {WEBSITE_CONFIG.CONTACT_EMAIL}
  </a>
);

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-bg text-fg selection:bg-accent-muted">
      <main className="flex-1 max-w-3xl mx-auto px-6 py-24 w-full">
        <div className="prose max-w-none">
          <h1 className="mb-2">🔒 Privacy Policy</h1>
          <p className="text-fg-tertiary mb-8">Effective as of: 2026-11-01</p>

          <p>
            This policy explains what data Revive ST handles and why. It covers
            the Revive ST mobile app (the &quot;App&quot;), the Revive ST server
            at <code>api.revivest.app</code> (the &quot;Server&quot;) and this
            website. They are operated by <strong>Incognito Labs</strong>{" "}
            (&quot;we&quot;, &quot;us&quot;), which is responsible for the data
            described here.
          </p>
          <p>
            Revive ST has no user accounts: we never ask for your name, email
            address or any other identity. We don&apos;t show ads, sell data or
            track you across other apps and websites.
          </p>

          <h2>On your phone and your home network</h2>
          <p>
            The App finds and controls your speakers directly on your local
            network. Playback, volume, sources and settings never go through our
            Server.
          </p>
          <ul>
            <li>
              <strong>Speaker setup.</strong> To connect a new speaker to your
              Wi-Fi, the App lists nearby Wi-Fi networks and sends the network
              name and password you enter directly to the speaker. Android
              requires the location permission to list Wi-Fi networks; the App
              doesn&apos;t use it to determine your location. The Wi-Fi password
              is never sent to us.
            </li>
            <li>
              <strong>Stored on your phone.</strong> Your household account id
              (see below), the address of the server you chose, your favorite
              radio stations, the country and language you filter stations by
              and the App&apos;s diagnostic logs. These stay on your phone
              unless you choose to share the logs, for example with us when
              reporting a problem. Uninstalling the App deletes them.
            </li>
            <li>
              <strong>Your speakers&apos; servers.</strong> To tell which server
              a speaker uses, the App may send a short request to that server or
              to the speaker itself (for example the STR agent installed on it),
              asking only for its name, version or status. These requests carry
              nothing about you.
            </li>
          </ul>

          <h2>On the Revive ST server</h2>
          <p>
            Since Bose shut down its cloud, your speakers need a server to fetch
            their account, presets and radio stations from when they start up.
            When you set a speaker up for internet radio, the App configures it
            to use ours by default. The Server stores:
          </p>
          <ul>
            <li>
              <strong>A household account id:</strong> a random identifier the
              Server generates the first time you configure a speaker. It
              isn&apos;t linked to your name, email address or phone.
            </li>
            <li>
              <strong>Your speakers&apos; device ids</strong> (each
              speaker&apos;s network hardware address) and the date each one was
              paired with your household account.
            </li>
            <li>
              <strong>Your presets:</strong> for each of the 6 preset buttons,
              the station or content name, its source (such as TuneIn or Radio
              Browser), its address and its artwork address.
            </li>
          </ul>
          <p>
            We use this data only to give your speakers their presets and radio
            stations back. We keep it for as long as your speakers use the
            Server, or until you ask us to delete it.
          </p>
          <p>
            You don&apos;t have to use our Server. You can{" "}
            <a href="/docs/self-hosting">run your own</a> and point the App and
            your speakers to it, or keep a speaker on{" "}
            <a href="/docs/other-servers">another community server</a> such as
            soundcork, AfterTouch or STR. In either case none of the data in
            this section reaches us.
          </p>

          <h2>Logs and diagnostics</h2>
          <p>
            Like any web server, the Server records the requests it receives:
            the requesting IP address, the time and the requested address, which
            can contain your household account id. When a request fails, it also
            records what the speaker or App sent, with the account id masked. We
            use these records only to keep the Server working and secure. Our
            hosting provider deletes them automatically after at most 30 days.
          </p>

          <h2>Third parties</h2>
          <ul>
            <li>
              <strong>Railway</strong> hosts the Server, in its EU West region
              (Amsterdam, Netherlands).
            </li>
            <li>
              <strong>Cloudflare</strong> hosts this website and serves it from
              its global network, which receives the IP address of every
              visitor.
            </li>
            <li>
              <strong>Radio Browser</strong>, a community radio directory,
              receives your searches, the region set on your phone (to list the
              stations popular near you) and the stations you start directly
              from the App, along with your IP address, and counts each start
              towards the station&apos;s popularity. The Server also looks up
              stations there when your speaker plays one.
            </li>
            <li>
              <strong>TuneIn</strong> receives station lookups from the Server
              when a speaker plays a TuneIn preset. These requests come from the
              Server, not from your network.
            </li>
            <li>
              <strong>Radio stations</strong> stream directly to your speakers,
              so the broadcaster sees your home IP address, as with any internet
              radio.
            </li>
            <li>
              <strong>Other SoundTouch servers</strong> (soundcork, AfterTouch,
              STR or one you run) give a speaker that uses them its account,
              presets and stations. They are run by you or by those projects,
              not by us, under their own terms.
            </li>
            <li>
              <strong>Expo</strong>, the platform the App is built with,
              receives an event each time the App starts: a random install
              identifier, the App version, the platform and the operating system
              version. We use it to count active installs and versions.
            </li>
            <li>
              <strong>Fathom Analytics</strong> counts visits to this website
              without cookies and without collecting personal data.
            </li>
            <li>
              <strong>Apple and Google</strong> handle App downloads under their
              own privacy policies.
            </li>
          </ul>

          <h2>Legal basis</h2>
          <p>
            We process the data stored on the Server because it is necessary to
            provide the service you ask for when you configure a speaker to use
            it. We process logs, launch events and website statistics based on
            our legitimate interest in keeping Revive ST working, secure and
            improving.
          </p>

          <h2>Your rights</h2>
          <p>
            Depending on where you live, including under the GDPR, you can ask
            us to access, correct, export or delete your data, and object to its
            processing. Because we don&apos;t know who you are, include your
            household account id in your request: it is shown as{" "}
            <code>margeAccountUUID</code> at{" "}
            <code>http://&lt;speaker-ip&gt;:8090/info</code> in a browser on
            your home network. Send requests to {contactLink}.
          </p>

          <h2>Children</h2>
          <p>
            Revive ST is not directed at children under 16 and collects no data
            that identifies them.
          </p>

          <h2>Security</h2>
          <p>
            The App and your speakers connect to our Server over HTTPS. Your
            household account id is what gives access to your presets: treat it
            as private. If a data breach affects your data, we will notify you
            and the authorities as required by law.
          </p>

          <h2>Changes</h2>
          <p>
            We will post any update to this policy on this page with a new
            effective date. Previous versions are available in the{" "}
            <a href={WEBSITE_CONFIG.GITHUB_URL}>Revive ST repository</a>.
          </p>

          <h2>Contact us</h2>
          <p>Questions about privacy in Revive ST: {contactLink}.</p>
        </div>
      </main>

      <Footer className="mt-auto" />
    </div>
  );
}
