import { redirect } from "next/navigation";
import PreferencesSettings from "@/components/preferences-settings";
import { shouldAllowDashboard } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!shouldAllowDashboard(Boolean(data?.claims?.sub))) redirect("/?auth=required");
  return <PreferencesSettings />;
}
