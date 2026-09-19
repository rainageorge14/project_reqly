import { db } from "@/lib/db";
import { ProjectInput } from "@/lib/validations/project";
import { logAudit } from "./audit";

export async function getUserProjects(userId: string) {
  return db.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          testCases: true,
          testRuns: true,
          securityFindings: true,
          apiSpecs: true,
        },
      },
    },
  });
}

export async function getProjectById(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          testCases: true,
          testRuns: true,
          securityFindings: true,
          apiSpecs: true,
        },
      },
    },
  });

  if (!project) return null;
  // Enforce server-side ownership
  if (project.userId !== userId) return null;

  return project;
}

export async function createProject(userId: string, data: ProjectInput) {
  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      baseUrl: data.baseUrl,
      userId,
    },
  });

  await logAudit({
    userId,
    action: "PROJECT_CREATE",
    metadata: { projectId: project.id, name: project.name },
  });

  return project;
}

export async function updateProject(
  projectId: string,
  userId: string,
  data: ProjectInput
) {
  // Verify ownership first
  const existing = await getProjectById(projectId, userId);
  if (!existing) {
    throw new Error("Project not found or unauthorized");
  }

  const updated = await db.project.update({
    where: { id: projectId },
    data: {
      name: data.name,
      description: data.description ?? null,
      baseUrl: data.baseUrl,
    },
  });

  await logAudit({
    userId,
    action: "PROJECT_UPDATE",
    metadata: { projectId: updated.id, name: updated.name },
  });

  return updated;
}

export async function deleteProject(projectId: string, userId: string) {
  // Verify ownership first
  const existing = await getProjectById(projectId, userId);
  if (!existing) {
    throw new Error("Project not found or unauthorized");
  }

  const deleted = await db.project.delete({
    where: { id: projectId },
  });

  await logAudit({
    userId,
    action: "PROJECT_DELETE",
    metadata: { projectId: deleted.id, name: deleted.name },
  });

  return deleted;
}

export async function getDashboardMetrics(userId: string) {
  const [projects, testRuns, securityFindings] = await Promise.all([
    db.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            testCases: true,
            testRuns: true,
            securityFindings: true,
            apiSpecs: true,
          },
        },
      },
    }),
    db.testRun.findMany({
      where: {
        project: { userId },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    }),
    db.securityFinding.findMany({
      where: {
        project: { userId },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const projectCount = projects.length;
  const totalTestRuns = await db.testRun.count({
    where: { project: { userId } },
  });

  const aggregateTests = await db.testRun.aggregate({
    where: { project: { userId } },
    _sum: {
      totalTests: true,
      passed: true,
      failed: true,
      warnings: true,
    },
  });

  const totalTestsExecuted = aggregateTests._sum.totalTests ?? 0;
  const totalPassed = aggregateTests._sum.passed ?? 0;
  const overallPassRate =
    totalTestsExecuted > 0
      ? Math.round((totalPassed / totalTestsExecuted) * 100)
      : 0;

  return {
    projectCount,
    totalTestRuns,
    totalTestsExecuted,
    overallPassRate,
    projects,
    recentRuns: testRuns,
    recentFindings: securityFindings,
  };
}
