-- Backing tables for the stub stored procedures. Column names mirror the
-- result shapes RegistryDb.ts reads (see the TS interfaces there); the city's
-- real schemas are richer, but these are contract-compatible.

USE [Registry];
GO

IF OBJECT_ID(N'Death.Certificates', N'U') IS NULL
BEGIN
  CREATE TABLE Death.Certificates (
    CertificateID INT NOT NULL PRIMARY KEY,
    RegisteredNumber NVARCHAR(20) NOT NULL,
    InOut NVARCHAR(2) NULL,
    DateOfDeath NVARCHAR(20) NULL,
    DecedentName NVARCHAR(200) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,
    RegisteredYear NVARCHAR(8) NOT NULL,
    AgeOrDateOfBirth NVARCHAR(30) NOT NULL DEFAULT '',
    Pending INT NOT NULL DEFAULT 0
  );
END
GO

USE [$(APP_DB)];
GO

IF OBJECT_ID(N'Commerce.Orders', N'U') IS NULL
BEGIN
  CREATE TABLE Commerce.Orders (
    OrderKey INT IDENTITY(1000,1) PRIMARY KEY,
    OrderID NVARCHAR(40) NOT NULL UNIQUE,
    OrderType CHAR(3) NOT NULL,
    OrderDate DATETIME2 NOT NULL,
    OrderStatus NVARCHAR(30) NOT NULL DEFAULT 'placed',
    ProcessDtTm DATETIME2 NULL,
    ContactName NVARCHAR(200) NOT NULL,
    ContactEmail NVARCHAR(200) NOT NULL,
    ContactPhone NVARCHAR(50) NOT NULL,
    ShippingName NVARCHAR(200) NOT NULL,
    ShippingCompany NVARCHAR(200) NOT NULL DEFAULT '',
    ShippingAddr1 NVARCHAR(200) NOT NULL,
    ShippingAddr2 NVARCHAR(200) NOT NULL DEFAULT '',
    ShippingCity NVARCHAR(100) NOT NULL,
    ShippingState NVARCHAR(20) NOT NULL,
    ShippingZIP NVARCHAR(20) NOT NULL,
    BillingName NVARCHAR(200) NOT NULL DEFAULT '',
    BillingAddr1 NVARCHAR(200) NOT NULL DEFAULT '',
    BillingAddr2 NVARCHAR(200) NOT NULL DEFAULT '',
    BillingCity NVARCHAR(100) NOT NULL DEFAULT '',
    BillingState NVARCHAR(20) NOT NULL DEFAULT '',
    BillingZIP NVARCHAR(20) NOT NULL DEFAULT '',
    BillingLast4 NVARCHAR(8) NOT NULL DEFAULT '',
    ServiceFee MONEY NOT NULL DEFAULT 0,
    CertifiedMail BIT NOT NULL DEFAULT 0,
    IdempotencyKey NVARCHAR(64) NOT NULL,
    CancelReason NVARCHAR(400) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_Orders_IdempotencyKey
    ON Commerce.Orders (IdempotencyKey);
END
GO

IF OBJECT_ID(N'Commerce.OrderItems', N'U') IS NULL
BEGIN
  CREATE TABLE Commerce.OrderItems (
    OrderItemKey INT IDENTITY(1,1) PRIMARY KEY,
    OrderKey INT NOT NULL REFERENCES Commerce.Orders (OrderKey),
    OrderType CHAR(3) NOT NULL,
    CertificateID INT NOT NULL,
    CertificateName NVARCHAR(200) NOT NULL,
    Quantity INT NOT NULL,
    UnitCost MONEY NOT NULL
  );
END
GO

IF OBJECT_ID(N'Commerce.BirthRequests', N'U') IS NULL
BEGIN
  CREATE TABLE Commerce.BirthRequests (
    RequestItemKey INT IDENTITY(1,1) PRIMARY KEY,
    OrderKey INT NOT NULL REFERENCES Commerce.Orders (OrderKey),
    CertificateLastName NVARCHAR(100) NOT NULL,
    CertificateFirstName NVARCHAR(100) NOT NULL,
    AlternativeSpellings NVARCHAR(400) NOT NULL DEFAULT '',
    DateOfBirth DATETIME2 NOT NULL,
    Parent1LastName NVARCHAR(100) NOT NULL DEFAULT '',
    Parent1FirstName NVARCHAR(100) NOT NULL DEFAULT '',
    Parent2LastName NVARCHAR(100) NOT NULL DEFAULT '',
    Parent2FirstName NVARCHAR(100) NOT NULL DEFAULT '',
    RequestDetails NVARCHAR(MAX) NOT NULL DEFAULT '',
    Quantity INT NOT NULL,
    UnitCost MONEY NOT NULL
  );
END
GO

IF OBJECT_ID(N'Commerce.MarriageRequests', N'U') IS NULL
BEGIN
  CREATE TABLE Commerce.MarriageRequests (
    RequestItemKey INT IDENTITY(1,1) PRIMARY KEY,
    OrderKey INT NOT NULL REFERENCES Commerce.Orders (OrderKey),
    CertificateFullName1 NVARCHAR(200) NOT NULL,
    CertificateFullName2 NVARCHAR(200) NOT NULL,
    CertificateMaidenName1 NVARCHAR(200) NOT NULL DEFAULT '',
    CertificateMaidenName2 NVARCHAR(200) NOT NULL DEFAULT '',
    CertificateAltSpellings1 NVARCHAR(400) NOT NULL DEFAULT '',
    CertificateAltSpellings2 NVARCHAR(400) NOT NULL DEFAULT '',
    DateOfMarriageExact DATETIME2 NULL,
    DateOfMarriageUnsure NVARCHAR(100) NULL,
    RequestDetails NVARCHAR(MAX) NOT NULL DEFAULT '',
    Quantity INT NOT NULL,
    UnitCost MONEY NOT NULL
  );
END
GO

IF OBJECT_ID(N'Commerce.Payments', N'U') IS NULL
BEGIN
  CREATE TABLE Commerce.Payments (
    PaymentKey INT IDENTITY(1,1) PRIMARY KEY,
    OrderKey INT NOT NULL UNIQUE REFERENCES Commerce.Orders (OrderKey),
    PaymentDate DATETIME2 NOT NULL,
    PaymentDescription NVARCHAR(200) NOT NULL DEFAULT '',
    TransactionID NVARCHAR(100) NOT NULL,
    PaymentAmount MONEY NOT NULL
  );
END
GO

IF OBJECT_ID(N'Commerce.Attachments', N'U') IS NULL
BEGIN
  CREATE TABLE Commerce.Attachments (
    AttachmentKey INT IDENTITY(1,1) PRIMARY KEY,
    OrderType CHAR(3) NOT NULL,
    SessionUID NVARCHAR(64) NOT NULL,
    ContentType NVARCHAR(200) NOT NULL,
    [FileName] NVARCHAR(400) NOT NULL,
    Label NVARCHAR(400) NULL,
    AttachmentData VARBINARY(MAX) NOT NULL,
    RequestItemKey INT NULL,
    Deleted BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_Attachments_SessionUID
    ON Commerce.Attachments (SessionUID);
END
GO

USE [MarriageRegistry];
GO

IF OBJECT_ID(N'dbo.MarriageIntentions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MarriageIntentions (
    RequestItemKey INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(200) NOT NULL,
    DayPhone NVARCHAR(50) NOT NULL,
    AApplicantFName NVARCHAR(100) NOT NULL,
    AApplicantLName NVARCHAR(100) NOT NULL,
    APostmarriageSurname NVARCHAR(200) NULL,
    ADOB DATETIME2 NULL,
    ACurrentAge NVARCHAR(10) NULL,
    AOccupation NVARCHAR(200) NULL,
    AStreetAddress NVARCHAR(400) NULL,
    ACity NVARCHAR(100) NULL,
    AState NVARCHAR(50) NULL,
    AZIPCode NVARCHAR(100) NULL,
    AMarriageNumber NVARCHAR(50) NULL,
    AStatofLastMarriage NVARCHAR(100) NULL,
    AMotherName NVARCHAR(200) NULL,
    AMotherSurname NVARCHAR(200) NULL,
    AFatherName NVARCHAR(200) NULL,
    AFatherSurname NVARCHAR(200) NULL,
    APartnershipStatus NVARCHAR(100) NULL,
    ADissolutionStatus NVARCHAR(100) NULL,
    APartnershipState NVARCHAR(100) NULL,
    AParentsMarried NVARCHAR(10) NULL,
    ABloodRelative INT NULL,
    ABloodDescr NVARCHAR(400) NULL,
    ABirthplace NVARCHAR(200) NULL,
    ABirthState NVARCHAR(100) NULL,
    ASexNum NVARCHAR(20) NULL,
    ASex NVARCHAR(50) NULL,
    BApplicantFName NVARCHAR(100) NOT NULL,
    BApplicantLName NVARCHAR(100) NOT NULL,
    BPostmarriageSurname NVARCHAR(200) NULL,
    BDOB DATETIME2 NULL,
    BCurrentAge NVARCHAR(10) NULL,
    BOccupation NVARCHAR(200) NULL,
    BStreetAddress NVARCHAR(400) NULL,
    BCity NVARCHAR(100) NULL,
    BState NVARCHAR(50) NULL,
    BZIPCode NVARCHAR(100) NULL,
    BMarriageNumber NVARCHAR(50) NULL,
    BStatofLastMarriage NVARCHAR(100) NULL,
    BMotherName NVARCHAR(200) NULL,
    BMotherSurname NVARCHAR(200) NULL,
    BFatherName NVARCHAR(200) NULL,
    BFatherSurname NVARCHAR(200) NULL,
    BPartnershipStatus NVARCHAR(100) NULL,
    BDissolutionStatus NVARCHAR(100) NULL,
    BPartnershipState NVARCHAR(100) NULL,
    BParentsMarried NVARCHAR(10) NULL,
    BBloodRelative INT NULL,
    BBloodDescr NVARCHAR(400) NULL,
    BBirthplace NVARCHAR(200) NULL,
    BBirthState NVARCHAR(100) NULL,
    BSexNum NVARCHAR(20) NULL,
    BSex NVARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO
