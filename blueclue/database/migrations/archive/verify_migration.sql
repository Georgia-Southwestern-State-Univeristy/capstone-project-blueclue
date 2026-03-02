# Run verification script
psql -U postgres -d blueclue -f verify_migration.sql-- ============================================================================
-- Migration Verification Script
-- ============================================================================
-- Run this to verify that migration 001 was successfully applied

\echo '========================================'
\echo 'Verifying Migration 001...'
\echo '========================================'

-- Check schema version
\echo ''
\echo 'Schema Version:'
SELECT version, applied_at, description 
FROM schema_version 
ORDER BY applied_at DESC 
LIMIT 1;

-- Check if ticket_comments table exists
\echo ''
\echo 'Checking ticket_comments table...'
SELECT 
    COUNT(*) as comment_count,
    CASE WHEN COUNT(*) >= 0 THEN '✓ Table exists' ELSE '✗ Table missing' END as status
FROM ticket_comments;

-- Check if ticket_templates table exists
\echo ''
\echo 'Checking ticket_templates table...'
SELECT 
    COUNT(*) as template_count,
    CASE WHEN COUNT(*) >= 0 THEN '✓ Table exists' ELSE '✗ Table missing' END as status
FROM ticket_templates;

-- Check ticket_assignments structure
\echo ''
\echo 'Checking ticket_assignments structure...'
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'ticket_assignments' 
ORDER BY ordinal_position;

-- Check tickets table for new columns
\echo ''
\echo 'Checking tickets table for new reopen columns...'
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tickets' 
  AND column_name IN ('reopen_count', 'last_reopened_at')
ORDER BY ordinal_position;

-- Check ticket_status enum values
\echo ''
\echo 'Checking ticket_status enum values...'
SELECT unnest(enum_range(NULL::ticket_status)) as status_value;

-- Check views exist
\echo ''
\echo 'Checking if views were recreated...'
SELECT 
    table_name as view_name,
    CASE WHEN table_type = 'VIEW' THEN '✓ Exists' ELSE '✗ Missing' END as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'VIEW'
  AND table_name IN ('active_tickets_view', 'technician_workload_view', 'category_statistics_view')
ORDER BY table_name;

\echo ''
\echo '========================================'
\echo 'Verification Complete!'
\echo '========================================'
\echo ''
\echo 'Expected Results:'
\echo '  - Schema version: 2.0.0'
\echo '  - ticket_comments and ticket_templates tables exist'
\echo '  - ticket_assignments has ''user_id'' and ''role'' columns'
\echo '  - tickets has ''reopen_count'' and ''last_reopened_at'' columns'
\echo '  - ticket_status enum includes ''cancelled'' and ''reopened'''
\echo '  - All 3 views recreated'
\echo ''
