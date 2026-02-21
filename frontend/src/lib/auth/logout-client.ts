"use client";

import { createClient } from "@/utils/supabase/client";

export async function signoutClient() {
  const supabase = createClient();

  // Signs out on the browser client — clears both cookies and localStorage
  await supabase.auth.signOut();
}
