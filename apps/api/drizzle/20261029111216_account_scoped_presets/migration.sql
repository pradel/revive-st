-- Presets stored before accounts have no account to belong to: they are dropped.
DROP TABLE `presets`;--> statement-breakpoint
CREATE TABLE `presets` (
	`account_id` text NOT NULL,
	`device_id` text NOT NULL,
	`preset_id` integer NOT NULL,
	`created_on` integer,
	`updated_on` integer,
	`source` text NOT NULL,
	`content_item_type` text NOT NULL,
	`location` text NOT NULL,
	`source_account` text NOT NULL,
	`is_presetable` integer NOT NULL,
	`item_name` text NOT NULL,
	`container_art` text NOT NULL,
	CONSTRAINT `presets_pk` PRIMARY KEY(`account_id`, `device_id`, `preset_id`)
);
