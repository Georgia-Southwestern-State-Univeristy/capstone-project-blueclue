-- Migration 037: Reset stale/orphaned handoff claims
-- ====================================================
-- Date: 2026-03-06
-- Description:
--   A conversation re-used for a new handoff request retains the
--   handoff_claimed_by value from a prior session.  The pending-queue
--   query filters "AND handoff_claimed_by IS NULL", so those conversations
--   silently disappear from the tech panel.
--
--   This migration clears any stale claim on conversations where a brand-new
--   handoff request has been made *after* the previous claim was stamped.
--   It is safe to run multiple times (rows that already have NULLs are no-ops).
--
--   Going forward, the application now resets these fields itself when
--   requestHandoff() is called and when resolveHandoff() closes the chat.

UPDATE chat_conversations
SET handoff_claimed_by  = NULL,
    handoff_claimed_at  = NULL,
    handoff_resolved_at = NULL,
    ended_at            = NULL
WHERE handoff_requested_at IS NOT NULL          -- a live request exists
  AND handoff_claimed_at   IS NOT NULL          -- but it has a stale claim stamp
  AND handoff_requested_at > handoff_claimed_at -- the new request came AFTER the old claim
  AND ended_at             IS NULL;             -- and the conversation hasn't been cleanly closed
