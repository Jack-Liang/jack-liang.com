-- 浏览量计数：page_views 存总数，view_visits 用于「同一访客同一天只计一次」的去重
CREATE TABLE IF NOT EXISTS page_views (
    slug TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS view_visits (
    slug TEXT NOT NULL,
    visitor TEXT NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (slug, visitor, day)
);
