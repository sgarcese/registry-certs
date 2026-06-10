-- Attachment procs (birth + marriage variants share implementations) and the
-- marriage-intention insert proc.

USE [$(APP_DB)];
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddBirthRequestAttachment
  @sessionUID NVARCHAR(64),
  @contentType NVARCHAR(200),
  @fileName NVARCHAR(400),
  @label NVARCHAR(400) = NULL,
  @attachmentData VARBINARY(MAX)
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO Commerce.Attachments (
    OrderType, SessionUID, ContentType, [FileName], Label, AttachmentData
  )
  VALUES ('BC', @sessionUID, @contentType, @fileName, @label, @attachmentData);

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS AttachmentKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AddMarriageRequestAttachment
  @sessionUID NVARCHAR(64),
  @contentType NVARCHAR(200),
  @fileName NVARCHAR(400),
  @label NVARCHAR(400) = NULL,
  @attachmentData VARBINARY(MAX)
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO Commerce.Attachments (
    OrderType, SessionUID, ContentType, [FileName], Label, AttachmentData
  )
  VALUES ('MC', @sessionUID, @contentType, @fileName, @label, @attachmentData);

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS AttachmentKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_DeleteBirthRequestAttachment
  @sessionUID NVARCHAR(64),
  @attachmentKey INT
AS
BEGIN
  SET NOCOUNT ON;

  -- Ownership check: the attachment must belong to this upload session.
  IF NOT EXISTS (
    SELECT 1 FROM Commerce.Attachments
    WHERE AttachmentKey = @attachmentKey AND SessionUID = @sessionUID
  )
  BEGIN
    SELECT CAST('Attachment not found for session' AS NVARCHAR(400)) AS ErrorMessage;
    RETURN 0;
  END

  UPDATE Commerce.Attachments
  SET Deleted = 1
  WHERE AttachmentKey = @attachmentKey AND SessionUID = @sessionUID;

  SELECT CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_DeleteMarriageRequestAttachment
  @sessionUID NVARCHAR(64),
  @attachmentKey INT
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (
    SELECT 1 FROM Commerce.Attachments
    WHERE AttachmentKey = @attachmentKey AND SessionUID = @sessionUID
  )
  BEGIN
    SELECT CAST('Attachment not found for session' AS NVARCHAR(400)) AS ErrorMessage;
    RETURN 0;
  END

  UPDATE Commerce.Attachments
  SET Deleted = 1
  WHERE AttachmentKey = @attachmentKey AND SessionUID = @sessionUID;

  SELECT CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AssociateBirthAttachments
  @requestItemKey INT,
  @sessionUID NVARCHAR(64)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE Commerce.Attachments
  SET RequestItemKey = @requestItemKey
  WHERE SessionUID = @sessionUID AND Deleted = 0;

  SELECT CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

CREATE OR ALTER PROCEDURE Commerce.sp_AssociateMarriageAttachments
  @requestItemKey INT,
  @sessionUID NVARCHAR(64)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE Commerce.Attachments
  SET RequestItemKey = @requestItemKey
  WHERE SessionUID = @sessionUID AND Deleted = 0;

  SELECT CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO

USE [MarriageRegistry];
GO

CREATE OR ALTER PROCEDURE dbo.sp_digital_insert_marriage_intention
  @Email NVARCHAR(200),
  @DayPhone NVARCHAR(50),
  @AApplicantFName NVARCHAR(100),
  @AApplicantLName NVARCHAR(100),
  @APostmarriageSurname NVARCHAR(200) = NULL,
  @ADOB DATETIME2 = NULL,
  @ACurrentAge NVARCHAR(10) = NULL,
  @AOccupation NVARCHAR(200) = NULL,
  @AStreetAddress NVARCHAR(400) = NULL,
  @ACity NVARCHAR(100) = NULL,
  @AState NVARCHAR(50) = NULL,
  @AZIPCode NVARCHAR(100) = NULL,
  @AMarriageNumber NVARCHAR(50) = NULL,
  @AStatofLastMarriage NVARCHAR(100) = NULL,
  @AMotherName NVARCHAR(200) = NULL,
  @AMotherSurname NVARCHAR(200) = NULL,
  @AFatherName NVARCHAR(200) = NULL,
  @AFatherSurname NVARCHAR(200) = NULL,
  @APartnershipStatus NVARCHAR(100) = NULL,
  @ADissolutionStatus NVARCHAR(100) = NULL,
  @APartnershipState NVARCHAR(100) = NULL,
  @AParentsMarried NVARCHAR(10) = NULL,
  @ABloodRelative INT = NULL,
  @ABloodDescr NVARCHAR(400) = NULL,
  @ABirthplace NVARCHAR(200) = NULL,
  @ABirthState NVARCHAR(100) = NULL,
  @ASexNum NVARCHAR(20) = NULL,
  @ASex NVARCHAR(50) = NULL,
  @BApplicantFName NVARCHAR(100),
  @BApplicantLName NVARCHAR(100),
  @BPostmarriageSurname NVARCHAR(200) = NULL,
  @BDOB DATETIME2 = NULL,
  @BCurrentAge NVARCHAR(10) = NULL,
  @BOccupation NVARCHAR(200) = NULL,
  @BStreetAddress NVARCHAR(400) = NULL,
  @BCity NVARCHAR(100) = NULL,
  @BState NVARCHAR(50) = NULL,
  @BZIPCode NVARCHAR(100) = NULL,
  @BMarriageNumber NVARCHAR(50) = NULL,
  @BStatofLastMarriage NVARCHAR(100) = NULL,
  @BMotherName NVARCHAR(200) = NULL,
  @BMotherSurname NVARCHAR(200) = NULL,
  @BFatherName NVARCHAR(200) = NULL,
  @BFatherSurname NVARCHAR(200) = NULL,
  @BPartnershipStatus NVARCHAR(100) = NULL,
  @BDissolutionStatus NVARCHAR(100) = NULL,
  @BPartnershipState NVARCHAR(100) = NULL,
  @BParentsMarried NVARCHAR(10) = NULL,
  @BBloodRelative INT = NULL,
  @BBloodDescr NVARCHAR(400) = NULL,
  @BBirthplace NVARCHAR(200) = NULL,
  @BBirthState NVARCHAR(100) = NULL,
  @BSexNum NVARCHAR(20) = NULL,
  @BSex NVARCHAR(50) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.MarriageIntentions (
    Email, DayPhone,
    AApplicantFName, AApplicantLName, APostmarriageSurname, ADOB, ACurrentAge,
    AOccupation, AStreetAddress, ACity, AState, AZIPCode, AMarriageNumber,
    AStatofLastMarriage, AMotherName, AMotherSurname, AFatherName,
    AFatherSurname, APartnershipStatus, ADissolutionStatus, APartnershipState,
    AParentsMarried, ABloodRelative, ABloodDescr, ABirthplace, ABirthState,
    ASexNum, ASex,
    BApplicantFName, BApplicantLName, BPostmarriageSurname, BDOB, BCurrentAge,
    BOccupation, BStreetAddress, BCity, BState, BZIPCode, BMarriageNumber,
    BStatofLastMarriage, BMotherName, BMotherSurname, BFatherName,
    BFatherSurname, BPartnershipStatus, BDissolutionStatus, BPartnershipState,
    BParentsMarried, BBloodRelative, BBloodDescr, BBirthplace, BBirthState,
    BSexNum, BSex
  )
  VALUES (
    @Email, @DayPhone,
    @AApplicantFName, @AApplicantLName, @APostmarriageSurname, @ADOB, @ACurrentAge,
    @AOccupation, @AStreetAddress, @ACity, @AState, @AZIPCode, @AMarriageNumber,
    @AStatofLastMarriage, @AMotherName, @AMotherSurname, @AFatherName,
    @AFatherSurname, @APartnershipStatus, @ADissolutionStatus, @APartnershipState,
    @AParentsMarried, @ABloodRelative, @ABloodDescr, @ABirthplace, @ABirthState,
    @ASexNum, @ASex,
    @BApplicantFName, @BApplicantLName, @BPostmarriageSurname, @BDOB, @BCurrentAge,
    @BOccupation, @BStreetAddress, @BCity, @BState, @BZIPCode, @BMarriageNumber,
    @BStatofLastMarriage, @BMotherName, @BMotherSurname, @BFatherName,
    @BFatherSurname, @BPartnershipStatus, @BDissolutionStatus, @BPartnershipState,
    @BParentsMarried, @BBloodRelative, @BBloodDescr, @BBirthplace, @BBirthState,
    @BSexNum, @BSex
  );

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS RequestItemKey,
         CAST(NULL AS NVARCHAR(400)) AS ErrorMessage;
  RETURN 0;
END
GO
