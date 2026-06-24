CREATE TABLE `presets` (
	`device_id` text NOT NULL,
	`preset_id` integer NOT NULL,
	`created_on` integer,
	`updated_on` integer,
	`source` text NOT NULL,
	`location` text NOT NULL,
	`source_account` text NOT NULL,
	`is_presetable` integer NOT NULL,
	`item_name` text NOT NULL,
	PRIMARY KEY(`device_id`, `preset_id`)
);
