-- Migration: add profile_id to vitals table for family profile support
-- Run this in the Supabase SQL editor or via supabase db push

ALTER TABLE vitals
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES family_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS vitals_profile_id_idx ON vitals(profile_id);
