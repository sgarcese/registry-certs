-- Stub implementations of the Commerce order procs. Contracts (param lists,
-- recordset shapes, returnValue conventions) come from the .input()/.execute()
-- call sites in server/services/RegistryDb.ts.

USE [$(APP_DB)];
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddOrder
  @orderID NVARCHAR(40),
  @orderType CHAR(3),
  @orderDate DATETIME2,
  @contactName NVARCHAR(200),
  @contactEmail NVARCHAR(200),
  @contactPhone NVARCHAR(50),
  @shippingName NVARCHAR(200),
  @shippingCompany NVARCHAR(200),
  @shippingAddr1 NVARCHAR(200),
  @shippingAddr2 NVARCHAR(200),
  @shippingCity NVARCHAR(100),
  @shippingState NVARCHAR(20),
  @shippingZIP NVARCHAR(20),
  @billingName NVARCHAR(200),
  @billingAddr1 NVARCHAR(200),
  @billingAddr2 NVARCHAR(200),
  @billingCity NVARCHAR(100),
  @billingState NVARCHAR(20),
  @billingZIP NVARCHAR(20),
  @billingLast4 NVARCHAR(8),
  @serviceFee MONEY,
  @certifiedMail BIT,
  @idempotencyKey NVARCHAR(64)
AS
BEGIN
  SET NOCOUNT ON;

  -- Idempotent on the client-generated key: resubmitting the same order
  -- returns the original OrderKey instead of double-charging.
  DECLARE @existingKey INT = (
    SELECT OrderKey FROM Commerce.Orders WHERE IdempotencyKey = @idempotencyKey
  );

  IF @existingKey IS NOT NULL
  BEGIN
    SELECT @existingKey AS OrderKey, CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
    RETURN 0;
  END

  INSERT INTO Commerce.Orders (
    OrderID, OrderType, OrderDate,
    ContactName, ContactEmail, ContactPhone,
    ShippingName, ShippingCompany, ShippingAddr1, ShippingAddr2,
    ShippingCity, ShippingState, ShippingZIP,
    BillingName, BillingAddr1, BillingAddr2, BillingCity, BillingState,
    BillingZIP, BillingLast4,
    ServiceFee, CertifiedMail, IdempotencyKey
  )
  VALUES (
    @orderID, @orderType, @orderDate,
    @contactName, @contactEmail, @contactPhone,
    @shippingName, @shippingCompany, @shippingAddr1, @shippingAddr2,
    @shippingCity, @shippingState, @shippingZIP,
    @billingName, @billingAddr1, @billingAddr2, @billingCity, @billingState,
    @billingZIP, @billingLast4,
    @serviceFee, @certifiedMail, @idempotencyKey
  );

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS OrderKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddOrderItem
  @orderKey INT,
  @orderType CHAR(3),
  @certificateID INT,
  @certificateName NVARCHAR(200),
  @quantity INT,
  @unitCost MONEY
AS
BEGIN
  SET NOCOUNT ON;

  -- An empty recordset signals "no such certificate" to the caller.
  IF NOT EXISTS (
    SELECT 1 FROM Registry.Death.Certificates WHERE CertificateID = @certificateID
  )
  BEGIN
    RETURN 0;
  END

  INSERT INTO Commerce.OrderItems (
    OrderKey, OrderType, CertificateID, CertificateName, Quantity, UnitCost
  )
  VALUES (@orderKey, @orderType, @certificateID, @certificateName, @quantity, @unitCost);

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS OrderItemKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddBirthRequest
  @orderKey INT,
  @orderType CHAR(3),
  @certificateLastName NVARCHAR(100),
  @certificateFirstName NVARCHAR(100),
  @alternativeSpellings NVARCHAR(400),
  @dateOfBirth DATETIME2,
  @parent1LastName NVARCHAR(100),
  @parent1FirstName NVARCHAR(100),
  @parent2LastName NVARCHAR(100),
  @parent2FirstName NVARCHAR(100),
  @requestDetails NVARCHAR(MAX),
  @quantity INT,
  @unitCost MONEY
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO Commerce.BirthRequests (
    OrderKey, CertificateLastName, CertificateFirstName, AlternativeSpellings,
    DateOfBirth, Parent1LastName, Parent1FirstName, Parent2LastName,
    Parent2FirstName, RequestDetails, Quantity, UnitCost
  )
  VALUES (
    @orderKey, @certificateLastName, @certificateFirstName, @alternativeSpellings,
    @dateOfBirth, @parent1LastName, @parent1FirstName, @parent2LastName,
    @parent2FirstName, @requestDetails, @quantity, @unitCost
  );

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS RequestItemKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddMarriageRequest
  @orderKey INT,
  @orderType CHAR(3),
  @certificateFullName1 NVARCHAR(200),
  @certificateFullName2 NVARCHAR(200),
  @certificateMaidenName1 NVARCHAR(200),
  @certificateMaidenName2 NVARCHAR(200),
  @certificateAltSpellings1 NVARCHAR(400),
  @certificateAltSpellings2 NVARCHAR(400),
  -- The caller passes exactly one of these two.
  @dateOfMarriageExact DATETIME2 = NULL,
  @dateOfMarriageUnsure NVARCHAR(100) = NULL,
  @requestDetails NVARCHAR(MAX),
  @quantity INT,
  @unitCost MONEY
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO Commerce.MarriageRequests (
    OrderKey, CertificateFullName1, CertificateFullName2,
    CertificateMaidenName1, CertificateMaidenName2,
    CertificateAltSpellings1, CertificateAltSpellings2,
    DateOfMarriageExact, DateOfMarriageUnsure,
    RequestDetails, Quantity, UnitCost
  )
  VALUES (
    @orderKey, @certificateFullName1, @certificateFullName2,
    @certificateMaidenName1, @certificateMaidenName2,
    @certificateAltSpellings1, @certificateAltSpellings2,
    @dateOfMarriageExact, @dateOfMarriageUnsure,
    @requestDetails, @quantity, @unitCost
  );

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS RequestItemKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddPayment
  @orderKey INT,
  @paymentDate DATETIME2,
  @paymentDescription NVARCHAR(200),
  @transactionID NVARCHAR(100),
  @paymentAmount MONEY
AS
BEGIN
  SET NOCOUNT ON;

  -- Idempotent per order: webhook retries must not create duplicate rows.
  IF EXISTS (SELECT 1 FROM Commerce.Payments WHERE OrderKey = @orderKey)
  BEGIN
    UPDATE Commerce.Payments
    SET PaymentDate = @paymentDate,
        PaymentDescription = @paymentDescription,
        TransactionID = @transactionID,
        PaymentAmount = @paymentAmount
    WHERE OrderKey = @orderKey;
  END
  ELSE
  BEGIN
    INSERT INTO Commerce.Payments (
      OrderKey, PaymentDate, PaymentDescription, TransactionID, PaymentAmount
    )
    VALUES (@orderKey, @paymentDate, @paymentDescription, @transactionID, @paymentAmount);
  END

  UPDATE Commerce.Orders SET OrderStatus = 'paid' WHERE OrderKey = @orderKey;

  SELECT 1 AS Success;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_FindOrder
  @orderID NVARCHAR(40)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    o.OrderKey,
    o.OrderType,
    o.OrderDate,
    o.OrderStatus,
    CONVERT(NVARCHAR(30), o.ProcessDtTm, 120) AS ProcessDtTm,
    o.ContactName,
    o.ContactEmail,
    o.ContactPhone,
    o.ShippingName,
    o.ShippingCompany,
    o.ShippingAddr1,
    o.ShippingAddr2,
    o.ShippingCity,
    o.ShippingState,
    o.ShippingZIP,
    o.BillingName,
    o.BillingAddr1,
    o.BillingAddr2,
    o.BillingCity,
    o.BillingState,
    o.BillingZIP,
    ISNULL(items.CertificateIDs, '') AS CertificateIDs,
    ISNULL(items.CertificateQuantities, '') AS CertificateQuantities,
    ISNULL(items.CertificateCost, requests.RequestCost) AS CertificateCost,
    o.ServiceFee,
    ISNULL(items.CertificateCost, requests.RequestCost)
      + o.ServiceFee
      + CASE WHEN o.CertifiedMail = 1 THEN 5.00 ELSE 0.00 END AS TotalCost,
    o.CertifiedMail
  FROM Commerce.Orders o
  OUTER APPLY (
    SELECT
      STRING_AGG(CAST(i.CertificateID AS NVARCHAR(20)), ',') AS CertificateIDs,
      STRING_AGG(CAST(i.Quantity AS NVARCHAR(20)), ',') AS CertificateQuantities,
      SUM(i.Quantity * i.UnitCost) AS CertificateCost
    FROM Commerce.OrderItems i
    WHERE i.OrderKey = o.OrderKey
    HAVING COUNT(*) > 0
  ) items
  OUTER APPLY (
    SELECT ISNULL((
      SELECT SUM(b.Quantity * b.UnitCost)
      FROM Commerce.BirthRequests b WHERE b.OrderKey = o.OrderKey
    ), (
      SELECT SUM(m.Quantity * m.UnitCost)
      FROM Commerce.MarriageRequests m WHERE m.OrderKey = o.OrderKey
    )) AS RequestCost
  ) requests
  WHERE o.OrderID = @orderID;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_FindBirthCertificateRequest
  @orderID NVARCHAR(40)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    b.CertificateFirstName,
    b.CertificateLastName,
    b.DateOfBirth,
    b.Quantity,
    -- TotalCost mirrors what the receipt math expects: items plus the $5
    -- certified-mail tracking fee when it applies.
    b.Quantity * b.UnitCost
      + CASE WHEN o.CertifiedMail = 1 THEN 5.00 ELSE 0.00 END AS TotalCost
  FROM Commerce.BirthRequests b
  JOIN Commerce.Orders o ON o.OrderKey = b.OrderKey
  WHERE o.OrderID = @orderID;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_FindMarriageCertificateRequest
  @orderID NVARCHAR(40)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    m.CertificateFullName1,
    m.CertificateFullName2,
    m.CertificateMaidenName1,
    m.CertificateMaidenName2,
    m.CertificateAltSpellings1,
    m.CertificateAltSpellings2,
    m.DateOfMarriageExact,
    m.DateOfMarriageUnsure,
    m.Quantity,
    m.Quantity * m.UnitCost
      + CASE WHEN o.CertifiedMail = 1 THEN 5.00 ELSE 0.00 END AS TotalCost
  FROM Commerce.MarriageRequests m
  JOIN Commerce.Orders o ON o.OrderKey = m.OrderKey
  WHERE o.OrderID = @orderID;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_CancelOrder
  @orderKey INT,
  @reason NVARCHAR(400)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE Commerce.Orders
  SET OrderStatus = 'canceled',
      CancelReason = @reason,
      ProcessDtTm = SYSUTCDATETIME()
  WHERE OrderKey = @orderKey;

  RETURN 0;
END
GO
