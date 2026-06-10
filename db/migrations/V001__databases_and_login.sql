-- Databases + application login.
--
-- The app's own database ($(APP_DB), from REGISTRY_DATA_DB_DATABASE) holds
-- the Commerce schema. Registry (schema Death) and MarriageRegistry mirror
-- the city's layout so RegistryDb.ts's three-part proc names work unchanged.

IF DB_ID(N'$(APP_DB)') IS NULL
BEGIN
  EXEC('CREATE DATABASE [$(APP_DB)]');
END
GO

IF DB_ID(N'Registry') IS NULL
BEGIN
  EXEC('CREATE DATABASE [Registry]');
END
GO

IF DB_ID(N'MarriageRegistry') IS NULL
BEGIN
  EXEC('CREATE DATABASE [MarriageRegistry]');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'$(APP_DB_USER)')
BEGIN
  EXEC('CREATE LOGIN [$(APP_DB_USER)] WITH PASSWORD = N''$(APP_DB_PASSWORD)'', CHECK_POLICY = ON');
END
GO

USE [$(APP_DB)];
GO

IF SCHEMA_ID(N'Commerce') IS NULL
BEGIN
  EXEC('CREATE SCHEMA Commerce');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_DB_USER)')
BEGIN
  EXEC('CREATE USER [$(APP_DB_USER)] FOR LOGIN [$(APP_DB_USER)]');
END
GO

GRANT EXECUTE ON SCHEMA::Commerce TO [$(APP_DB_USER)];
GO

USE [Registry];
GO

IF SCHEMA_ID(N'Death') IS NULL
BEGIN
  EXEC('CREATE SCHEMA Death');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_DB_USER)')
BEGIN
  EXEC('CREATE USER [$(APP_DB_USER)] FOR LOGIN [$(APP_DB_USER)]');
END
GO

GRANT EXECUTE ON SCHEMA::Death TO [$(APP_DB_USER)];
GO

USE [MarriageRegistry];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_DB_USER)')
BEGIN
  EXEC('CREATE USER [$(APP_DB_USER)] FOR LOGIN [$(APP_DB_USER)]');
END
GO

GRANT EXECUTE ON SCHEMA::dbo TO [$(APP_DB_USER)];
GO
