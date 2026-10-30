import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { WEBSITE_CONFIG } from "@/config";

export const metadata: Metadata = {
  title: "Terms and Conditions — Revive ST",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-bg text-fg selection:bg-accent-muted">
      <main className="flex-1 max-w-3xl mx-auto px-6 py-24 w-full">
        <div className="prose max-w-none">
          <h1 className="mb-2">📱 Terms and Conditions</h1>
          <p className="text-fg-tertiary mb-8">Last updated: 2026-10-30</p>

          <p>
            These Terms and Conditions (&quot;Terms&quot;) govern your use of
            the <strong>Revive ST</strong> mobile app (&quot;App&quot;) and the
            Revive ST server (&quot;Server&quot;), provided by{" "}
            <strong>Incognito Labs</strong> (&quot;Developer&quot;). By
            downloading, installing, or using the App or the Server, you agree
            to be bound by these Terms. If you do not agree to these Terms, do
            not use the App or the Server.
          </p>

          <h2>📚 Definitions</h2>
          <ul>
            <li>
              <strong>
                &quot;User,&quot; &quot;you,&quot; or &quot;your&quot;
              </strong>{" "}
              refers to any person who downloads, installs, or uses the App.
            </li>
            <li>
              <strong>&quot;Server&quot;</strong> refers to the server the
              Developer runs at <code>api.revivest.app</code>, which speakers
              and the App use for household accounts, presets and radio
              stations.
            </li>
            <li>
              <strong>&quot;Content&quot;</strong> refers to any text, images,
              video, audio, or other media available through the App.
            </li>
          </ul>

          <h2>🎁 License</h2>
          <p>
            The App&apos;s source code is open source and available under the{" "}
            <a href={`${WEBSITE_CONFIG.GITHUB_URL}/blob/main/LICENSE`}>
              MIT License
            </a>
            . Nothing in these Terms limits the rights that license grants you
            over the source code.
          </p>

          <h2>🔐 User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the App for any unlawful or fraudulent purposes.</li>
            <li>
              Interfere with, disrupt, or overload the App or its underlying
              infrastructure.
            </li>
            <li>
              Attempt to gain unauthorized access to the App or any associated
              systems or networks.
            </li>
          </ul>

          <h2>💾 Intellectual Property Rights</h2>
          <p>
            The source code of the App is licensed under the MIT License. The
            Revive ST name and logo remain the property of the Developer and may
            not be used to identify modified versions of the App without the
            express written permission of the Developer.
          </p>

          <h2>🌐 The Revive ST Server</h2>
          <p>
            The Developer provides the Server free of charge, on a best-effort
            basis, to replace the Bose cloud services your speakers relied on.
            It is not affiliated with, endorsed by or operated on behalf of Bose
            Corporation.
          </p>
          <ul>
            <li>
              The Developer does not guarantee that the Server will be available
              at all times, and may change, limit, suspend or discontinue it.
              The Developer will announce a planned shutdown on this website in
              advance whenever reasonably possible.
            </li>
            <li>
              You may instead{" "}
              <a href="/docs/self-hosting">run your own server</a> and configure
              the App and your speakers to use it. The Developer has no access
              to, and no responsibility for, servers run by others.
            </li>
            <li>
              You may only access the data of your own household. The Developer
              may block traffic that abuses or overloads the Server.
            </li>
            <li>
              Radio stations and other content are provided by third parties
              such as Radio Browser, TuneIn and broadcasters. The Developer is
              not responsible for their availability or content.
            </li>
          </ul>
          <p>
            How the Server handles your data is described in the{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>

          <h2>⚖️ Limitation of Liability</h2>
          <p className="uppercase">
            THE APP AND THE SERVER ARE PROVIDED &quot;AS IS&quot; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, AND NON-INFRINGEMENT. THE DEVELOPER DOES NOT WARRANT THAT
            THE APP OR THE SERVER WILL BE UNINTERRUPTED, ERROR-FREE, OR
            COMPLETELY SECURE.
          </p>
          <p className="uppercase">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE DEVELOPER
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL,
            SPECIAL, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN CONNECTION WITH
            THE USE OF THE APP OR THE SERVER, INCLUDING THE LOSS OF PRESETS OR
            OTHER DATA, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>

          <h2>⚖️ Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of <strong>France</strong>, without regard to its conflict
            of laws principles.
          </p>

          <h2>🔄 Changes to Terms</h2>
          <p>
            The Developer may modify these Terms at any time and will post the
            updated Terms on this page with a new date. Your continued use of
            the App or the Server after a modification constitutes your
            acceptance of the modified Terms.
          </p>

          <h2>📩 Contact Information</h2>
          <p>
            If you have any questions or concerns about these Terms or the App,
            please contact the Developer at{" "}
            <a href={`mailto:${WEBSITE_CONFIG.CONTACT_EMAIL}`}>
              {WEBSITE_CONFIG.CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </main>

      <Footer className="mt-auto" />
    </div>
  );
}
