import { UltraQualityPersonsDataTable } from "@/components/ui/ultra-quality-persons-data-table";
import { getPersonsWithRisk } from "@/lib/supabase/queries";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export default async function PersonsPage() {
	const supabase = await createServerSupabaseClient();
	const persons = await getPersonsWithRisk(supabase).catch(() => []);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
			<h1 className="mb-4 text-2xl font-bold">Persons</h1>
			<UltraQualityPersonsDataTable persons={persons} />
		</div>
	);
}
