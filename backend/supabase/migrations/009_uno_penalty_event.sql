-- Kept separate so PostgreSQL commits the enum value before the next migration uses it.
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'uno_penalty';
