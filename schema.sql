-- Schema do banco de dados Baileys
-- Arquivo: schema.sql

-- Tabela de instâncias
CREATE TABLE IF NOT EXISTS baileys_instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'disconnected',
  qr_code TEXT,
  
  -- Proxy configuration
  proxy_enabled BOOLEAN DEFAULT 0,
  proxy_type TEXT,
  proxy_host TEXT,
  proxy_port INTEGER,
  proxy_username TEXT,
  proxy_password TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de log de mensagens enviadas
CREATE TABLE IF NOT EXISTS baileys_messages_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT,
  has_mentions BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (instance_id) REFERENCES baileys_instances(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instances_api_key ON baileys_instances(api_key);
CREATE INDEX IF NOT EXISTS idx_instances_status ON baileys_instances(status);
CREATE INDEX IF NOT EXISTS idx_messages_instance ON baileys_messages_log(instance_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON baileys_messages_log(sent_at);
