CREATE TABLE `alert_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` varchar(64) NOT NULL,
	`severity` enum('critical','warning','info') NOT NULL,
	`message` text NOT NULL,
	`messageZh` text,
	`acknowledged` boolean DEFAULT false,
	`deviceId` varchar(64) DEFAULT 'jetson-b01',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companion_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('system','user','assistant') NOT NULL,
	`content` text NOT NULL,
	`logType` varchar(32) DEFAULT 'chat',
	`deviceId` varchar(64) DEFAULT 'jetson-b01',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companion_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vitals_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`radarHr` float,
	`radarRr` float,
	`movement` float,
	`targetId` varchar(32),
	`ppgHr` float,
	`ppgSpo2` float,
	`ppgSignalQuality` float,
	`ppgConnected` boolean DEFAULT false,
	`fusedHr` float,
	`fusedMethod` varchar(64),
	`bvi` float,
	`deviceId` varchar(64) DEFAULT 'jetson-b01',
	`apiKey` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vitals_snapshots_id` PRIMARY KEY(`id`)
);
