CREATE TABLE `branch_profit_snapshots` (
	`period` text PRIMARY KEY NOT NULL,
	`payload` text,
	`updated_at` text,
	`lock_token` text,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
