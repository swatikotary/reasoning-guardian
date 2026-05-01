CREATE TABLE IF NOT EXISTS decisions (
  id             TEXT PRIMARY KEY,
  decision       TEXT NOT NULL,
  slot           TEXT NOT NULL,
  scope          TEXT,
  alternatives   TEXT,
  reasoning      TEXT,
  constraints    TEXT,
  impact_score   INTEGER DEFAULT 5,
  status         TEXT DEFAULT 'active',
  confidence     REAL DEFAULT 0.8,
  contributors   TEXT,
  timestamp      TEXT,
  evolves_from   TEXT,
  replaces       TEXT
);

CREATE TABLE IF NOT EXISTS conflicts (
  id           TEXT PRIMARY KEY,
  slot         TEXT NOT NULL,
  scope        TEXT,
  position_a   TEXT NOT NULL,
  position_b   TEXT NOT NULL,
  status       TEXT DEFAULT 'unresolved',
  resolution   TEXT,
  timestamp    TEXT
);