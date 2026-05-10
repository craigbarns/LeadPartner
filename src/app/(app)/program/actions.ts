"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function createProgram(formData: FormData): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Nom requis." };

  const session = await requireRole(["company_admin"]);
  if (!session.tenant) return { ok: false, error: "Session invalide." };

  const supabase = await createClient();
  const baseSlug = slugify(name) || "programme";

  for (let i = 0; i < 30; i++) {
    const slug = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const { data, error } = await supabase
      .from("programs")
      .insert({
        tenant_id: session.tenant.id,
        name,
        slug,
        description: null,
        terms: null,
        public_signup_enabled: false,
      })
      .select("id")
      .single();

    if (!error && data) {
      revalidatePath("/program");
      revalidatePath("/settings/commissions");
      return { ok: true, id: data.id };
    }
    if (error?.code !== "23505") {
      return { ok: false, error: error?.message ?? "Création impossible." };
    }
  }

  return { ok: false, error: "Identifiant URL du programme déjà utilisé." };
}
