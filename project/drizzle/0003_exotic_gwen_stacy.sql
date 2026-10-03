CREATE TABLE `contract_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`reader` text NOT NULL,
	`change_id` text NOT NULL,
	`version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_reads_reader` ON `notification_reads` (`reader`);--> statement-breakpoint
CREATE TABLE `web_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`decided_at` text,
	`decided_by` text
);
--> statement-breakpoint
CREATE INDEX `web_changes_status_date` ON `web_changes` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `web_changes_entity` ON `web_changes` (`entity`);
--> statement-breakpoint
CREATE TRIGGER notify_event_insert AFTER INSERT ON event_requests  BEGIN
 UPDATE web_changes SET status = 'superseded' WHERE entity = 'web:' || NEW.id AND status = 'pending';
 INSERT INTO web_changes (id, entity, kind, title, before_json, after_json, status, created_at)
 VALUES (lower(hex(randomblob(16))), 'web:' || NEW.id, 'proposal_created', 'เสนอพื้นที่ใหม่', NULL, NEW.payload, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER notify_approval_insert AFTER INSERT ON event_proposal_approvals  BEGIN
 UPDATE web_changes SET status = CASE WHEN NEW.trade = 'อนุมัติ' OR NEW.ceo = 'อนุมัติ' THEN 'approved' WHEN NEW.trade = 'ไม่อนุมัติ' OR NEW.ceo = 'ไม่อนุมัติ' THEN 'rejected' ELSE 'pending' END,
 decided_at = NEW.updated_at, decided_by = 'CEO / Trade'
 WHERE entity = NEW.id AND status = 'pending';
 INSERT INTO web_changes (id, entity, kind, title, after_json, status, created_at, decided_at, decided_by)
 SELECT lower(hex(randomblob(16))), NEW.id, 'proposal_decision', 'เปลี่ยนสถานะอนุมัติพื้นที่', json_object('trade',NEW.trade,'ceo',NEW.ceo),
 CASE WHEN NEW.trade = 'อนุมัติ' OR NEW.ceo = 'อนุมัติ' THEN 'approved' WHEN NEW.trade = 'ไม่อนุมัติ' OR NEW.ceo = 'ไม่อนุมัติ' THEN 'rejected' ELSE 'pending' END,
 NEW.updated_at, NEW.updated_at, 'CEO / Trade' WHERE NOT EXISTS (SELECT 1 FROM web_changes WHERE entity=NEW.id AND decided_at=NEW.updated_at);
END;

--> statement-breakpoint
CREATE TRIGGER notify_event_update AFTER UPDATE ON event_requests WHEN OLD.payload <> NEW.payload BEGIN
 UPDATE web_changes SET status = 'superseded' WHERE entity = 'web:' || NEW.id AND status = 'pending';
 INSERT INTO web_changes (id, entity, kind, title, before_json, after_json, status, created_at)
 VALUES (lower(hex(randomblob(16))), 'web:' || NEW.id, 'proposal_updated', 'แก้ไขข้อเสนอพื้นที่', OLD.payload, NEW.payload, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER notify_approval_update AFTER UPDATE ON event_proposal_approvals WHEN OLD.trade IS NOT NEW.trade OR OLD.ceo IS NOT NEW.ceo BEGIN
 UPDATE web_changes SET status = CASE WHEN NEW.trade = 'อนุมัติ' OR NEW.ceo = 'อนุมัติ' THEN 'approved' WHEN NEW.trade = 'ไม่อนุมัติ' OR NEW.ceo = 'ไม่อนุมัติ' THEN 'rejected' ELSE 'pending' END,
 decided_at = NEW.updated_at, decided_by = 'CEO / Trade'
 WHERE entity = NEW.id AND status = 'pending';
 INSERT INTO web_changes (id, entity, kind, title, after_json, status, created_at, decided_at, decided_by)
 SELECT lower(hex(randomblob(16))), NEW.id, 'proposal_decision', 'เปลี่ยนสถานะอนุมัติพื้นที่', json_object('trade',NEW.trade,'ceo',NEW.ceo),
 CASE WHEN NEW.trade = 'อนุมัติ' OR NEW.ceo = 'อนุมัติ' THEN 'approved' WHEN NEW.trade = 'ไม่อนุมัติ' OR NEW.ceo = 'ไม่อนุมัติ' THEN 'rejected' ELSE 'pending' END,
 NEW.updated_at, NEW.updated_at, 'CEO / Trade' WHERE NOT EXISTS (SELECT 1 FROM web_changes WHERE entity=NEW.id AND decided_at=NEW.updated_at);
END;

--> statement-breakpoint
CREATE TRIGGER notify_event_delete AFTER INSERT ON event_proposal_deletions BEGIN
 UPDATE web_changes SET status = 'superseded' WHERE entity = NEW.id AND status = 'pending';
 INSERT INTO web_changes (id, entity, kind, title, status, created_at)
 VALUES (lower(hex(randomblob(16))), NEW.id, 'proposal_deleted', 'ลบข้อเสนอพื้นที่', 'pending', NEW.deleted_at);
END;
