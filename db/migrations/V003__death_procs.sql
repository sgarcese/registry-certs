-- Stub implementations of the Registry death-certificate search procs.
-- Contract: the recordset shapes match the DeathCertificate /
-- DeathCertificateSearchResult interfaces in server/services/RegistryDb.ts.

USE [Registry];
GO

CREATE OR ALTER PROCEDURE Death.sp_FindCertificatesWeb
  @searchFor NVARCHAR(200),
  @pageNumber INT,
  @pageSize INT,
  @sortBy NVARCHAR(50) = 'dateOfDeath',
  @startYear NVARCHAR(8) = NULL,
  @endYear NVARCHAR(8) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @page INT = CASE WHEN @pageNumber < 1 THEN 1 ELSE @pageNumber END;

  SELECT
    CertificateID,
    RegisteredNumber AS [Registered Number],
    InOut,
    DateOfDeath AS [Date of Death],
    DecedentName AS [Decedent Name],
    LastName AS [Last Name],
    FirstName AS [First Name],
    RegisteredYear,
    AgeOrDateOfBirth,
    Pending,
    COUNT(*) OVER () AS ResultCount
  FROM Death.Certificates
  WHERE DecedentName LIKE '%' + UPPER(@searchFor) + '%'
    AND (@startYear IS NULL OR RegisteredYear >= @startYear)
    AND (@endYear IS NULL OR RegisteredYear <= @endYear)
  ORDER BY
    CASE WHEN @sortBy = 'dateOfDeath' THEN RegisteredYear END DESC,
    LastName,
    FirstName
  OFFSET (@page - 1) * @pageSize ROWS
  FETCH NEXT @pageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE Death.sp_GetCertificatesWeb
  @idList NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    c.CertificateID,
    c.RegisteredNumber AS [Registered Number],
    c.InOut,
    c.DateOfDeath AS [Date of Death],
    c.DecedentName AS [Decedent Name],
    c.LastName AS [Last Name],
    c.FirstName AS [First Name],
    c.RegisteredYear,
    c.AgeOrDateOfBirth,
    c.Pending
  FROM Death.Certificates c
  JOIN STRING_SPLIT(@idList, ',') ids
    ON c.CertificateID = TRY_CONVERT(INT, LTRIM(RTRIM(ids.value)));
END
GO
