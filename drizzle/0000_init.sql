CREATE TABLE `auth_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`purpose` text NOT NULL,
	`email_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `auth_otps_lookup` ON `auth_otps` (`event_id`,`purpose`,`email_hash`);--> statement-breakpoint
CREATE TABLE `booth_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`booth_id` text NOT NULL,
	`key_full` text NOT NULL,
	`key_thumb` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booth_id`) REFERENCES `booths`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booth_photos_position` ON `booth_photos` (`booth_id`,`position`);--> statement-breakpoint
CREATE TABLE `booth_stats` (
	`booth_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`star_sum` integer DEFAULT 0 NOT NULL,
	`s1` integer DEFAULT 0 NOT NULL,
	`s2` integer DEFAULT 0 NOT NULL,
	`s3` integer DEFAULT 0 NOT NULL,
	`s4` integer DEFAULT 0 NOT NULL,
	`s5` integer DEFAULT 0 NOT NULL,
	`category_counts_json` text DEFAULT '{}' NOT NULL,
	`last_review_at` integer,
	`product_count` integer DEFAULT 0 NOT NULL,
	`price_from` integer,
	`featured_product_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`booth_id`) REFERENCES `booths`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `booths` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`email` text,
	`name` text NOT NULL,
	`description` text,
	`about` text,
	`tagline` text,
	`team_name` text,
	`logo_key` text,
	`booth_no` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reject_reason` text,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_late` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT 'self' NOT NULL,
	`owner_invited_at` integer,
	`owner_last_login_at` integer,
	`product_terms_accepted_at` integer,
	`whatsapp_e164` text,
	`whatsapp_consent_at` integer,
	`whatsapp_consent_by` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booths_name_not_blank" CHECK(length(trim("booths"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booths_event_email` ON `booths` (`event_id`,`email`);--> statement-breakpoint
CREATE INDEX `booths_event_status` ON `booths` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`hidden_from_public` integer DEFAULT 0 NOT NULL,
	`active_version` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'draft' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`registration_open_at` integer,
	`registration_close_at` integer NOT NULL,
	`event_start_at` integer NOT NULL,
	`event_end_at` integer NOT NULL,
	`results_published_at` integer,
	`ratings_mode` text DEFAULT 'visible' NOT NULL,
	`ranking_mode` text DEFAULT 'visible' NOT NULL,
	`results_json` text,
	`results_version` integer DEFAULT 0 NOT NULL,
	`reveal_seq` integer DEFAULT 0 NOT NULL,
	`reveal_started_at` integer,
	`reveal_json` text,
	`reveal_target` text DEFAULT 'screen' NOT NULL,
	`stats_version` integer DEFAULT 0 NOT NULL,
	`title_highlight` text,
	`logo_key` text,
	`og_image_key` text,
	`hero_keys_json` text,
	`contact_json` text,
	`social_json` text,
	`theme_json` text,
	`settings_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "events_start_before_end" CHECK("events"."event_start_at" < "events"."event_end_at"),
	CONSTRAINT "events_registration_window" CHECK("events"."registration_open_at" IS NULL OR "events"."registration_open_at" < "events"."registration_close_at"),
	CONSTRAINT "events_active_flag" CHECK("events"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active` ON `events` (`is_active`) WHERE "events"."is_active" = 1;--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`actor` text NOT NULL,
	`key` text NOT NULL,
	`route` text NOT NULL,
	`body_hash` text NOT NULL,
	`status` text NOT NULL,
	`response_status` integer,
	`response_body` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`actor`, `key`)
);
--> statement-breakpoint
CREATE INDEX `idempotency_created` ON `idempotency_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `invited_emails` (
	`event_id` text NOT NULL,
	`email_hash` text NOT NULL,
	PRIMARY KEY(`event_id`, `email_hash`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `moderation_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`term` text NOT NULL,
	`lang` text NOT NULL,
	`severity` text NOT NULL,
	`kind` text DEFAULT 'block' NOT NULL,
	`match` text DEFAULT 'word' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`source` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moderation_terms_unique` ON `moderation_terms` (`event_id`,`term`,`kind`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`booth_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`price_idr` integer NOT NULL,
	`compare_price_idr` integer,
	`badge` text,
	`is_featured` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`key_full` text,
	`key_thumb` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booth_id`) REFERENCES `booths`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_price_range" CHECK("products"."price_idr" BETWEEN 0 AND 99999999),
	CONSTRAINT "products_compare_price" CHECK("products"."compare_price_idr" IS NULL OR "products"."compare_price_idr" > "products"."price_idr")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_featured` ON `products` (`booth_id`) WHERE "products"."is_featured" = 1 AND "products"."status" = 'active';--> statement-breakpoint
CREATE INDEX `products_booth` ON `products` (`booth_id`,`position`);--> statement-breakpoint
CREATE TABLE `review_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_categories_event` ON `review_categories` (`event_id`,`position`);--> statement-breakpoint
CREATE TABLE `review_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`review_id` text NOT NULL,
	`reporter_role` text NOT NULL,
	`reporter_booth_id` text,
	`reporter_visitor_id` text,
	`reason` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`decision_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "review_reports_reporter" CHECK(("review_reports"."reporter_role" = 'booth' AND "review_reports"."reporter_booth_id" IS NOT NULL) OR ("review_reports"."reporter_role" = 'visitor' AND "review_reports"."reporter_visitor_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_reports_booth_unique` ON `review_reports` (`review_id`,`reporter_booth_id`) WHERE "review_reports"."reporter_role" = 'booth';--> statement-breakpoint
CREATE UNIQUE INDEX `review_reports_visitor_unique` ON `review_reports` (`review_id`,`reporter_visitor_id`) WHERE "review_reports"."reporter_role" = 'visitor';--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`booth_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`stars` integer NOT NULL,
	`comment` text,
	`category_ids_json` text,
	`status` text DEFAULT 'visible' NOT NULL,
	`comment_status` text DEFAULT 'visible' NOT NULL,
	`comment_masked` text,
	`filter_hits_json` text,
	`filter_version` integer,
	`comment_locked` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`risk_score` integer,
	`flags_json` text,
	`ip_hash` text,
	`ua_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`moderated_by` text,
	`moderated_at` integer,
	`moderation_reason` text,
	`original_stars` integer,
	`original_comment` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booth_id`) REFERENCES `booths`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reviews_stars_range" CHECK("reviews"."stars" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_booth_visitor` ON `reviews` (`booth_id`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `reviews_event_created` ON `reviews` (`event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_event_status` ON `reviews` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `reviews_event_stars` ON `reviews` (`event_id`,`stars`);--> statement-breakpoint
CREATE INDEX `reviews_booth_status` ON `reviews` (`booth_id`,`status`);--> statement-breakpoint
CREATE TABLE `ticket_codes` (
	`event_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`visitor_id` text,
	`used_at` integer,
	PRIMARY KEY(`event_id`, `code_hash`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`provider` text NOT NULL,
	`identity_hash` text NOT NULL,
	`display_name` text,
	`blocked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visitors_identity` ON `visitors` (`event_id`,`identity_hash`);