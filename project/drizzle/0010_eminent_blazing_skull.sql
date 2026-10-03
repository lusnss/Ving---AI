CREATE TABLE `workspace_draft_history` (
	`revision` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`scope` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_draft_history_owner_scope` ON `workspace_draft_history` (`owner`,`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `workspace_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`scope` text NOT NULL,
	`revision` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);
