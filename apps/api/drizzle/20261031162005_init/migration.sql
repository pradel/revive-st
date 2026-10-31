CREATE TABLE `device_contacts` (
	`device_id` text PRIMARY KEY,
	`last_contact_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`account_id` text NOT NULL,
	`device_id` text NOT NULL,
	`paired_on` integer NOT NULL,
	CONSTRAINT `devices_pk` PRIMARY KEY(`account_id`, `device_id`)
);
--> statement-breakpoint
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
