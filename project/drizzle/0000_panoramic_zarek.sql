CREATE TABLE `event_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_requests_created_at` ON `event_requests` (`created_at`);