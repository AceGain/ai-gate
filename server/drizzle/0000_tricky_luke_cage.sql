CREATE TABLE `sys_endpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`type` text NOT NULL,
	`protocol` text DEFAULT '' NOT NULL,
	`path` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`update_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `sys_provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_endpoint_provider` ON `sys_endpoint` (`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_endpoint_provider_type_protocol` ON `sys_endpoint` (`provider_id`,`type`,`protocol`);--> statement-breakpoint
CREATE TABLE `sys_key` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`secret` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`expires_time` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`update_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `sys_provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_key_provider` ON `sys_key` (`provider_id`,`sort`);--> statement-breakpoint
CREATE TABLE `sys_key_model` (
	`provider_id` text NOT NULL,
	`key_id` text NOT NULL,
	`model_id` text NOT NULL,
	PRIMARY KEY(`provider_id`, `key_id`, `model_id`),
	FOREIGN KEY (`provider_id`) REFERENCES `sys_provider`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`key_id`) REFERENCES `sys_key`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `sys_model`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_key_model_key` ON `sys_key_model` (`key_id`);--> statement-breakpoint
CREATE INDEX `idx_key_model_model` ON `sys_key_model` (`model_id`);--> statement-breakpoint
CREATE TABLE `sys_model` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`type` text NOT NULL,
	`input_modal` text DEFAULT ('["text"]') NOT NULL,
	`output_modal` text DEFAULT ('["text"]') NOT NULL,
	`protocols` text DEFAULT ('[]') NOT NULL,
	`max_context` integer DEFAULT 0 NOT NULL,
	`max_input` integer DEFAULT 0 NOT NULL,
	`max_output` integer DEFAULT 0 NOT NULL,
	`reasoning` text DEFAULT 'TOGGLE' NOT NULL,
	`effort_level` text DEFAULT ('[]') NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`update_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `sys_provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_model_provider` ON `sys_model` (`provider_id`,`sort`);--> statement-breakpoint
CREATE UNIQUE INDEX `sys_model_provider_id_code_unique` ON `sys_model` (`provider_id`,`code`);--> statement-breakpoint
CREATE TABLE `sys_provider` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`update_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sys_provider_code_unique` ON `sys_provider` (`code`);