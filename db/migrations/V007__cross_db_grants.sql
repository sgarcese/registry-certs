-- Commerce.sp_AddOrderItem validates certificate IDs against
-- Registry.Death.Certificates. Ownership chaining doesn't cross databases,
-- so the app login needs an explicit SELECT grant there.

USE [Registry];
GO

GRANT SELECT ON Death.Certificates TO [$(APP_DB_USER)];
GO
