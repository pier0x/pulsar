-- Drop Plaid fields from Account (nullable, safe to drop)
ALTER TABLE "Account" DROP COLUMN IF EXISTS "plaidConnectionId";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "plaidAccountId";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "plaidSubtype";

-- Drop PlaidConnection table
DROP TABLE IF EXISTS "PlaidConnection";
