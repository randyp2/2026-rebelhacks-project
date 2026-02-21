import { Suspense } from "react";

import { AdminHotelSignupRequestsContent } from "@/components/hotels/admin-hotel-signup-requests-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function AdminRequestsFallback() {
  return (
    <>
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminHotelSignupRequestsPage({
	searchParams,
}: {
	searchParams: Promise<{
		status?: string;
		approved?: string;
		rejected?: string;
		error?: string;
	}>;
}) {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Hotel Signup Requests</h1>
			</div>
			<Suspense fallback={<AdminRequestsFallback />}>
				<AdminHotelSignupRequestsContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}
