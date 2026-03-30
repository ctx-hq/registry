-- Gem install method for Ruby CLI tools
ALTER TABLE install_metadata ADD COLUMN gem TEXT NOT NULL DEFAULT '';

-- Auth hint for CLI tools requiring authentication setup
ALTER TABLE cli_metadata ADD COLUMN auth TEXT NOT NULL DEFAULT '';
