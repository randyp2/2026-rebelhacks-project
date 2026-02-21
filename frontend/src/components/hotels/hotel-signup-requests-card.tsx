import { redirect } from "next/navigation";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { createServerSupabaseClient } from "@/utils/supabase/server";

type SignupRequest = {
	id: string;
	hotel_name: string;
	status: "pending" | "approved" | "rejected";
	review_notes: string | null;
	approved_property_id: string | null;
	created_at: string;
};

function statusClass(status: SignupRequest["status"]) {
	if (status === "approved") return "text-primary";
	if (status === "rejected") return "text-destructive";
	return "text-muted-foreground";
}

export async function HotelSignupRequestsCard() {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (!user || authError) {
		redirect("/");
	}

	const { data: requests } = await supabase
		.from("hotel_signup_requests")
		.select(
			"id, hotel_name, status, review_notes, approved_property_id, created_at",
		)
		.eq("requester_user_id", user.id)
		.order("created_at", { ascending: false })
		.overrideTypes<SignupRequest[], { merge: false }>();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Your Requests</CardTitle>
				<CardDescription>
					Track review status for your submitted hotels.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{(requests ?? []).length === 0 ? (
					<p className="text-sm text-muted-foreground">No requests yet.</p>
				) : null}
				{(requests ?? []).map((request) => (
					<div key={request.id} className="rounded-md border p-3 text-sm">
						<div className="flex items-center justify-between gap-4">
							<div className="font-medium">{request.hotel_name}</div>
							<div
								className={`font-medium capitalize ${statusClass(request.status)}`}
							>
								{request.status}
							</div>
						</div>
						<div className="mt-1 text-muted-foreground">
							Submitted {new Date(request.created_at).toLocaleString()}
						</div>
						{request.approved_property_id ? (
							<div className="mt-1 text-primary">
								Property created: {request.approved_property_id}
							</div>
						) : null}
						{request.review_notes ? (
							<div className="mt-1">Review notes: {request.review_notes}</div>
						) : null}
					</div>
				))}
			</CardContent>
		</Card>
	);
}

