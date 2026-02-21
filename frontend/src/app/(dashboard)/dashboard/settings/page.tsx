import SettingsForms from "@/components/settings/SettingsForms";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
	const supabase = await createServerSupabaseClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const userFullName =
		(user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null;

	const { data: membership } = await supabase
		.from("property_memberships")
		.select("property_id, role")
		.eq("user_id", user?.id ?? "")
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	const { data: property } = membership
		? await supabase
				.from("properties")
				.select("id, name")
				.eq("id", membership.property_id)
				.maybeSingle()
		: { data: null };

	return (
		<div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto overscroll-contain p-6">
			<SettingsForms
				initialHotelName={property?.name ?? ""}
				membershipRole={membership?.role ?? null}
				hasMembership={Boolean(membership)}
				initialFullName={userFullName ?? ""}
				email={user?.email ?? ""}
			/>
		</div>
	);
}
