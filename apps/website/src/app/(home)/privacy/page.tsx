import type { Metadata } from "next";

import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Revive ST",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-neutral-900 selection:bg-emerald-200">
      <main className="flex-1 max-w-3xl mx-auto px-6 py-24 w-full">
        <div className="prose prose-emerald prose-neutral max-w-none">
          <h1 className="mb-2">🔒 Privacy Policy</h1>
          <p className="text-neutral-500 mb-8">Effective as of: 2026-06-24</p>

          <p>
            This privacy policy applies to the Revive ST app for mobile devices,
            together with any related services operated by Incognito Labs
            (collectively, the &quot;Application&quot;). Incognito Labs is
            hereby referred to as the &quot;Service Provider&quot;.
          </p>

          <h2>
            What information does the Application obtain and how is it used?
          </h2>
          <p>
            The Application does not collect, log, or store any personal
            information when you download and use it. Registration is not
            required. If the Application is used with an active internet
            connection, technical protocol data (such as your ephemeral IP
            address) is transmitted to facilitate network connectivity, but this
            data is not retained or used for tracking.
          </p>

          <h2>
            Does the Application collect precise real time location information
            of the device?
          </h2>
          <p>
            This Application does not collect precise information about the
            location of your mobile device.
          </p>

          <h2>
            Do third parties see and/or have access to information obtained by
            the Application?
          </h2>
          <p>
            Since the Application does not collect any information, no data is
            shared with third parties.
          </p>

          <h2>What are my opt-out rights?</h2>
          <p>
            Since the Application does not collect personal information through
            normal use, uninstalling it simply removes the Application from your
            device.
          </p>
          <p>
            If you contact the Service Provider directly or voluntarily provide
            information by other means, you may request deletion of that
            information by contacting{" "}
            <a href="mailto:incognitolabs@gmail.com">incognitolabs@gmail.com</a>
            .
          </p>

          <h2>Children</h2>
          <p>
            The Application is not intended for children under 16 years of age,
            or such higher age as required by applicable law. The Service
            Provider does not knowingly solicit data from children or market to
            them. Since the Application does not collect personal information
            through normal use, children&apos;s data is not at risk from use of
            the Application alone. If you voluntarily provide personal
            information through other means and are under 16 years of age, your
            parent or guardian must provide consent on your behalf where
            permitted by law.
          </p>

          <h2>Security</h2>
          <p>
            Because the Application does not collect personal data, the risk of
            personal data exposure is minimal. However, no security system is
            completely secure. The Service Provider implements reasonable
            safeguards to protect systems and any data it holds.
          </p>

          <h2>Data Breach Notification</h2>
          <p>
            Since the Application does not collect personal data through normal
            use, the risk of a data breach affecting your personal data is
            minimal. If a breach occurs involving any data you have voluntarily
            provided, the Service Provider will notify you as required by
            applicable law.
          </p>

          <h2>Changes</h2>
          <p>
            The Service Provider may update this Privacy Policy from time to
            time. The Service Provider will notify you of material changes by
            posting the updated Privacy Policy with an effective date. Where
            required by law, the Service Provider will seek your consent to
            material changes before they take effect.
          </p>
          <p>
            Previous versions of this Privacy Policy will be maintained and made
            available upon request by contacting the Service Provider at{" "}
            <a href="mailto:incognitolabs@gmail.com">incognitolabs@gmail.com</a>
            .
          </p>

          <h2>Your Consent</h2>
          <p>
            If you voluntarily provide information to the Service Provider and
            processing is based on consent, you may withdraw that consent at any
            time without affecting processing carried out before withdrawal.
          </p>

          <h2>Contact Us</h2>
          <p>
            If you have any questions regarding privacy while using the
            Application, or have questions about the practices, please contact
            the Service Provider via email at{" "}
            <a href="mailto:incognitolabs@gmail.com">incognitolabs@gmail.com</a>
            .
          </p>

          <hr />
          <p className="text-sm text-neutral-500">
            This privacy policy page was generated by{" "}
            <a
              href="https://app-privacy-policy-generator.nisrulz.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              App Privacy Policy Generator
            </a>
          </p>
        </div>
      </main>

      <Footer className="mt-auto" />
    </div>
  );
}
