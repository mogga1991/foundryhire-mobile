/**
 * SQL to create full-text search indexes for the candidates table.
 *
 * This adds a tsvector column, a trigger to keep it in sync on INSERT/UPDATE,
 * a GIN index for fast full-text search, and initializes existing rows.
 *
 * Run via the admin migration endpoint:
 *   POST /api/admin/run-search-migration
 */

export const SEARCH_INDEX_MIGRATIONS = `
-- Full-text search vector column on candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Generate search vector from key fields
CREATE OR REPLACE FUNCTION candidates_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.current_title, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.current_company, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.headline, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.about, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.resume_text, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.skills, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists before recreating
DROP TRIGGER IF EXISTS candidates_search_vector_trigger ON candidates;

-- Trigger to auto-update search vector on insert or update
CREATE TRIGGER candidates_search_vector_trigger
  BEFORE INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION candidates_search_vector_update();

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_candidates_search ON candidates USING GIN(search_vector);

-- Initialize existing rows (backfill the search_vector for all current data)
UPDATE candidates SET search_vector =
  setweight(to_tsvector('english', COALESCE(first_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(last_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(email, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(current_title, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(current_company, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(headline, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(about, '')), 'D') ||
  setweight(to_tsvector('english', COALESCE(resume_text, '')), 'D') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(skills, ' '), '')), 'B');
`
