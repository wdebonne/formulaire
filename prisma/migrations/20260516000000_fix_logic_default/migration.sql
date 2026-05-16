-- Fix incorrect default value for logic field (was {} object, should be [] array)
-- Existing rows with '{}' are also corrected to '[]'
UPDATE "Form" SET "logic" = '[]' WHERE "logic" = '{}';
