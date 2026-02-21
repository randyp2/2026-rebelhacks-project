"use client";

import { useMemo, useState } from "react";
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
import {
	updateAccountSettings,
	updateHotelSettings,
} from "@/lib/settings/actions";

type SettingsFormsProps = {
	initialHotelName: string;
	membershipRole: string | null;
	hasMembership: boolean;
	initialFullName: string;
	email: string;
};

export default function SettingsForms({
	initialHotelName,
	membershipRole,
	hasMembership,
	initialFullName,
	email,
}: SettingsFormsProps) {
	const [hotelName, setHotelName] = useState(initialHotelName);
	const [fullName, setFullName] = useState(initialFullName);

	const isHotelDirty = useMemo(
		() => hotelName.trim() !== initialHotelName.trim(),
		[hotelName, initialHotelName],
	);
	const isAccountDirty = useMemo(
		() => fullName.trim() !== initialFullName.trim(),
		[fullName, initialFullName],
	);

	return (
		<div className="grid w-full max-w-3xl gap-4">
			<Card className="border-border bg-accent/40 text-foreground">
				<CardHeader>
					<CardTitle>Hotel</CardTitle>
					<CardDescription className="text-muted-foreground">
						Your current property membership details.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<form action={updateHotelSettings} className="space-y-3">
						<div className="rounded-md border border-border bg-accent/40 px-3 py-3">
							<Label htmlFor="hotel_name" className="text-xs text-muted-foreground">
								Hotel Name
							</Label>
							<Input
								id="hotel_name"
								name="hotel_name"
								value={hotelName}
								onChange={(e) => setHotelName(e.target.value)}
								placeholder="Enter hotel name"
								className="mt-2 border-border bg-card text-foreground"
								disabled={!hasMembership}
								required
							/>
						</div>

						<div className="rounded-md border border-border bg-accent/40 px-3 py-3">
							<div className="text-xs text-muted-foreground">Role</div>
							<div className="mt-2 text-sm text-foreground">
								{membershipRole ?? "N/A"}
							</div>
						</div>

						<Button
							type="submit"
							className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
							disabled={!hasMembership || !isHotelDirty}
						>
							Save Hotel Settings
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card className="border-border bg-accent/40 text-foreground">
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<form action={updateAccountSettings} className="space-y-3">
						<div className="rounded-md border border-border bg-accent/40 px-3 py-3">
							<Label htmlFor="full_name" className="text-xs text-muted-foreground">
								Name
							</Label>
							<Input
								id="full_name"
								name="full_name"
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								placeholder="Enter your name"
								className="mt-2 border-border bg-card text-foreground"
								required
							/>
						</div>
						<div className="rounded-md border border-border bg-accent/40 px-3 py-3">
							<Label htmlFor="email" className="text-xs text-muted-foreground">
								Email
							</Label>
							<Input
								id="email"
								value={email}
								className="mt-2 border-border bg-card text-foreground/90"
								readOnly
								disabled
							/>
						</div>

						<Button
							type="submit"
							className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
							disabled={!isAccountDirty}
						>
							Save Account Settings
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
