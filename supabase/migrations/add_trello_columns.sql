-- Add Trello board ID column to divisions table
-- API key and token are stored globally in .env.local
ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS trello_board_id TEXT;

-- Drop unused columns if they exist (from earlier migration)
ALTER TABLE divisions
  DROP COLUMN IF EXISTS trello_api_key,
  DROP COLUMN IF EXISTS trello_token;
