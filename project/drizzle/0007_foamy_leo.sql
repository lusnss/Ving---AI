CREATE TABLE `event_proposal_workflow` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`revision` text NOT NULL,
	`updated_at` text NOT NULL
);
