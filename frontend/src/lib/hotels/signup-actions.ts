"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function submitHotelSignupRequest(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/");
  }

  const hotelName = String(formData.get("hotel-name") ?? "").trim();
  const contactName = String(formData.get("contact-name") ?? "").trim();
  const contactEmail = String(formData.get("contact-email") ?? "").trim();
  const pmsVendor = String(formData.get("pms-vendor") ?? "").trim();
  const housekeepingVendor = String(formData.get("housekeeping-vendor") ?? "").trim();

  if (hotelName.length < 2) {
    redirect("/hotel-signup?error=invalid_hotel_name");
  }

  const requestedConnectors: Array<{ system: "pms" | "housekeeping"; vendor: string }> = [];
  if (pmsVendor) {
    requestedConnectors.push({ system: "pms", vendor: pmsVendor });
  }
  if (housekeepingVendor) {
    requestedConnectors.push({ system: "housekeeping", vendor: housekeepingVendor });
  }

  const { error } = await supabase.from("hotel_signup_requests").insert({
    requester_user_id: authData.user.id,
    hotel_name: hotelName,
    contact_name: contactName || null,
    contact_email: contactEmail || authData.user.email || null,
    requested_connectors: requestedConnectors,
    status: "pending",
  });

  if (error) {
    redirect("/hotel-signup?error=submit_failed");
  }

  revalidatePath("/hotel-signup");
  redirect("/hotel-signup?submitted=1");
}
