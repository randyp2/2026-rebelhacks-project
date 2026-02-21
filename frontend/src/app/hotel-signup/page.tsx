import { Suspense } from "react";

import { HotelSignupFormCard } from "@/components/hotels/hotel-signup-form-card";
import { HotelSignupRequestsCard } from "@/components/hotels/hotel-signup-requests-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function HotelSignupFormFallback() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Request Property Approval</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
				<div className="h-10 w-full animate-pulse rounded bg-muted" />
				<div className="h-10 w-full animate-pulse rounded bg-muted" />
				<div className="h-10 w-full animate-pulse rounded bg-muted" />
			</CardContent>
		</Card>
	);
}

function HotelSignupRequestsFallback() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Your Requests</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="h-14 w-full animate-pulse rounded bg-muted" />
				<div className="h-14 w-full animate-pulse rounded bg-muted" />
			</CardContent>
		</Card>
	);
}

export default function HotelSignupPage({
	searchParams,
}: {
	searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Hotel Signup</h1>
			</div>

			<Suspense fallback={<HotelSignupFormFallback />}>
				<HotelSignupFormCard searchParams={searchParams} />
			</Suspense>

			<Suspense fallback={<HotelSignupRequestsFallback />}>
				<HotelSignupRequestsCard />
			</Suspense>
		</div>
	);
}
