import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdminUser } from "@/lib/hotels/admin-auth";
import { approveHotelSignupRequest, rejectHotelSignupRequest } from "@/lib/hotels/admin-signup-actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SignupRequest = {
  id: string;
  requester_user_id: string;
  hotel_name: string;
  contact_email: string | null;
  contact_name: string | null;
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

export async function AdminHotelSignupRequestsContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; approved?: string; rejected?: string; error?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    redirect("/");
  }

  const params = await searchParams;
  const statusFilter =
    params.status === "approved" || params.status === "rejected" || params.status === "pending"
      ? params.status
      : "pending";

  let query = supabaseAdmin
    .from("hotel_signup_requests")
    .select("id, requester_user_id, hotel_name, contact_email, contact_name, status, review_notes, approved_property_id, created_at")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: requests } = await query.returns<SignupRequest[]>();

  return (
    <>
      {params.approved ? <p className="text-sm text-primary">Request approved.</p> : null}
      {params.rejected ? <p className="text-sm text-muted-foreground">Request rejected.</p> : null}
      {params.error ? <p className="text-sm text-destructive">Action failed: {params.error}</p> : null}

      <div className="flex gap-2">
        <Button asChild variant={statusFilter === "pending" ? "default" : "outline"}>
          <Link href="/admin/hotel-signup-requests?status=pending">Pending</Link>
        </Button>
        <Button asChild variant={statusFilter === "approved" ? "default" : "outline"}>
          <Link href="/admin/hotel-signup-requests?status=approved">Approved</Link>
        </Button>
        <Button asChild variant={statusFilter === "rejected" ? "default" : "outline"}>
          <Link href="/admin/hotel-signup-requests?status=rejected">Rejected</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Review and approve/reject hotel onboarding requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(requests ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No requests found.</p> : null}
          {(requests ?? []).map((request) => (
            <div key={request.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{request.hotel_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.contact_name ?? "No contact name"} | {request.contact_email ?? "No contact email"}
                  </p>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(request.created_at).toLocaleString()}</p>
                </div>
                <p className={`font-medium capitalize ${statusClass(request.status)}`}>{request.status}</p>
              </div>

              {request.status === "pending" ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <form action={approveHotelSignupRequest} className="space-y-2 rounded border p-3">
                    <input type="hidden" name="request-id" value={request.id} />
                    <Label htmlFor={`property-name-${request.id}`}>Property name override (optional)</Label>
                    <Input id={`property-name-${request.id}`} name="property-name" placeholder={request.hotel_name} />
                    <Label htmlFor={`approve-notes-${request.id}`}>Review notes (optional)</Label>
                    <Input id={`approve-notes-${request.id}`} name="review-notes" placeholder="Approved for provisioning" />
                    <Button type="submit" className="w-full">
                      Approve
                    </Button>
                  </form>

                  <form action={rejectHotelSignupRequest} className="space-y-2 rounded border p-3">
                    <input type="hidden" name="request-id" value={request.id} />
                    <Label htmlFor={`reject-notes-${request.id}`}>Rejection reason</Label>
                    <Input id={`reject-notes-${request.id}`} name="review-notes" placeholder="Insufficient onboarding info" />
                    <Button type="submit" variant="destructive" className="w-full">
                      Reject
                    </Button>
                  </form>
                </div>
              ) : null}

              {request.approved_property_id ? (
                <p className="mt-2 text-sm text-primary">Property created: {request.approved_property_id}</p>
              ) : null}
              {request.review_notes ? <p className="mt-2 text-sm">Review notes: {request.review_notes}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

