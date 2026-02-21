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
			<Card className="border-white/10 bg-black/20 text-slate-100">
				<CardHeader>
					<CardTitle>Hotel</CardTitle>
					<CardDescription className="text-slate-400">
						Your current property membership details.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<form action={updateHotelSettings} className="space-y-3">
						<div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
							<Label htmlFor="hotel_name" className="text-xs text-slate-400">
								Hotel Name
							</Label>
							<Input
								id="hotel_name"
								name="hotel_name"
								value={hotelName}
								onChange={(e) => setHotelName(e.target.value)}
								placeholder="Enter hotel name"
								className="mt-2 border-white/15 bg-[#0f1623] text-slate-100"
								disabled={!hasMembership}
								required
							/>
						</div>

						<div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
							<div className="text-xs text-slate-400">Role</div>
							<div className="mt-2 text-sm text-slate-100">
								{membershipRole ?? "N/A"}
							</div>
						</div>

						<Button
							type="submit"
							className="cursor-pointer bg-blue-600 text-white hover:bg-blue-500"
							disabled={!hasMembership || !isHotelDirty}
						>
							Save Hotel Settings
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card className="border-white/10 bg-black/20 text-slate-100">
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<form action={updateAccountSettings} className="space-y-3">
						<div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
							<Label htmlFor="full_name" className="text-xs text-slate-400">
								Name
							</Label>
							<Input
								id="full_name"
								name="full_name"
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								placeholder="Enter your name"
								className="mt-2 border-white/15 bg-[#0f1623] text-slate-100"
								required
							/>
						</div>
						<div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
							<Label htmlFor="email" className="text-xs text-slate-400">
								Email
							</Label>
							<Input
								id="email"
								value={email}
								className="mt-2 border-white/15 bg-[#0f1623] text-slate-300"
								readOnly
								disabled
							/>
						</div>

						<Button
							type="submit"
							className="cursor-pointer bg-blue-600 text-white hover:bg-blue-500"
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
