import { Settings } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings & Guardrails" description="Business goals and the brand rules the agents must respect." />
      <div className="p-5 lg:p-8">
        <EmptyState icon={Settings} title="Settings" description="Goals and guardrails will appear here." />
      </div>
    </>
  );
}
