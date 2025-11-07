-- CreateTable
CREATE TABLE "demo_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "domain" TEXT,
    "brand" TEXT,
    "summary" TEXT,
    "competitors" TEXT[],
    "analysisJobsTotal" INTEGER,
    "analysisJobsCompleted" INTEGER,
    "analysisJobsFailed" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_runs_workspaceId_status_idx" ON "demo_runs"("workspaceId", "status");

