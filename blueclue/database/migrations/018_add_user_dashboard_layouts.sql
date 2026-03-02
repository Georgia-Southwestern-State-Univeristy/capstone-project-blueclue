-- Migration 018: User Dashboard Layouts
-- Persists dashboard widget layouts per user so they sync across devices/sessions.
-- Stores both the active (auto-saved) layout and named saved layouts.

-- Active layout: one row per user+dashboard_type (e.g. 'management', 'technician')
CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dashboard_type VARCHAR(50) NOT NULL DEFAULT 'management',
    layout_data JSONB NOT NULL,           -- { lg: [...], md: [...], ... }
    hidden_widgets JSONB DEFAULT '[]',    -- array of hidden widget keys
    layout_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, dashboard_type)
);

-- Named saved layouts: users can save multiple named snapshots
CREATE TABLE IF NOT EXISTS user_saved_layouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dashboard_type VARCHAR(50) NOT NULL DEFAULT 'management',
    name VARCHAR(100) NOT NULL,
    layout_data JSONB NOT NULL,
    hidden_widgets JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_dashboard_layouts_user
    ON user_dashboard_layouts(user_id, dashboard_type);

CREATE INDEX IF NOT EXISTS idx_user_saved_layouts_user
    ON user_saved_layouts(user_id, dashboard_type);

-- Trigger: auto-update updated_at on user_dashboard_layouts
CREATE OR REPLACE FUNCTION update_dashboard_layout_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_dashboard_layouts_timestamp ON user_dashboard_layouts;
CREATE TRIGGER update_user_dashboard_layouts_timestamp
    BEFORE UPDATE ON user_dashboard_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_layout_timestamp();

DROP TRIGGER IF EXISTS update_user_saved_layouts_timestamp ON user_saved_layouts;
CREATE TRIGGER update_user_saved_layouts_timestamp
    BEFORE UPDATE ON user_saved_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_layout_timestamp();
