-- Categories and package-category associations

CREATE TABLE categories (
    id             TEXT PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    parent_slug    TEXT,
    display_order  INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_categories_parent ON categories(parent_slug);

CREATE TABLE package_categories (
    package_id     TEXT NOT NULL,
    category_id    TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT 'manual',
    PRIMARY KEY (package_id, category_id),
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX idx_pkg_cat_category ON package_categories(category_id);
