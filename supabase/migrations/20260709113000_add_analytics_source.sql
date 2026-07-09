/*
# Add visitor source to analytics events

Stores the classified visitor source alongside the raw referrer and metadata so
the CMS can chart direct, search, social, campaign, and referral traffic.
*/

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS source text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_analytics_source ON analytics_events(source);

UPDATE analytics_events
SET source = COALESCE(NULLIF(metadata->>'source', ''), source, '')
WHERE source IS NULL OR source = '';
