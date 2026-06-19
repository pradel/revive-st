import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions — Revive ST",
};

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-neutral-900 selection:bg-emerald-200">
      <main className="flex-1 max-w-3xl mx-auto px-6 py-24 w-full">
        <div className="prose prose-emerald prose-neutral max-w-none">
          <h1 className="mb-2">📱 Mobile App Terms and Conditions</h1>
          <p className="text-neutral-500 mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <p>
            These Terms and Conditions (&quot;Terms&quot;) govern your use of{" "}
            <strong>Revive ST</strong> (&quot;App&quot;) provided by{" "}
            <strong>Incognito Labs</strong> (&quot;Developer&quot;). By
            downloading, installing, or using the App, you agree to be bound by
            these Terms. If you do not agree to these Terms, do not use the App.
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
              <strong>&quot;Content&quot;</strong> refers to any text, images,
              video, audio, or other media available through the App.
            </li>
          </ul>

          <h2>🎁 License</h2>
          <p>
            Subject to your compliance with these Terms, the Developer grants
            you a limited, non-exclusive, non-transferable, revocable license to
            download, install, and use the App for your personal, non-commercial
            purposes.
          </p>

          <h2>🔐 User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the App for any unlawful or fraudulent purposes.</li>
            <li>
              Copy, modify, adapt, or create derivative works of the App or its
              Content.
            </li>
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
            All rights, title, and interest in and to the App, including its
            Content and any associated intellectual property rights, are the
            exclusive property of the Developer and its licensors. You may not
            reproduce, distribute, or create derivative works of the App or its
            Content without the express written permission of the Developer.
          </p>

          <h2>⚖️ Limitation of Liability</h2>
          <p className="uppercase">
            THE APP IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY
            KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. THE DEVELOPER DOES NOT WARRANT THAT THE APP WILL
            BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
          </p>
          <p className="uppercase">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE DEVELOPER
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL,
            SPECIAL, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN CONNECTION WITH
            THE USE OF THE APP, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
            DAMAGES.
          </p>

          <h2>⚖️ Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of <strong>France</strong>, without regard to its conflict
            of laws principles.
          </p>

          <h2>🔄 Changes to Terms</h2>
          <p>
            The Developer reserves the right to modify these Terms at any time,
            in its sole discretion. Your continued use of the App following any
            modification constitutes your acceptance of the modified Terms.
          </p>

          <h2>📩 Contact Information</h2>
          <p>
            If you have any questions or concerns about these Terms or the App,
            please contact the Developer at{" "}
            <a href="mailto:incognitolabs@gmail.com">incognitolabs@gmail.com</a>
            .
          </p>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-neutral-200 bg-white flex flex-col md:flex-row items-center justify-between text-xs text-neutral-500 gap-4 mt-auto">
        <div className="font-bold text-neutral-900 text-sm">Revive ST</div>
        <p>
          &copy; {new Date().getFullYear()} Revive ST. Not affiliated with Bose
          Corporation.
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
            href="https://github.com/pradel/revive-st"
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
