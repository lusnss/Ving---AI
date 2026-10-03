# Draft recovery

Editable work is saved separately from business records in D1. Saving an automatic draft does not submit or approve a promotion, activity, contract or Event.

- Drafts are scoped to the authenticated account and page (including the Event edit record ID).
- A database revision check prevents an older tab from silently replacing a newer draft.
- The latest 30 database snapshots remain available from the draft history control.
- A temporary per-tab browser outbox preserves pending saves during outages; it is removed after the database acknowledges the save. The UI distinguishes pending, saved and failed states.
- Before replacing or clearing active work, the UI saves a checkpoint. Unfinished saves also trigger the browser's normal exit warning.
- Promotions retain selected quantities and every price override when refreshing stock, then reconcile availability with the refreshed stock. Confirmation must be checked again after recovery.
- Activities, quantity adjustments, contract edits and Event assumptions have explicit state adapters. General form fields have contextual recovery and never replay submit actions.
- Event images upload to object storage while drafting; unpublished draft images are readable only by the uploading account. Drafts retain image references, not image bytes.

Schema: `workspace_drafts` and `workspace_draft_history`, migration 0010. Runtime code does not create tables or change existing business data.

Validation: backend tests cover account/page isolation, incomplete data, optimistic concurrency, idempotency, bounded history, permissions, request limits and private draft images. Browser checks exercise reload, stock refresh, a fresh browser context, concurrent tabs, an outage, clearing/recovery, and the activity, contract and Event editors.

A pre-existing assertion in `event-request-edit.test.mjs` expects the hidden Event type column in default proposal markup; it also fails in the unchanged source checkout. Draft persistence does not change that view.
