import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitHotelSignupRequest } from "@/lib/hotels/signup-actions";

export async function HotelSignupFormCard({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Property Approval</CardTitle>
        <CardDescription>
          Submit your hotel details. An admin will review and approve provisioning.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {params.submitted ? <p className="mb-4 text-sm text-primary">Request submitted.</p> : null}
        {params.error ? (
          <p className="mb-4 text-sm text-destructive">Could not submit request. Please verify fields and retry.</p>
        ) : null}

        <form action={submitHotelSignupRequest} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hotel-name">Hotel name</Label>
            <Input id="hotel-name" name="hotel-name" placeholder="Enter hotel name" required />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Contact name</Label>
              <Input id="contact-name" name="contact-name" placeholder="Enter name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact email</Label>
              <Input id="contact-email" name="contact-email" type="email" placeholder="Enter email" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pms-vendor">PMS vendor (optional)</Label>
              <Input id="pms-vendor" name="pms-vendor" placeholder="Enter PMS vendor" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="housekeeping-vendor">Housekeeping vendor (optional)</Label>
              <Input id="housekeeping-vendor" name="housekeeping-vendor" placeholder="Enter housekeeping vendor" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Submit Signup Request</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

