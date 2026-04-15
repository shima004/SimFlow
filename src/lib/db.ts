// SQLite database setup for competition management.
// Database file is stored at DB_PATH env var (default: ./simflow.db).
import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (_db) return _db;
	const path = env.DB_PATH ?? 'simflow.db';
	_db = new Database(path);
	_db.pragma('journal_mode = WAL');
	migrate(_db);
	return _db;
}

function migrate(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			subject    TEXT NOT NULL UNIQUE,
			role       TEXT NOT NULL DEFAULT 'viewer',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS competitions (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			name          TEXT NOT NULL,
			created_at    TEXT NOT NULL DEFAULT (datetime('now')),
			template      TEXT NOT NULL DEFAULT 'rrs-workflow-python',
			server_cpu    TEXT NOT NULL DEFAULT '4000m',
			server_memory TEXT NOT NULL DEFAULT '8Gi',
			agent_cpu     TEXT NOT NULL DEFAULT '4000m',
			agent_memory  TEXT NOT NULL DEFAULT '8Gi'
		);

		CREATE TABLE IF NOT EXISTS competition_runs (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
			agent          TEXT NOT NULL,
			map            TEXT NOT NULL,
			template       TEXT NOT NULL DEFAULT 'rrs-workflow-python',
			workflow_name  TEXT,
			workflow_uid   TEXT,
			UNIQUE(competition_id, agent, map)
		);
	`);

	// Add new columns to existing competitions table if missing
	const cols = (db.pragma('table_info(competitions)') as { name: string }[]).map((c) => c.name);
	if (!cols.includes('template'))      db.exec(`ALTER TABLE competitions ADD COLUMN template TEXT NOT NULL DEFAULT 'rrs-workflow-python'`);

	// Add template column to competition_runs if missing
	const runCols = (db.pragma('table_info(competition_runs)') as { name: string }[]).map((c) => c.name);
	if (!runCols.includes('template')) db.exec(`ALTER TABLE competition_runs ADD COLUMN template TEXT NOT NULL DEFAULT 'rrs-workflow-python'`);
	if (!cols.includes('server_cpu'))    db.exec(`ALTER TABLE competitions ADD COLUMN server_cpu TEXT NOT NULL DEFAULT '4000m'`);
	if (!cols.includes('server_memory')) db.exec(`ALTER TABLE competitions ADD COLUMN server_memory TEXT NOT NULL DEFAULT '8Gi'`);
	if (!cols.includes('agent_cpu'))     db.exec(`ALTER TABLE competitions ADD COLUMN agent_cpu TEXT NOT NULL DEFAULT '4000m'`);
	if (!cols.includes('agent_memory'))  db.exec(`ALTER TABLE competitions ADD COLUMN agent_memory TEXT NOT NULL DEFAULT '8Gi'`);
}

export type User = {
	id: number;
	subject: string;
	role: 'admin' | 'operator' | 'competition-upload' | 'competition' | 'viewer';
	created_at: string;
};

export type Competition = {
	id: number;
	name: string;
	created_at: string;
	template: string;
	server_cpu: string;
	server_memory: string;
	agent_cpu: string;
	agent_memory: string;
};

export type CompetitionRun = {
	id: number;
	competition_id: number;
	agent: string;
	map: string;
	template: string;
	workflow_name: string | null;
	workflow_uid: string | null;
};
