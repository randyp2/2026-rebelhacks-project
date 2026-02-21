"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/hotels/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SignupRequestRow = {
  id: string;
  requester_user_id: string;
  hotel_name: string;
  status: "pending" | "approved" | "rejected";
};

export async function approveHotelSignupRequest(formData: FormData) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    redirect("/?error=forbidden");
  }

  const requestId = String(formData.get("request-id") ?? "");
  const propertyNameInput = String(formData.get("property-name") ?? "").trim();
  const reviewNotes = String(formData.get("review-notes") ?? "").trim();

  if (!requestId) {
    redirect("/admin/hotel-signup-requests?error=missing_request_id");
  }

  const { data: signupRequest, error: reqError } = await supabaseAdmin
    .from("hotel_signup_requests")
    .select("id, requester_user_id, hotel_name, status")
    .eq("id", requestId)
    .maybeSingle<SignupRequestRow>();

  if (reqError || !signupRequest) {
    redirect("/admin/hotel-signup-requests?error=request_not_found");
  }
  if (signupRequest.status !== "pending") {
    redirect("/admin/hotel-signup-requests?error=request_not_pending");
  }

  const propertyName = propertyNameInput || signupRequest.hotel_name;
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .insert({ name: propertyName })
    .select("id")
    .single<{ id: string }>();

  if (propertyError || !property) {
    redirect("/admin/hotel-signup-requests?error=property_create_failed");
  }

  const { error: membershipError } = await supabaseAdmin.from("property_memberships").insert({
    property_id: property.id,
    user_id: signupRequest.requester_user_id,
    role: "owner",
  });

  if (membershipError) {
    redirect("/admin/hotel-signup-requests?error=membership_create_failed");
  }

  const { error: updateError } = await supabaseAdmin
    .from("hotel_signup_requests")
    .update({
      status: "approved",
      review_notes: reviewNotes || null,
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
      approved_property_id: property.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) {
    redirect("/admin/hotel-signup-requests?error=update_failed");
  }

  revalidatePath("/admin/hotel-signup-requests");
  revalidatePath("/hotel-signup");
  redirect("/admin/hotel-signup-requests?approved=1");
}

export async function rejectHotelSignupRequest(formData: FormData) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    redirect("/?error=forbidden");
  }

  const requestId = String(formData.get("request-id") ?? "");
  const reviewNotes = String(formData.get("review-notes") ?? "").trim();
  if (!requestId) {
    redirect("/admin/hotel-signup-requests?error=missing_request_id");
  }

  const { error } = await supabaseAdmin
    .from("hotel_signup_requests")
    .update({
      status: "rejected",
      review_notes: reviewNotes || null,
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    redirect("/admin/hotel-signup-requests?error=reject_failed");
  }

  revalidatePath("/admin/hotel-signup-requests");
  revalidatePath("/hotel-signup");
  redirect("/admin/hotel-signup-requests?rejected=1");
}

