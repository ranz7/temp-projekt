DROP INDEX "account__user__username__unique_idx_";--> statement-breakpoint
CREATE UNIQUE INDEX "account__user__username_lower__unique_idx_" ON "account__user_" USING btree (lower("username_"));