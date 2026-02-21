"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function requireAdminUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: false as const, reason: "unauthorized" as const };
  }

  const allowed = (process.env.HOTELGUARD_ADMIN_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const email = (data.user.email ?? "").toLowerCase();
  if (allowed.length === 0 || !allowed.includes(email)) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  return {
    ok: true as const,
    user: data.user,
  };
}

