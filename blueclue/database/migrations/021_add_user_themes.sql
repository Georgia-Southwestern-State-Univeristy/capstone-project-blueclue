-- Migration 021: User Theme Preferences
-- Persists user theme/accent/custom colour preferences to the database
-- so settings sync across devices and sessions.

-- Each user gets one row storing all their theme preferences.
CREATE TABLE IF NOT EXISTS user_theme_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'dark',           -- 'dark' | 'light'
    accent VARCHAR(30) NOT NULL DEFAULT 'blue',          -- 'blue' | 'green' | 'purple' | 'highcontrast' | 'custom'
    custom_override BOOLEAN NOT NULL DEFAULT false,      -- full custom colour override toggle
    custom_slots JSONB DEFAULT '{}',                     -- { accent, pageBg, cardBg, sidebarBg, textColor, borderColor }
    saved_themes JSONB DEFAULT '[]',                     -- array of { name, theme, accent, customOverride, customSlots }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_user
    ON user_theme_preferences(user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_theme_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_theme_preferences_timestamp ON user_theme_preferences;
CREATE TRIGGER update_user_theme_preferences_timestamp
    BEFORE UPDATE ON user_theme_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_theme_preferences_timestamp();
