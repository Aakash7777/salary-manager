DROP INDEX `employees_full_name_idx`;--> statement-breakpoint
CREATE INDEX `employees_full_name_idx` ON `employees` ("full_name" COLLATE NOCASE);