-- AI Study Assistant: MySQL 8 schema (utf8mb4 for Kazakh, Russian and English text)
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','admin') NOT NULL DEFAULT 'student',
  created_at    DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id      CHAR(36) NOT NULL PRIMARY KEY,
  language     ENUM('kk','ru','en') NOT NULL DEFAULT 'kk',
  save_history BOOLEAN  NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  title      VARCHAR(200) NOT NULL,
  created_at DATETIME(3)  NOT NULL,
  KEY ix_conversations_user (user_id, created_at),
  CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id              CHAR(36)    NOT NULL PRIMARY KEY,
  conversation_id CHAR(36)    NOT NULL,
  user_id         CHAR(36)    NOT NULL,
  type            ENUM('ask','solve','code','file','image') NOT NULL,
  prompt          TEXT        NOT NULL,
  answer          MEDIUMTEXT  NOT NULL,
  status          ENUM('done','failed') NOT NULL,
  language        ENUM('kk','ru','en') NOT NULL,
  created_at      DATETIME(3) NOT NULL,
  KEY ix_messages_user_type (user_id, type, created_at),
  FULLTEXT KEY ft_messages_prompt (prompt),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sources (
  id           CHAR(36)      NOT NULL PRIMARY KEY,
  message_id   CHAR(36)      NOT NULL,
  title        VARCHAR(300)  NOT NULL,
  url          VARCHAR(2048) NOT NULL,
  domain       VARCHAR(255)  NOT NULL,
  retrieved_at DATETIME(3)   NOT NULL,
  KEY ix_sources_message (message_id),
  CONSTRAINT fk_sources_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generated_assets (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  message_id CHAR(36)     NULL,
  kind       ENUM('file','image') NOT NULL,
  format     VARCHAR(10)  NOT NULL,
  name       VARCHAR(160) NOT NULL,
  size       INT UNSIGNED NOT NULL,
  file_path  VARCHAR(500) NOT NULL,
  created_at DATETIME(3)  NOT NULL,
  KEY ix_assets_user (user_id, kind),
  CONSTRAINT fk_assets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assets_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_items (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  message_id CHAR(36)     NOT NULL,
  label      VARCHAR(120) NOT NULL,
  created_at DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_saved_user_message (user_id, message_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
