import { AccountForm } from "./account-form";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Mon compte · LeadPartner" };

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Mon compte" description="Gérez vos informations personnelles." />
      <AccountForm
        userId={session.user.id}
        email={session.user.email}
        fullName={session.profile.full_name}
      />
    </div>
  );
}
