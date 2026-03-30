-- CLI+Skill composite packages: add origin to skill_metadata
ALTER TABLE skill_metadata ADD COLUMN origin TEXT NOT NULL DEFAULT '';

-- Shell script install method (curl|sh pattern)
ALTER TABLE install_metadata ADD COLUMN script TEXT NOT NULL DEFAULT '';
