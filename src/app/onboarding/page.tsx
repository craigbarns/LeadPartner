import { redirect } from "next/navigation";
import { OnboardingWizard } from "./onboarding-wizard";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Onboarding · LeadPartner" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "super_admin") redirect("/super-admin");
  if (session.tenant) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background grain py-12 px-4">
      <div className="max-w-3xl mx-auto relative z-10">
        <OnboardingWizard userEmail={session.user.email} />
      </div>
    </div>
  );
}
