CREATE TABLE `devices` (
	`device_id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`paired_on` integer NOT NULL
);--> statement-breakpoint
-- Speakers fetch their account before anything that pairs them, so speakers
-- already paired are seeded from their presets, in the account a preset was
-- last saved to.
INSERT INTO `devices` (`device_id`, `account_id`, `paired_on`)
SELECT `device_id`, `account_id`, `paired_on` FROM (
	SELECT
		`device_id`,
		`account_id`,
		COALESCE(MIN(`created_on`), 0) AS `paired_on`,
		ROW_NUMBER() OVER (
			PARTITION BY `device_id` ORDER BY MAX(`updated_on`) DESC
		) AS `latest`
	FROM `presets`
	GROUP BY `device_id`, `account_id`
) WHERE `latest` = 1;
