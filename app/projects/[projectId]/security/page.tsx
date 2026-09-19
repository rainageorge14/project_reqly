import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProjectSecurityOverview } from "@/lib/services/security";
import { SecurityClient } from "@/components/security-client";

interface SecurityPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSecurityPage({ params }: SecurityPageProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const overview = await getProjectSecurityOverview(projectId, user.id);
  if (!overview) {
    notFound();
  }

  return <SecurityClient projectId={projectId} initialData={overview} />;
}
