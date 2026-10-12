CREATE TABLE IF NOT EXISTS dedicated_virtual_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  customer_code VARCHAR(100) NULL UNIQUE,
  dedicated_account_id BIGINT UNSIGNED NULL UNIQUE,
  account_name VARCHAR(160) NULL,
  account_number VARCHAR(30) NULL UNIQUE,
  bank_name VARCHAR(120) NULL,
  bank_slug VARCHAR(80) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status ENUM('pending', 'active', 'failed')
    NOT NULL DEFAULT 'pending',
  failure_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dva_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_dva_user (user_id),
  INDEX idx_dva_status (status)
) ENGINE=InnoDB;
