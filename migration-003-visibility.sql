-- Article visibility: public / private.
-- The site adds these columns by itself on first run (config.php);
-- this file is only for running by hand on an old database.

ALTER TABLE submissions
    ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'public' AFTER status,
    ADD COLUMN visibility_by VARCHAR(150) NULL AFTER visibility,
    ADD COLUMN visibility_at DATETIME NULL AFTER visibility_by;
