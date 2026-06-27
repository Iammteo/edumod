import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of service | Edumod",
  description: "The terms that govern use of the Edumod school management platform.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="June 2026"
      sections={[
        { heading: "Agreement", body: "These terms govern your use of Edumod, a school management platform operated by Klavoir Technology. By creating an account or using the service, you agree to these terms on behalf of your school." },
        { heading: "Accounts", body: "School administrators create the organisation account and may invite staff and create student logins. You are responsible for keeping login credentials secure and for the activity that happens under your school's accounts." },
        { heading: "Acceptable use", body: "You agree to use Edumod only for legitimate school administration. You will not attempt to access another school's data, disrupt the service, or upload unlawful or harmful content." },
        { heading: "Your data", body: "Your school retains ownership of the data it enters. You are responsible for the accuracy of records you create, including student information, fees and payments." },
        { heading: "Financial records", body: "Edumod provides tools to record fees and payments with maker-checker approval and receipts. These are record-keeping tools; Edumod is not a payment processor and does not hold school funds." },
        { heading: "Availability", body: "We work to keep Edumod available and reliable, but the service is provided on an ongoing-improvement basis and may be updated over time. We will give reasonable notice of significant changes." },
        { heading: "Termination", body: "You may stop using Edumod at any time and request your data. We may suspend access where these terms are breached." },
        { heading: "Contact", body: "Questions about these terms can be sent to us through the contact page." },
      ]}
    />
  );
}
