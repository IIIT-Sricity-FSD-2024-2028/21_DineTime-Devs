CREATE DATABASE DineTimeDB;
USE DineTimeDB;

CREATE TABLE LOCATION (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    latitude DECIMAL(10,6) NOT NULL,
    longitude DECIMAL(10,6) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL
);

CREATE TABLE USER (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    location_id INT,
    CONSTRAINT fk_user_location
        FOREIGN KEY (location_id)
        REFERENCES LOCATION(location_id)
);

CREATE TABLE DINER (
    diner_id INT PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    loyalty_points INT DEFAULT 0 CHECK (loyalty_points >= 0),
    CONSTRAINT fk_diner_user
        FOREIGN KEY (diner_id)
        REFERENCES USER(user_id)
);

CREATE TABLE RESTAURANT_MANAGER (
    manager_id INT PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    business_license_number VARCHAR(100) UNIQUE NOT NULL,
    government_id VARCHAR(100) UNIQUE NOT NULL,
    verified_status BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_manager_user
        FOREIGN KEY (manager_id)
        REFERENCES USER(user_id)
);

CREATE TABLE RESTAURANT (
    restaurant_id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    location_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    cuisine_type VARCHAR(100),
    description TEXT,
    total_tables INT CHECK (total_tables >= 0),
    policies TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_restaurant_manager
        FOREIGN KEY (manager_id)
        REFERENCES RESTAURANT_MANAGER(manager_id),
    CONSTRAINT fk_restaurant_location
        FOREIGN KEY (location_id)
        REFERENCES LOCATION(location_id)
);

CREATE TABLE RESTAURANT_STAFF (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    employee_code VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_type VARCHAR(50) NOT NULL,
    CONSTRAINT fk_staff_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id)
);

CREATE TABLE TABLES (
    table_id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    table_number INT NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) DEFAULT 'available',
    CONSTRAINT unique_table_per_restaurant
        UNIQUE (restaurant_id, table_number),
    CONSTRAINT fk_table_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id)
);

CREATE TABLE TIME_SLOT (
    slot_id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT valid_slot_time
        CHECK (end_time > start_time),
    CONSTRAINT fk_slot_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id)
);

CREATE TABLE RESERVATION (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    diner_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    slot_id INT NOT NULL,
    guest_count INT NOT NULL CHECK (guest_count > 0),
    reservation_status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservation_diner
        FOREIGN KEY (diner_id)
        REFERENCES DINER(diner_id),
    CONSTRAINT fk_reservation_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id),
    CONSTRAINT fk_reservation_slot
        FOREIGN KEY (slot_id)
        REFERENCES TIME_SLOT(slot_id)
);

CREATE TABLE RESERVATION_TABLE (
    reservation_id INT NOT NULL,
    table_id INT NOT NULL,
    PRIMARY KEY (reservation_id, table_id),
    CONSTRAINT fk_rt_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES RESERVATION(reservation_id),
    CONSTRAINT fk_rt_table
        FOREIGN KEY (table_id)
        REFERENCES TABLES(table_id)
);

CREATE TABLE MENU_ITEM (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    availability BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_menu_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id)
);

CREATE TABLE ORDERS (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    order_status VARCHAR(20) DEFAULT 'placed',
    CONSTRAINT fk_order_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES RESERVATION(reservation_id),
    CONSTRAINT fk_order_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id)
);

CREATE TABLE ORDER_ITEM (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    CONSTRAINT fk_oi_order
        FOREIGN KEY (order_id)
        REFERENCES ORDERS(order_id),
    CONSTRAINT fk_oi_item
        FOREIGN KEY (item_id)
        REFERENCES MENU_ITEM(item_id)
);

CREATE TABLE PAYMENT (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    transaction_ref VARCHAR(150) UNIQUE,
    payment_time DATETIME,
    CONSTRAINT fk_payment_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES RESERVATION(reservation_id)
);

CREATE TABLE CHECKIN (
    checkin_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    staff_id INT NOT NULL,
    checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'verified',
    CONSTRAINT fk_checkin_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES RESERVATION(reservation_id),
    CONSTRAINT fk_checkin_staff
        FOREIGN KEY (staff_id)
        REFERENCES RESTAURANT_STAFF(staff_id)
);

CREATE TABLE REVIEW (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    diner_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_diner
        FOREIGN KEY (diner_id)
        REFERENCES DINER(diner_id),
    CONSTRAINT fk_review_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES RESTAURANT(restaurant_id)
);
CREATE TABLE NOTIFICATION (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES USER(user_id)
);
