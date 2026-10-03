CREATE TABLE `mobile_push_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`change_id` text NOT NULL,
	`status` text NOT NULL,
	`version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mobile_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`device_id` text NOT NULL,
	`account_tag` text NOT NULL,
	`last_event` integer DEFAULT 0 NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`lock_token` text,
	`expires_at` integer NOT NULL,
	`test_after` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mobile_push_subscriptions_user` ON `mobile_push_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE TRIGGER mobile_push_change_insert AFTER INSERT ON web_changes
WHEN NEW.status <> 'superseded'
BEGIN
 INSERT INTO mobile_push_events (change_id,status,version,created_at)
 VALUES (NEW.id,NEW.status,COALESCE(NEW.decided_at,NEW.created_at),unixepoch()*1000);
END;
--> statement-breakpoint
CREATE TRIGGER mobile_push_change_update AFTER UPDATE ON web_changes
WHEN NEW.status <> 'superseded' AND (NEW.status<>OLD.status OR COALESCE(NEW.decided_at,NEW.created_at)<>COALESCE(OLD.decided_at,OLD.created_at))
BEGIN
 INSERT INTO mobile_push_events (change_id,status,version,created_at)
 VALUES (NEW.id,NEW.status,COALESCE(NEW.decided_at,NEW.created_at),unixepoch()*1000);
END;
