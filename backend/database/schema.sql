-- Smart Fox VTU database foundation
-- Milestone 2.1

CREATE DATABASE IF NOT EXISTS smartfox_vtu
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smartfox_vtu;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'suspended', 'pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'support') NOT NULL DEFAULT 'admin',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status ENUM('active', 'frozen', 'closed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  wallet_id BIGINT UNSIGNED NOT NULL,
  type ENUM('funding', 'purchase', 'refund', 'adjustment', 'withdrawal') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  status ENUM('pending', 'successful', 'failed', 'reversed') NOT NULL DEFAULT 'successful',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT,
  INDEX idx_wallet_tx_user_date (user_id, created_at),
  INDEX idx_wallet_tx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  gateway VARCHAR(50) NOT NULL,
  gateway_reference VARCHAR(150) NULL UNIQUE,
  status ENUM('pending', 'successful', 'failed', 'abandoned') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_payment_user_date (user_id, created_at),
  INDEX idx_payment_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS airtime_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  network VARCHAR(30) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  provider VARCHAR(60) NULL,
  provider_reference VARCHAR(150) NULL,
  our_reference VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('pending', 'successful', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_airtime_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_airtime_user_date (user_id, created_at),
  INDEX idx_airtime_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS data_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  network VARCHAR(30) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  plan_name VARCHAR(120) NOT NULL,
  plan_type ENUM('regular', 'corporate', 'gift') NOT NULL DEFAULT 'regular',
  amount DECIMAL(15,2) NOT NULL,
  provider VARCHAR(60) NULL,
  provider_reference VARCHAR(150) NULL,
  our_reference VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('pending', 'successful', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_data_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_data_user_date (user_id, created_at),
  INDEX idx_data_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS school_fee_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  institution VARCHAR(180) NOT NULL,
  student_id VARCHAR(100) NOT NULL,
  student_name VARCHAR(160) NULL,
  fee_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  our_reference VARCHAR(100) NOT NULL UNIQUE,
  provider_reference VARCHAR(150) NULL,
  status ENUM('pending', 'successful', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_school_fee_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_school_fee_user_date (user_id, created_at),
  INDEX idx_school_fee_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS service_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  service_type VARCHAR(60) NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  request_reference VARCHAR(100) NOT NULL UNIQUE,
  provider VARCHAR(60) NULL,
  provider_reference VARCHAR(150) NULL,
  status ENUM('pending', 'successful', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_service_user_date (user_id, created_at),
  INDEX idx_service_type_status (service_type, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_reference VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('pending', 'successful', 'failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refund_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_refund_user_date (user_id, created_at),
  INDEX idx_refund_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(60) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  reference VARCHAR(150) NULL,
  payload JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  INDEX idx_webhook_provider_reference (provider, reference),
  INDEX idx_webhook_processed (processed)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_key VARCHAR(60) NOT NULL UNIQUE,
  service_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO services (service_key, service_name, description) VALUES
('airtime', 'Airtime', 'Mobile airtime recharge'),
('data', 'Data', 'Mobile data bundles'),
('school_fees', 'School Fees', 'Education and school-fee payments'),
('electricity', 'Electricity', 'Electricity bill payments'),
('cable_tv', 'Cable TV', 'Cable TV subscriptions'),
('airtime_to_cash', 'Airtime to Cash', 'Airtime conversion service'),
('exam_pins', 'Exam Pins', 'Educational examination PINs'),
('bill_payments', 'Bill Payments', 'Supported bill payments'),
('bulk_services', 'Bulk Services', 'Bulk VTU services'),
('more', 'More Services', 'Additional services added later');
