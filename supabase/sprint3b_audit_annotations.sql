-- ============================================================================
-- Digital Skyline OS — Sprint 3b: Website Intelligence audit annotations
-- Run ONCE after sprint2_website_intelligence.sql (order vs sprint3 doesn't
-- matter): Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds a single JSONB column to website_audits so the salesperson can record,
-- per audit:
--   talking_point_notes : { "t0": "...", "t1": "..." }  (notes per talking point)
--   consultation_answers: { "q0": "...", "x0": "..." }   (answers per question)
--   extra_questions     : ["...", ...]                   (AI-generated extras)
-- Linked to the audit (and via website_audits.prospect_id to the prospect).
-- Idempotent and additive — never deletes or modifies existing data.
-- ============================================================================

alter table public.website_audits
  add column if not exists annotations jsonb not null default '{}'::jsonb;

-- RLS already enabled on website_audits (Sprint 2): authenticated full access,
-- which covers updates to this column. No policy change needed.
