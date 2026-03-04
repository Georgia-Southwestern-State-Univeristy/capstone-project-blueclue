-- Migration: Add Feedback Collection, Analytics, and Continuous Improvement System
-- Version: 2.6.0
-- Date: 2026-03-04
-- Description: Adds conversation-level surveys, message-level feedback enrichment,
--              knowledge gap tracking, A/B testing, audit logging, and PII retention policy.

-- ===========================================================================
-- 1. CONVERSATION FEEDBACK (end-of-conversation survey)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS conversation_feedback (
    id                  SERIAL PRIMARY KEY,
    conversation_id     INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating              SMALLINT CHECK (rating BETWEEN 1 AND 5),
    solved              BOOLEAN,
    would_use_again     BOOLEAN,
    nps_score           SMALLINT CHECK (nps_score BETWEEN 0 AND 10),
    -- 'promoter' (9-10) | 'passive' (7-8) | 'detractor' (0-6)
    nps_category        VARCHAR(12) GENERATED ALWAYS AS (
                            CASE
                                WHEN nps_score BETWEEN 9 AND 10 THEN 'promoter'
                                WHEN nps_score BETWEEN 7 AND 8  THEN 'passive'
                                WHEN nps_score BETWEEN 0 AND 6  THEN 'detractor'
                                ELSE NULL
                            END
                        ) STORED,
    feedback_text       TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_feedback_unique
    ON conversation_feedback(conversation_id);  -- one survey per conversation

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_user_id
    ON conversation_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_created_at
    ON conversation_feedback(created_at DESC);

COMMENT ON TABLE conversation_feedback IS
    'End-of-conversation survey: star rating, solved, NPS and free-form text';

-- ===========================================================================
-- 2. MESSAGE-LEVEL FEEDBACK (thumbs down enrichment)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS chat_message_feedback (
    id              SERIAL PRIMARY KEY,
    message_id      INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          VARCHAR(10) NOT NULL CHECK (rating IN ('positive', 'negative')),
    -- Populated only for negative ratings
    failure_reason  VARCHAR(60),   -- 'no_answer' | 'wrong_info' | 'unhelpful_tone' | 'too_slow' | 'other'
    details         TEXT,          -- optional free-text from "Tell us more..."
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_message_feedback_unique
    ON chat_message_feedback(message_id, user_id);  -- one rating per message per user

CREATE INDEX IF NOT EXISTS idx_chat_message_feedback_conversation
    ON chat_message_feedback(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_feedback_rating
    ON chat_message_feedback(rating);

CREATE INDEX IF NOT EXISTS idx_chat_message_feedback_created_at
    ON chat_message_feedback(created_at DESC);

COMMENT ON TABLE chat_message_feedback IS
    'Per-message thumbs up/down with optional failure reason and free text';

-- ===========================================================================
-- 3. KNOWLEDGE GAPS (automatically detected unanswered / low-quality queries)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS chat_knowledge_gaps (
    id                  SERIAL PRIMARY KEY,
    query_text          TEXT NOT NULL,
    -- Normalised lowercase version for deduplication
    query_normalized    TEXT GENERATED ALWAYS AS (LOWER(TRIM(query_text))) STORED,
    occurrence_count    INTEGER DEFAULT 1,
    low_confidence_count INTEGER DEFAULT 0,
    thumbs_down_count   INTEGER DEFAULT 0,
    ticket_created_count INTEGER DEFAULT 0,
    first_seen          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- KB article recommended to address this gap (assigned by content team)
    suggested_article_title TEXT,
    resolved            BOOLEAN DEFAULT FALSE,
    resolved_at         TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_gaps_normalized
    ON chat_knowledge_gaps(query_normalized);

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_occurrence
    ON chat_knowledge_gaps(occurrence_count DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_unresolved
    ON chat_knowledge_gaps(resolved, occurrence_count DESC)
    WHERE resolved = FALSE;

COMMENT ON TABLE chat_knowledge_gaps IS
    'Aggregated unanswered / low-confidence queries used to drive KB improvements';

-- ===========================================================================
-- 4. A/B TEST VARIANTS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS chat_ab_tests (
    id                  SERIAL PRIMARY KEY,
    test_name           VARCHAR(80)  NOT NULL,
    variant             VARCHAR(20)  NOT NULL,    -- e.g. 'control' | 'formal' | 'casual'
    conversation_id     INTEGER REFERENCES chat_conversations(id) ON DELETE SET NULL,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_satisfaction   SMALLINT,   -- 1-5, from survey if available
    resolved            BOOLEAN,
    latency_ms          INTEGER,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_ab_tests_name_variant
    ON chat_ab_tests(test_name, variant);

CREATE INDEX IF NOT EXISTS idx_chat_ab_tests_created_at
    ON chat_ab_tests(created_at DESC);

COMMENT ON TABLE chat_ab_tests IS
    'Records per-conversation A/B test assignments and outcomes for statistical comparison';

-- ===========================================================================
-- 5. CHAT AUDIT LOG (security + compliance)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS chat_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(60) NOT NULL,   -- 'feedback_submitted' | 'survey_submitted' | 'log_accessed' | etc.
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE SET NULL,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    details         JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_log_event_type
    ON chat_audit_log(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_audit_log_user_id
    ON chat_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_audit_log_created_at
    ON chat_audit_log(created_at DESC);

COMMENT ON TABLE chat_audit_log IS
    'Immutable audit trail for compliance — who did what with chat data';

-- ===========================================================================
-- 6. QUALITY MONITORING SNAPSHOTS (weekly automated reports)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS chat_quality_snapshots (
    id                      SERIAL PRIMARY KEY,
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    total_conversations     INTEGER DEFAULT 0,
    thumbs_up_count         INTEGER DEFAULT 0,
    thumbs_down_count       INTEGER DEFAULT 0,
    thumbs_up_rate          NUMERIC(5,2),
    avg_star_rating         NUMERIC(3,2),
    nps_score               NUMERIC(5,2),   -- (promoters% - detractors%)
    solved_rate             NUMERIC(5,2),
    ticket_deflection_rate  NUMERIC(5,2),
    top_knowledge_gaps      JSONB DEFAULT '[]'::jsonb,
    low_rated_intents       JSONB DEFAULT '[]'::jsonb,
    report_generated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    emailed_at              TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_snapshots_period
    ON chat_quality_snapshots(period_start, period_end);

COMMENT ON TABLE chat_quality_snapshots IS
    'Weekly quality metric snapshots generated by the automated analysis job';

-- ===========================================================================
-- 7. DATA RETENTION – helper function (GDPR 90-day purge)
-- ===========================================================================
CREATE OR REPLACE FUNCTION purge_old_chat_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Purge audit log entries older than 90 days
    DELETE FROM chat_audit_log
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Nullify free-text feedback older than 90 days (keep analytics counts)
    UPDATE chat_message_feedback
    SET details = NULL
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND details IS NOT NULL;

    UPDATE conversation_feedback
    SET feedback_text = NULL
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND feedback_text IS NOT NULL;

    -- Delete raw chat messages older than 90 days (keep conversation metadata)
    -- Note: Re-enable only after confirming GDPR requirement with legal team
    -- DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

COMMENT ON FUNCTION purge_old_chat_data() IS
    'GDPR-compliant data retention: redacts PII-containing free text after 90 days';

-- ===========================================================================
-- 8. GDPR RIGHT-TO-DELETION — helper function
-- ===========================================================================
CREATE OR REPLACE FUNCTION delete_user_chat_data(p_user_id INTEGER)
RETURNS TABLE(deleted_conversations INT, deleted_messages INT, deleted_feedback INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_conversations INT;
    v_messages      INT;
    v_feedback      INT;
BEGIN
    -- Nullify free-text in feedback tables (preserve aggregate counts)
    UPDATE conversation_feedback
    SET feedback_text = '[deleted]'
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_feedback = ROW_COUNT;

    UPDATE chat_message_feedback
    SET details = NULL
    WHERE user_id = p_user_id;

    -- Hard-delete message content (keep conversation shell for audit link)
    UPDATE chat_messages
    SET message = '[deleted by user request]'
    WHERE conversation_id IN (
        SELECT id FROM chat_conversations WHERE user_id = p_user_id
    );
    GET DIAGNOSTICS v_messages = ROW_COUNT;

    -- Log the deletion event
    INSERT INTO chat_audit_log (event_type, user_id, details)
    VALUES ('gdpr_deletion', p_user_id, jsonb_build_object('requested_at', NOW()));

    v_conversations := 0;   -- conversations kept as shell records for ticket linkage
    RETURN QUERY SELECT v_conversations, v_messages, v_feedback;
END;
$$;

COMMENT ON FUNCTION delete_user_chat_data(INTEGER) IS
    'GDPR right-to-erasure: redacts personal message content on request';
