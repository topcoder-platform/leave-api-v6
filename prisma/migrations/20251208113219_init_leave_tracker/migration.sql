-- Create nanoid function for generating 14-character IDs
-- Requires pgcrypto extension to be installed by a privileged role for gen_random_bytes support
CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 14)
RETURNS text AS $$
DECLARE
  id text := '';
  i int := 0;
  urlAlphabet char(64) := 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
  bytes bytea := gen_random_bytes(size);
  byte int;
  pos int;
BEGIN
  WHILE i < size LOOP
    byte := get_byte(bytes, i);
    pos := (byte & 63) + 1;
    id := id || substr(urlAlphabet, pos, 1);
    i = i + 1;
  END LOOP;
  RETURN id;
END
$$ LANGUAGE PLPGSQL STABLE;

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('AVAILABLE', 'LEAVE', 'WIPRO_HOLIDAY', 'WEEKEND');

-- CreateTable
CREATE TABLE "wipro_holidays" (
    "id" VARCHAR(14) NOT NULL DEFAULT nanoid(),
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "wipro_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_leave_dates" (
    "id" VARCHAR(14) NOT NULL DEFAULT nanoid(),
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "LeaveStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "user_leave_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wipro_holidays_date_idx" ON "wipro_holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "wipro_holidays_date_key" ON "wipro_holidays"("date");

-- CreateIndex
CREATE INDEX "user_leave_dates_userId_idx" ON "user_leave_dates"("userId");

-- CreateIndex
CREATE INDEX "user_leave_dates_date_idx" ON "user_leave_dates"("date");

-- CreateIndex
CREATE INDEX "user_leave_dates_userId_date_idx" ON "user_leave_dates"("userId", "date");

-- CreateIndex
CREATE INDEX "user_leave_dates_status_idx" ON "user_leave_dates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_leave_dates_userId_date_key" ON "user_leave_dates"("userId", "date");
