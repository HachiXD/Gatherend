DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(btrim("name")) AS normalized_name
      FROM "Board"
      WHERE NOT "isPrivate"
      GROUP BY lower(btrim("name"))
      HAVING COUNT(*) > 1
    ) duplicate_public_names
  ) THEN
    RAISE EXCEPTION
      'Cannot add unique index for public board names because duplicate public board names already exist.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "board_public_name_unique"
ON "Board" (lower(btrim("name")))
WHERE NOT "isPrivate";
