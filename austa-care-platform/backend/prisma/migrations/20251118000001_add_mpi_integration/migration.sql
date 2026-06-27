-- AlterTable: Add MPI integration fields to users
ALTER TABLE "users" ADD COLUMN "mpiId" TEXT;
ALTER TABLE "users" ADD COLUMN "mpiMatchConfidence" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "mpiMatchMethod" TEXT;
ALTER TABLE "users" ADD COLUMN "mpiResolvedAt" TIMESTAMP(3);

-- CreateIndex: Unique constraint on mpiId
CREATE UNIQUE INDEX "users_mpiId_key" ON "users"("mpiId");

-- CreateIndex: Regular index on mpiId
CREATE INDEX "users_mpiId_idx" ON "users"("mpiId");
