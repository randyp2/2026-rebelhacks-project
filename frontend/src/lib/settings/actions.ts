"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function updateHotelSettings(formData: FormData) {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) redirect("/");

	const hotelName = String(formData.get("hotel_name") ?? "").trim();
	if (hotelName.length < 2) {
		redirect("/dashboard/settings?error=invalid_hotel_name");
	}

	const { data: membership } = await supabase
		.from("property_memberships")
		.select("property_id")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	if (!membership) {
		redirect("/dashboard/settings?error=no_property_membership");
	}

	const { error: updateError } = await supabase
		.from("properties")
		.update({ name: hotelName })
		.eq("id", membership.property_id);

	if (updateError) {
		redirect("/dashboard/settings?error=hotel_update_failed");
	}

	revalidatePath("/dashboard/settings");
	redirect("/dashboard/settings?saved=hotel");
}

export async function updateAccountSettings(formData: FormData) {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) redirect("/");

	const fullName = String(formData.get("full_name") ?? "").trim();
	if (fullName.length < 2) {
		redirect("/dashboard/settings?error=invalid_full_name");
	}

	const { error: authUpdateError } = await supabase.auth.updateUser({
		data: { full_name: fullName },
	});

	if (authUpdateError) {
		redirect("/dashboard/settings?error=account_update_failed");
	}

	const { error: profileUpdateError } = await supabase.from("profiles").upsert({
		id: user.id,
		full_name: fullName,
		email: user.email ?? null,
	});

	if (profileUpdateError) {
		redirect("/dashboard/settings?error=profile_sync_failed");
	}

	revalidatePath("/dashboard", "layout");
	revalidatePath("/dashboard/settings");
	redirect("/dashboard/settings?saved=account");
}
