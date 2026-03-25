-- Fix: renombrar variable 'code' → 'v_code' para evitar ambigüedad con la columna rooms.code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS CHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
  chars   TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  CHAR(6) := '';
  i       INT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE rooms.code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;
