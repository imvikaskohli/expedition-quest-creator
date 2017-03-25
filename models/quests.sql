CREATE TABLE quests (
  id VARCHAR(255) NOT NULL,
  PRIMARY KEY(id),
  published TIMESTAMP NULL DEFAULT NOW(),
  tombstone TIMESTAMP NULL DEFAULT NULL,
  publishedurl VARCHAR(2048),
  userid VARCHAR(255),
  author VARCHAR(255),
  email VARCHAR(255),
  maxplayers INT,
  maxtimeminutes INT,
  minplayers INT,
  mintimeminutes INT,
  summary VARCHAR(1024),
  title VARCHAR(255),
  url VARCHAR(2048),
  familyfriendly BOOL,
  ratingavg NUMERIC(4,2),
  ratingcount INT
);