-- Listly database schema (SDS Section 6)
-- Runs automatically the first time the MySQL container is created.

CREATE DATABASE IF NOT EXISTS listly_dev;
USE listly_dev;

CREATE TABLE users (
  user_id       CHAR(36)     NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE wishlists (
  wishlist_id    CHAR(36)     NOT NULL,
  owning_user_id CHAR(36)     NOT NULL,
  name           VARCHAR(100) NOT NULL,
  share_id       VARCHAR(64)  NULL,
  PRIMARY KEY (wishlist_id),
  UNIQUE KEY uq_wishlists_share_id (share_id),
  KEY idx_wishlists_owner (owning_user_id),
  CONSTRAINT fk_wishlists_user
    FOREIGN KEY (owning_user_id) REFERENCES users (user_id)
    ON DELETE CASCADE
);

CREATE TABLE retailers (
  retailer_id CHAR(36)     NOT NULL,
  name        VARCHAR(100) NOT NULL,
  domain      VARCHAR(255) NOT NULL,
  PRIMARY KEY (retailer_id),
  UNIQUE KEY uq_retailers_domain (domain)
);

CREATE TABLE items (
  item_id     CHAR(36)       NOT NULL,
  wishlist_id CHAR(36)       NOT NULL,
  retailer_id CHAR(36)       NULL,
  title       VARCHAR(255)   NOT NULL,
  price       DECIMAL(10,2)  NULL,
  image_url   VARCHAR(2048)  NULL,
  source_url  VARCHAR(2048)  NOT NULL,
  date_added  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  KEY idx_items_wishlist (wishlist_id),
  CONSTRAINT fk_items_wishlist
    FOREIGN KEY (wishlist_id) REFERENCES wishlists (wishlist_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_items_retailer
    FOREIGN KEY (retailer_id) REFERENCES retailers (retailer_id)
    ON DELETE SET NULL
);

CREATE TABLE purchases (
  purchase_id  CHAR(36)  NOT NULL,
  item_id      CHAR(36)  NOT NULL,
  purchased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_id),
  UNIQUE KEY uq_purchases_item (item_id),
  CONSTRAINT fk_purchases_item
    FOREIGN KEY (item_id) REFERENCES items (item_id)
    ON DELETE CASCADE
);

CREATE TABLE share_access_log (
  log_id      CHAR(36)  NOT NULL,
  wishlist_id CHAR(36)  NOT NULL,
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_share_log_wishlist (wishlist_id),
  CONSTRAINT fk_share_log_wishlist
    FOREIGN KEY (wishlist_id) REFERENCES wishlists (wishlist_id)
    ON DELETE CASCADE
);
