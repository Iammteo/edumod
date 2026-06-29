import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy | Edumod",
  description: "How Edumod collects, uses and protects school data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="June 2026"
      sections={[
        { heading: "Overview", body: "Edumod (operated by Klavoir Technology) provides school management software to schools. This policy explains what information we handle on behalf of the schools that use Edumod, and how we protect it." },
        { heading: "Information we handle", body: "On behalf of a school, Edumod stores the records the school enters - such as student names, admission numbers, classes, staff details, fee invoices and payment records. Account holders also provide login details such as an email address or username." },
        { heading: "How information is used", body: "Information is used solely to provide the service to the school: to authenticate users, display dashboards, manage fees and payments, and keep an audit trail of important actions. We do not sell personal data, and we do not use school data for advertising." },
        { heading: "Data ownership", body: "Each school owns the data it enters into Edumod. School data is kept logically separated between schools, and access is controlled by role-based permissions set by the school's administrators." },
        { heading: "Security", body: "Access to data requires authentication, sensitive actions are logged in an audit trail, and financial actions use maker-checker controls so that the person who records a payment cannot also approve it." },
        { heading: "Data retention and removal", body: "We retain a school's data for as long as the school maintains an active account. A school can request export or deletion of its data by contacting us." },
        { heading: "Contact", body: "For any privacy question or request, contact us through the contact page and we will respond promptly." },
      ]}
    />
  );
}
