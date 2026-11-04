-- Manual cleanup using the same policy as the scheduled job.
-- Change 30 to the retention window you want; the function validates >= 1.
select prune_user_locations(30) as deleted_rows;
