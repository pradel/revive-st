CREATE TABLE `devices` (
	`account_id` text NOT NULL,
	`device_id` text NOT NULL,
	`paired_on` integer NOT NULL,
	CONSTRAINT `devices_pk` PRIMARY KEY(`account_id`, `device_id`)
);--> statement-breakpoint
-- Speakers fetch their account before anything that pairs them, so speakers
-- already paired are seeded from the accounts that store presets for them.
INSERT INTO `devices` (`account_id`, `device_id`, `paired_on`)
SELECT `account_id`, `device_id`, COALESCE(MIN(`created_on`), 0)
FROM `presets`
GROUP BY `account_id`, `device_id`;
