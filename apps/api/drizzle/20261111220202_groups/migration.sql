CREATE TABLE `groups` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`master_device_id` text NOT NULL,
	`left_device_id` text NOT NULL,
	`right_device_id` text NOT NULL,
	`created_on` integer NOT NULL
);
