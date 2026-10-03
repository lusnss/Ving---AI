import { sqliteTable, text, index, integer } from 'drizzle-orm/sqlite-core';
export const workspaceDrafts = sqliteTable('workspace_drafts', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), scope:text('scope').notNull(),
 revision:text('revision').notNull(), updatedAt:text('updated_at').notNull(), payload:text('payload').notNull(),
});
export const workspaceDraftHistory = sqliteTable('workspace_draft_history', {
 revision:text('revision').primaryKey(), owner:text('owner').notNull(), scope:text('scope').notNull(),
 updatedAt:text('updated_at').notNull(), payload:text('payload').notNull(),
},t=>[index('workspace_draft_history_owner_scope').on(t.owner,t.scope,t.updatedAt)]);
export const inventorySnapshots = sqliteTable('inventory_snapshots', {
 source: text('source').primaryKey(),
 payload: text('payload'),
 updatedAt: text('updated_at'),
 lockToken: text('lock_token'),
 lockUntil: integer('lock_until').notNull().default(0),
});
export const eventRequests = sqliteTable('event_requests', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  payload: text('payload').notNull(),
}, table => [index('event_requests_created_at').on(table.createdAt)]);

export const eventProposalDeletions = sqliteTable('event_proposal_deletions', {
  id: text('id').primaryKey(),
  deletedAt: text('deleted_at').notNull(),
});

export const summaryEventDeletions = sqliteTable('summary_event_deletions', {
  id: text('id').primaryKey(),
  deletedAt: text('deleted_at').notNull(),
});

export const eventProposalApprovals = sqliteTable('event_proposal_approvals', {
  id: text('id').primaryKey(),
  trade: text('trade'),
  ceo: text('ceo'),
  updatedAt: text('updated_at').notNull(),
});

export const eventProposalWorkflow = sqliteTable('event_proposal_workflow', {
 id: text('id').primaryKey(),
 status: text('status').notNull(),
 note: text('note').notNull().default(''),
 revision: text('revision').notNull(),
 updatedAt: text('updated_at').notNull(),
});

export const webChanges = sqliteTable('web_changes', {
 id:text('id').primaryKey(), entity:text('entity').notNull(), kind:text('kind').notNull(),
 title:text('title').notNull(), before:text('before_json'), after:text('after_json'),
 status:text('status').notNull().default('pending'), createdAt:text('created_at').notNull(),
 decidedAt:text('decided_at'), decidedBy:text('decided_by'),
},t=>[index('web_changes_status_date').on(t.status,t.createdAt),index('web_changes_entity').on(t.entity)]);
export const contractEdits = sqliteTable('contract_edits', {
 id:text('id').primaryKey(), payload:text('payload').notNull(), revision:text('revision').notNull(),
});
export const notificationReads = sqliteTable('notification_reads', {
 id:text('id').primaryKey(), reader:text('reader').notNull(), changeId:text('change_id').notNull(), version:text('version').notNull(),
},t=>[index('notification_reads_reader').on(t.reader)]);

export const activityWorkspace = sqliteTable('activity_workspace', {
 id:text('id').primaryKey(), payload:text('payload').notNull(), revision:text('revision').notNull(),
});

export const promotionPlans = sqliteTable('promotion_plans', {
 id:text('id').primaryKey(), month:text('month').notNull(), createdAt:text('created_at').notNull(), payload:text('payload').notNull(),
},t=>[index('promotion_plans_created_at').on(t.createdAt)]);

export const mobilePushEvents = sqliteTable('mobile_push_events', {
 seq:integer('seq').primaryKey({autoIncrement:true}),
 changeId:text('change_id').notNull(), status:text('status').notNull(),
 version:text('version').notNull(), createdAt:integer('created_at').notNull(),
});
export const mobilePushSubscriptions = sqliteTable('mobile_push_subscriptions', {
 id:text('id').primaryKey(), endpoint:text('endpoint').notNull(),
 p256dh:text('p256dh').notNull(), auth:text('auth').notNull(),
 userId:text('user_id').notNull(), role:text('role').notNull(), deviceId:text('device_id').notNull(), accountTag:text('account_tag').notNull(),
 lastEvent:integer('last_event').notNull().default(0),
 lockUntil:integer('lock_until').notNull().default(0), lockToken:text('lock_token'),
 expiresAt:integer('expires_at').notNull(), testAfter:integer('test_after').notNull().default(0),
},t=>[index('mobile_push_subscriptions_user').on(t.userId)]);

export const branchProfitSnapshots = sqliteTable('branch_profit_snapshots', {
 period: text('period').primaryKey(),
 payload: text('payload'),
 updatedAt: text('updated_at'),
 lockToken: text('lock_token'),
 lockUntil: integer('lock_until').notNull().default(0),
 lastError: text('last_error'),
});

export const eventStaffAssignments = sqliteTable('event_staff_assignments', {
 id:text('id').primaryKey(), names:text('names').notNull(), revision:text('revision').notNull(), updatedAt:text('updated_at').notNull(),
});
