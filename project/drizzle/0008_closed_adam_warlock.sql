CREATE TABLE `promotion_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `promotion_plans_created_at` ON `promotion_plans` (`created_at`);