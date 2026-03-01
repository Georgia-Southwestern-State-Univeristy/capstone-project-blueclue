-- ============================================================================
-- Migration: 020_update_existing_templates.sql
-- Description: Update existing templates with specific, concise content
-- Version: 2.0.0
-- Created: 2026-02-27
-- Updated: 2026-02-27 - Redesigned templates to be category-specific
-- ============================================================================

-- First, ensure all existing templates have a valid template_category
-- Map common template names to appropriate categories
DO $$
BEGIN
    -- SOFTWARE category templates
    UPDATE ticket_templates
    SET template_category = 'software'::template_category
    WHERE LOWER(name) LIKE ANY(ARRAY['%application%', '%software%', '%program%', '%crash%', '%installation%', '%install%']);
    
    -- HARDWARE category templates
    UPDATE ticket_templates
    SET template_category = 'hardware'::template_category
    WHERE LOWER(name) LIKE ANY(ARRAY['%hardware%', '%printer%', '%laptop%', '%monitor%', '%keyboard%', '%mouse%', '%device%', '%equipment%']);
    
    -- NETWORK category templates
    UPDATE ticket_templates
    SET template_category = 'network'::template_category
    WHERE LOWER(name) LIKE ANY(ARRAY['%network%', '%internet%', '%connection%', '%wifi%', '%vpn%', '%connectivity%']);
    
    -- ACCESS category templates
    UPDATE ticket_templates
    SET template_category = 'access'::template_category
    WHERE LOWER(name) LIKE ANY(ARRAY['%password%', '%reset%', '%access request%', '%permission%']);
    
    -- ACCOUNT category templates
    UPDATE ticket_templates
    SET template_category = 'account'::template_category
    WHERE LOWER(name) LIKE ANY(ARRAY['%account locked%', '%locked out%', '%new user%', '%onboard%']);
    
    -- Set remaining NULL categories to GENERAL
    UPDATE ticket_templates
    SET template_category = 'general'::template_category
    WHERE template_category IS NULL;
END$$;

-- ============================================================================
-- HARDWARE TEMPLATES
-- ============================================================================

-- Laptop Not Turning On
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Laptop Not Turning On',
    pre_filled_description = E'**What''s happening:**\n[Describe what happens when you press the power button]\n\n**Power source:**\n- [ ] Plugged into wall outlet\n- [ ] Using battery only\n- [ ] Tried both, same issue\n\n**LED lights:**\n- Power LED: [On / Off / Blinking]\n- Battery LED: [On / Off / Blinking / N/A]\n\n**What I''ve tried:**\n- [ ] Held power button for 30 seconds\n- [ ] Checked power cable connections\n- [ ] Tried different outlet\n\n**Asset tag or serial number:**\n[Located on bottom of laptop]\n\n**Location:**\n[Building/Room where device is located]'
WHERE LOWER(name) = 'laptop not turning on';

-- Printer Offline
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Printer Offline - [Printer Name/Location]',
    pre_filled_description = E'**Printer name:**\n[From your print dialog or label on printer]\n\n**Printer location:**\n[Building/Floor/Room]\n\n**Issue:**\n- [ ] Shows as "Offline" when trying to print\n- [ ] Print jobs stuck in queue\n- [ ] Printer not appearing in list\n- [ ] Other: [Describe]\n\n**Display on printer:**\n- [ ] Shows "Ready"\n- [ ] Shows error message: [Enter message]\n- [ ] Blank screen\n- [ ] Other: [Describe]\n\n**Affects:**\n- [ ] Just me\n- [ ] Multiple people in my area\n\n**When needed:**\n[Immediately / Today / This week]'
WHERE LOWER(name) = 'printer offline';

-- Monitor Display Issues
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Monitor Display Issue',
    pre_filled_description = E'**Problem:**\n- [ ] No display / black screen\n- [ ] Flickering or flashing\n- [ ] Lines or artifacts on screen\n- [ ] Wrong resolution / blurry\n- [ ] Colors look wrong\n- [ ] Other: [Describe]\n\n**Monitor status:**\n- Power LED: [On / Off / Blinking]\n- Cable connections: [Checked and secure / Not checked]\n\n**Number of monitors:**\n[1 / 2 / 3] monitor(s) - [All affected / Only one affected]\n\n**What I''ve tried:**\n- [ ] Checked cable connections\n- [ ] Power cycled monitor\n- [ ] Restarted computer\n- [ ] Tried different input source\n\n**Computer location:**\n[Building/Room]'
WHERE LOWER(name) = 'monitor display issues';

-- ============================================================================
-- SOFTWARE TEMPLATES
-- ============================================================================

-- Application Crash
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Application Crash - [Application Name]',
    pre_filled_description = E'**Application:**\n[Name and version if known]\n\n**When it crashes:**\n- [ ] On startup\n- [ ] When doing [specific action]\n- [ ] Randomly during use\n- [ ] Other: [Describe]\n\n**Error message:**\n[Copy exact error text or "No error shown"]\n\n**How to reproduce:**\n1. [First step]\n2. [Second step]\n3. [Crash occurs]\n\n**Frequency:**\n- [ ] Every time\n- [ ] Sometimes\n- [ ] Started happening: [Date/time]\n\n**Work impact:**\n- [ ] Blocking my work\n- [ ] Can work around it\n- [ ] Minor inconvenience'
WHERE LOWER(name) = 'application crash';

-- Software Installation Request
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Software Installation - [Software Name]',
    pre_filled_description = E'**Software requested:**\n[Name and version if specific]\n\n**Vendor/Publisher:**\n[Company name]\n\n**Why needed:**\n[Brief business justification]\n\n**Department:**\n[Your department]\n\n**License status:**\n- [ ] Already purchased - License key: [Enter]\n- [ ] Need to purchase - Approver: [Manager name]\n- [ ] Free/Open source\n- [ ] Don''t know\n\n**Installation target:**\n- [ ] My computer only\n- [ ] My computer - Computer name: [Enter]\n- [ ] Multiple users - List: [Names]\n\n**Needed by:**\n[Date or "No specific deadline"]'
WHERE LOWER(name) = 'software installation request';

-- ============================================================================
-- GENERAL TEMPLATES
-- ============================================================================

-- Performance Issues
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Performance Issue - [Computer/Application]',
    pre_filled_description = E'**What''s slow:**\n- [ ] Entire computer\n- [ ] Specific application: [Name]\n- [ ] Internet/network\n- [ ] Other: [Describe]\n\n**How slow:**\n- [ ] Slightly slower than normal\n- [ ] Very slow, usable with patience\n- [ ] Freezing or unresponsive\n\n**Started:**\n[Date/time or "Gradually getting worse"]\n\n**Happens:**\n- [ ] Always\n- [ ] Mostly in morning/afternoon\n- [ ] When [specific action]\n\n**What I''ve tried:**\n- [ ] Restarted computer\n- [ ] Closed unused programs\n- [ ] Nothing yet\n\n**Computer name:**\n[If known]'
WHERE LOWER(name) LIKE '%performance%';

-- General Inquiry
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Question - [Brief Topic]',
    pre_filled_description = E'**Question:**\n[Describe what you need help with]\n\n**Context:**\n[What you''re trying to accomplish]\n\n**Related to:**\n- [ ] Hardware\n- [ ] Software application: [Name]\n- [ ] Account or permissions\n- [ ] Network/connectivity\n- [ ] Other: [Describe]'
WHERE LOWER(name) = 'general inquiry';

-- Feature Request
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Feature Request - [Brief Description]',
    pre_filled_description = E'**Requested feature:**\n[What capability or improvement you''d like]\n\n**Current process:**\n[How you do this now]\n\n**Benefit:**\n[How this would improve work]\n\n**Applies to:**\n- [ ] Ticket system\n- [ ] Specific application: [Name]\n- [ ] Process or workflow\n- [ ] Other: [Describe]\n\n**Priority:**\n- [ ] Would significantly improve efficiency\n- [ ] Nice to have\n- [ ] Low priority suggestion'
WHERE LOWER(name) = 'feature request';

-- ============================================================================
-- NETWORK TEMPLATES
-- ============================================================================

-- No Internet Connection
UPDATE ticket_templates
SET 
    pre_filled_subject = 'No Internet Connection',
    pre_filled_description = E'**Connection type:**\n- [ ] Wired (Ethernet cable)\n- [ ] Wireless (WiFi)\n\n**What''s affected:**\n- [ ] Internet only (can access internal sites)\n- [ ] Everything (internal and external)\n- [ ] Specific sites only: [List]\n\n**Network icon shows:**\n- [ ] No connection\n- [ ] Limited connectivity\n- [ ] Connected but no internet\n- [ ] Other: [Describe]\n\n**Others affected:**\n- [ ] Just me\n- [ ] My whole area\n- [ ] Don''t know\n\n**Started:**\n[Time and date or "Just now"]\n\n**Location:**\n[Building/Floor/Room]\n\n**What I''ve tried:**\n- [ ] Restarted computer\n- [ ] Checked cable connections\n- [ ] Turned WiFi off and on\n- [ ] Nothing yet'
WHERE LOWER(name) LIKE '%internet connection%' OR LOWER(name) = 'no internet connection';

-- WiFi Connection Drops
UPDATE ticket_templates
SET 
    pre_filled_subject = 'WiFi Drops Frequently',
    pre_filled_description = E'**Pattern:**\n- [ ] Disconnects every few minutes\n- [ ] Stays connected but internet stops\n- [ ] Connects then drops immediately\n- [ ] Other: [Describe]\n\n**Started:**\n[Date or "Has been ongoing"]\n\n**Happens:**\n- [ ] All day\n- [ ] Specific times: [When]\n- [ ] Certain locations: [Where]\n- [ ] Random\n\n**WiFi network:**\n[Network name you''re connecting to]\n\n**Also affects:**\n- [ ] Just my device\n- [ ] Others report same issue\n- [ ] Don''t know\n\n**Current location:**\n[Building/Floor/Room]\n\n**Device type:**\n- [ ] Laptop\n- [ ] Desktop with WiFi adapter\n- [ ] Other: [Describe]'
WHERE LOWER(name) LIKE '%wifi%';

-- VPN Connection Problems
UPDATE ticket_templates
SET 
    pre_filled_subject = 'VPN Connection Issue',
    pre_filled_description = E'**Problem:**\n- [ ] Can''t connect to VPN\n- [ ] VPN connects but can''t access resources\n- [ ] VPN disconnects frequently\n- [ ] VPN very slow\n- [ ] Other: [Describe]\n\n**Error message:**\n[Copy exact error or "No error"]\n\n**VPN client:**\n[Name/type if known]\n\n**Connecting from:**\n- [ ] Home\n- [ ] Remote location\n- [ ] On-site\n- [ ] Other: [Where]\n\n**What I can''t access:**\n- [ ] Everything\n- [ ] Specific systems: [List]\n\n**Last successful connection:**\n[Date/time or "Never worked"]\n\n**What I''ve tried:**\n- [ ] Restarted VPN client\n- [ ] Restarted computer\n- [ ] Checked internet connection\n- [ ] Nothing yet'
WHERE LOWER(name) LIKE '%vpn%';

-- ============================================================================
-- ACCESS TEMPLATES
-- ============================================================================

-- Password Reset Request
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Password Reset Request',
    pre_filled_description = E'**System/Application:**\n- [ ] Windows/Network login\n- [ ] Specific application: [Name]\n- [ ] Email\n- [ ] Other: [Specify]\n\n**Reason:**\n- [ ] Forgot password\n- [ ] Account locked after wrong attempts\n- [ ] Expired password\n- [ ] Security concern\n- [ ] Other: [Describe]\n\n**Identity verification:**\n[We will verify your identity before resetting]\n\n**Preferred contact:**\n- [ ] Call me: [Phone number]\n- [ ] Can come to IT office\n- [ ] Email me instructions\n\n**Urgency:**\n- [ ] Blocking my work\n- [ ] Can work on other tasks\n- [ ] Not urgent'
WHERE LOWER(name) LIKE '%password%reset%';

-- Access Request
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Access Request - [System/Resource]',
    pre_filled_description = E'**Requesting access to:**\n[System, application, folder, or resource]\n\n**Type of access needed:**\n- [ ] Read-only\n- [ ] Read and write\n- [ ] Full access\n- [ ] Same access as: [Coworker name]\n\n**Business justification:**\n[Why you need this access]\n\n**Duration:**\n- [ ] Permanent (part of my job)\n- [ ] Temporary - Until: [Date]\n- [ ] One-time access\n\n**Manager approval:**\n- Manager name: [Name]\n- Already approved: [Yes / Requesting now]\n\n**Needed by:**\n[Date or "As soon as possible"]'
WHERE LOWER(name) LIKE '%access request%' AND LOWER(name) NOT LIKE '%password%';

-- ============================================================================
-- ACCOUNT TEMPLATES
-- ============================================================================

-- Account Locked
UPDATE ticket_templates
SET 
    pre_filled_subject = 'Account Locked Out',
    pre_filled_description = E'**Account locked for:**\n- [ ] Windows/Network login\n- [ ] Email\n- [ ] Specific application: [Name]\n- [ ] Other: [Specify]\n\n**Locked out since:**\n[Time]\n\n**Message shown:**\n[Exact error message]\n\n**Identity verification:**\n[We will verify your identity before unlocking]\n\n**Contact preference:**\n- [ ] Call me: [Phone number]\n- [ ] Can come to IT office\n\n**Urgency:**\n- [ ] Cannot work\n- [ ] Blocking critical task\n- [ ] Can do other work'
WHERE LOWER(name) LIKE '%account%locked%' OR LOWER(name) LIKE '%locked%out%';

COMMENT ON COLUMN ticket_templates.pre_filled_subject IS 'Pre-filled ticket subject/title with placeholder support';
COMMENT ON COLUMN ticket_templates.pre_filled_description IS 'Pre-filled ticket description with placeholder support (supports {{user_name}}, {{user_email}}, etc.)';
COMMENT ON COLUMN ticket_templates.template_category IS 'Template category for organization (hardware, software, access, network, account, general, other)';

