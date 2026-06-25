-- ============================================================
-- MFC Portal v4.0 — COMPLETE SETUP
-- Run this entire file in phpMyAdmin SQL tab
-- Creates database + all tables + all seed data
-- ============================================================

DROP DATABASE IF EXISTS mfc_db;
CREATE DATABASE mfc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mfc_db;

-- ============================================================
-- TABLE 1: settings
-- ============================================================
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_name VARCHAR(255) DEFAULT 'My Transport Company',
  owner_name VARCHAR(255),
  gstin VARCHAR(20),
  pan VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  bank_ifsc VARCHAR(20),
  logo_url VARCHAR(500),
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  trip_number_prefix VARCHAR(20) DEFAULT 'TRIP',
  driver_pay_per_km DECIMAL(6,2) DEFAULT 5.00,
  default_commission_percent DECIMAL(5,2) DEFAULT 5.00,
  gst_default ENUM('cgst_sgst','igst','exempt') DEFAULT 'exempt',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 2: users
-- ============================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff1','staff2') DEFAULT 'staff1',
  display_name VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 3: trucks
-- ============================================================
CREATE TABLE trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(50) NOT NULL UNIQUE,
  truck_type VARCHAR(100),
  wheel_count ENUM('4','6','10','14') DEFAULT '10',
  make VARCHAR(100),
  model VARCHAR(100),
  year INT,
  rc_expiry DATE,
  puc_expiry DATE,
  fitness_expiry DATE,
  insurance_expiry DATE,
  permit_expiry DATE,
  loan_amount DECIMAL(12,2) DEFAULT 0,
  loan_emi DECIMAL(10,2) DEFAULT 0,
  loan_start_date DATE,
  loan_tenure_months INT DEFAULT 0,
  loan_paid_emis INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 4: drivers
-- ============================================================
CREATE TABLE drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  license_number VARCHAR(100),
  license_expiry DATE,
  badge_expiry DATE,
  address TEXT,
  aadhaar_number VARCHAR(12) DEFAULT NULL,
  aadhaar_status ENUM('verified','pending','not_verified') DEFAULT 'not_verified',
  aadhaar_copy_uploaded TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 5: consignees
-- ============================================================
CREATE TABLE consignees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  gstin VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 6: trips
-- ============================================================
CREATE TABLE trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_number VARCHAR(50) NOT NULL UNIQUE,
  lr_number VARCHAR(100),
  trip_date DATE NOT NULL,
  trip_type ENUM('owned','brokerage') DEFAULT 'owned',
  truck_id INT,
  driver_id INT,
  broker_owner_name VARCHAR(255),
  broker_owner_phone VARCHAR(20),
  broker_truck_number VARCHAR(50),
  broker_driver_name VARCHAR(255),
  commission_percent DECIMAL(5,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  broker_advance_paid DECIMAL(10,2) DEFAULT 0,
  broker_final_paid DECIMAL(10,2) DEFAULT 0,
  broker_payment_status ENUM('pending','advance_paid','settled') DEFAULT 'pending',
  consignee_id INT,
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  distance_km DECIMAL(8,2) DEFAULT 0,
  weight_tons DECIMAL(8,2) DEFAULT 0,
  freight_amount DECIMAL(10,2) DEFAULT 0,
  advance_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  detention_charges DECIMAL(10,2) DEFAULT 0,
  kata_charges DECIMAL(10,2) DEFAULT 0,
  loading_charges DECIMAL(10,2) DEFAULT 0,
  unloading_charges DECIMAL(10,2) DEFAULT 0,
  gst_type ENUM('cgst_sgst','igst','exempt') DEFAULT 'exempt',
  gst_rate DECIMAL(5,2) DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  driver_extra_pay DECIMAL(10,2) DEFAULT 0,
  status ENUM('planned','in_progress','completed','cancelled') DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (consignee_id) REFERENCES consignees(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE 7: trip_expenses
-- ============================================================
CREATE TABLE trip_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  expense_type ENUM('diesel','toll','rto','repair','driver_allowance','other') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(500),
  expense_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 8: invoices
-- ============================================================
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  consignee_id INT,
  trip_ids TEXT,
  subtotal DECIMAL(10,2) DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  payment_status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consignee_id) REFERENCES consignees(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE 9: maintenance_logs
-- ============================================================
CREATE TABLE maintenance_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_id INT NOT NULL,
  log_type ENUM('servicing','fuel','repair','document','other') NOT NULL,
  description TEXT,
  cost DECIMAL(10,2) DEFAULT 0,
  odometer_reading INT,
  service_date DATE NOT NULL,
  next_service_date DATE,
  vendor_name VARCHAR(255),
  doc_type VARCHAR(100),
  doc_expiry DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 10: tyre_logs
-- ============================================================
CREATE TABLE tyre_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_id INT NOT NULL,
  position VARCHAR(10) NOT NULL,
  event_type ENUM('new_fit','removal','rotation') NOT NULL,
  event_date DATE NOT NULL,
  odometer_reading INT NOT NULL,
  tyre_brand VARCHAR(100),
  tyre_serial VARCHAR(100),
  tyre_size VARCHAR(50),
  purchase_cost DECIMAL(10,2) DEFAULT 0,
  km_run INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 11: owner_payments
-- ============================================================
CREATE TABLE owner_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  owner_phone VARCHAR(20),
  truck_number VARCHAR(50),
  freight_amount DECIMAL(10,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  payable_amount DECIMAL(10,2) DEFAULT 0,
  advance_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending','advance_paid','settled') DEFAULT 'pending',
  notes TEXT,
  settled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- ============================================================
-- VIEW 1: truck_summary
-- ============================================================
CREATE VIEW truck_summary AS
SELECT
  t.id,
  t.truck_number,
  t.truck_type,
  t.make,
  t.model,
  t.year,
  t.wheel_count,
  COALESCE((SELECT SUM(fr.freight_amount) FROM trips fr WHERE fr.truck_id = t.id AND fr.status = 'completed'), 0) AS total_revenue,
  COALESCE((SELECT COUNT(*) FROM trips tr WHERE tr.truck_id = t.id), 0) AS total_trips,
  COALESCE((SELECT SUM(dk.distance_km) FROM trips dk WHERE dk.truck_id = t.id), 0) AS total_km,
  COALESCE((SELECT SUM(ms.cost) FROM maintenance_logs ms WHERE ms.truck_id = t.id AND ms.log_type = 'servicing'), 0) AS servicing_cost,
  COALESCE((SELECT SUM(mf.cost) FROM maintenance_logs mf WHERE mf.truck_id = t.id AND mf.log_type = 'fuel'), 0) AS fuel_cost,
  COALESCE((SELECT SUM(mr.cost) FROM maintenance_logs mr WHERE mr.truck_id = t.id AND mr.log_type = 'repair'), 0) AS repair_cost,
  COALESCE((SELECT SUM(ty.purchase_cost) FROM tyre_logs ty WHERE ty.truck_id = t.id AND ty.event_type = 'new_fit'), 0) AS tyre_cost,
  COALESCE((SELECT SUM(ma.cost) FROM maintenance_logs ma WHERE ma.truck_id = t.id), 0) AS total_maintenance_cost,
  COALESCE((SELECT SUM(fr2.freight_amount) FROM trips fr2 WHERE fr2.truck_id = t.id AND fr2.status = 'completed'), 0) -
  COALESCE((SELECT SUM(ma2.cost) FROM maintenance_logs ma2 WHERE ma2.truck_id = t.id), 0) AS net_contribution
FROM trucks t
WHERE t.is_active = 1;

-- ============================================================
-- VIEW 2: driver_monthly_trips
-- ============================================================
CREATE VIEW driver_monthly_trips AS
SELECT
  d.id AS driver_id,
  d.name AS driver_name,
  COUNT(t.id) AS trips_this_month,
  COALESCE(SUM(t.freight_amount), 0) AS revenue_this_month
FROM drivers d
LEFT JOIN trips t ON t.driver_id = d.id
  AND MONTH(t.trip_date) = MONTH(CURDATE())
  AND YEAR(t.trip_date) = YEAR(CURDATE())
  AND t.status != 'cancelled'
WHERE d.is_active = 1
GROUP BY d.id, d.name;

-- ============================================================
-- SEED: settings
-- ============================================================
INSERT INTO settings
  (business_name, owner_name, gstin, pan, address, city, state,
   phone, bank_name, bank_account, bank_ifsc, default_commission_percent)
VALUES
  ('Mumbai Freight Carriers', 'Sagar', '27DAPPS1266E1ZF', 'DAPPS1266E',
   'Nigdi, Pune', 'Pune', 'Maharashtra', '9999999999',
   'ICICI Bank', '000000000000', 'ICIC0002305', 5.00);

-- ============================================================
-- SEED: users
-- admin123 and staff123 are the plain-text passwords
-- CONCAT used to prevent phpMyAdmin treating $ as variable
-- ============================================================
INSERT INTO users (name, email, password_hash, role, display_name) VALUES
(
  'Admin',
  'admin@mfc.com',
  CONCAT('$2b', '$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhu.'),
  'admin',
  'Admin'
),
(
  'Rahul Sharma',
  'staff1@mfc.com',
  CONCAT('$2b', '$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhu.'),
  'staff1',
  'Operations Staff'
),
(
  'Vijay Patil',
  'staff2@mfc.com',
  CONCAT('$2b', '$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhu.'),
  'staff2',
  'Fleet & Maintenance Staff'
);

-- ============================================================
-- SEED: trucks
-- ============================================================
INSERT INTO trucks
  (truck_number, truck_type, wheel_count, make, model, year,
   loan_emi, loan_tenure_months, loan_paid_emis)
VALUES
  ('MH12AB1234', '14-Wheeler Heavy', '14', 'Tata', 'Prima', 2020, 18500, 48, 20),
  ('MH12CD5678', '10-Wheeler Medium', '10', 'Ashok Leyland', 'U2523', 2021, 22000, 60, 16),
  ('MH14EF9012', '6-Wheeler Light', '6', 'Tata', '1109', 2019, 0, 0, 0);

-- ============================================================
-- SEED: drivers
-- ============================================================
INSERT INTO drivers
  (name, phone, license_number, license_expiry, aadhaar_status)
VALUES
  ('Ramesh Patil', '9876543210', 'MH1420190012345', '2027-06-30', 'verified'),
  ('Suresh Jadhav', '9876543211', 'MH1420200054321', '2026-12-31', 'verified'),
  ('Mahesh Shinde', '9876543212', 'MH1420180098765', '2026-03-31', 'pending');

-- ============================================================
-- SEED: consignees
-- ============================================================
INSERT INTO consignees (name, gstin, city, state, phone) VALUES
  ('Reliance Industries Ltd', '27AAACR5055K1ZZ', 'Mumbai', 'Maharashtra', '9111111111'),
  ('Tata Steel Ltd', '21AAACT2727Q1ZV', 'Jamshedpur', 'Jharkhand', '9222222222'),
  ('Bajaj Auto Ltd', '27AAACB1866J1ZP', 'Pune', 'Maharashtra', '9333333333');

-- ============================================================
-- VERIFY — should show all 11 tables
-- ============================================================
SHOW TABLES;
