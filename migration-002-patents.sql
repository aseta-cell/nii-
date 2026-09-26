-- Only for a database created BEFORE patents were added
-- (a fresh import of database.sql already has this table).

-- ==========================
-- Patent applications
--
-- status: Awaiting Payment → Payment Review → Filed → Under Examination → Granted / Rejected
-- ==========================
CREATE TABLE patents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    number VARCHAR(40) UNIQUE,
    patent_type VARCHAR(40) NOT NULL DEFAULT 'invention',

    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    patronymic VARCHAR(100),
    iin VARCHAR(12),
    phone VARCHAR(40) NOT NULL,
    email VARCHAR(150) NOT NULL,
    address VARCHAR(300),
    co_inventors TEXT,              -- JSON list of {last_name, first_name, patronymic}

    title_kz VARCHAR(500) NOT NULL,
    title_ru VARCHAR(500) NOT NULL,
    title_en VARCHAR(500) NOT NULL,
    abstract TEXT,
    filename VARCHAR(255),

    fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_free TINYINT(1) NOT NULL DEFAULT 0,
    receipt_file VARCHAR(255),
    paid_at DATETIME NULL,

    status VARCHAR(40) NOT NULL DEFAULT 'Awaiting Payment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
