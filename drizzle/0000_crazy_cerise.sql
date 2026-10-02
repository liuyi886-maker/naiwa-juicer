CREATE TABLE `admins` (
	`token` text PRIMARY KEY NOT NULL,
	`expires` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`created` real NOT NULL,
	`seen` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`started` real NOT NULL,
	`updated` real NOT NULL,
	`status` text NOT NULL,
	`duration` real NOT NULL,
	`caught` integer NOT NULL,
	`delivered` integer NOT NULL,
	`escaped` integer NOT NULL,
	`total` integer NOT NULL,
	`demo` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rounds_player` ON `rounds` (`player`);--> statement-breakpoint
CREATE INDEX `rounds_updated` ON `rounds` (`updated`);--> statement-breakpoint
CREATE TABLE `saves` (
	`player` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`updated` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`started` real NOT NULL,
	`seen` real NOT NULL,
	`elapsed` real DEFAULT 0 NOT NULL,
	`ended` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visits_player_started` ON `visits` (`player`,`started`);--> statement-breakpoint
CREATE INDEX `visits_seen` ON `visits` (`seen`);--> statement-breakpoint
CREATE INDEX `visits_started` ON `visits` (`started`);