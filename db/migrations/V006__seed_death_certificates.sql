-- Seed data so the death-certificate search has plausible results in the
-- prototype environments. Names/shapes mirror fixtures/registry-data/*.json
-- (which were themselves faker-anonymized real responses).

USE [Registry];
GO

IF NOT EXISTS (SELECT 1 FROM Death.Certificates)
BEGIN
  INSERT INTO Death.Certificates (
    CertificateID, RegisteredNumber, InOut, DateOfDeath, DecedentName,
    LastName, FirstName, RegisteredYear, AgeOrDateOfBirth, Pending
  )
  VALUES
    (640768, '926',  'I', '01/12/2005', 'RYAN C SMITH',       'SMITH',     'RYAN C',    '2005', '54',  0),
    (640769, '927',  'I', '02/12/2017', 'MAUDIE SMITH',       'SMITH',     'MAUDIE',    '2017', '83',  0),
    (640770, '928',  '*', '03/05/2017', 'JAYNE DOE SMITH',    'SMITH',     'JAYNE DOE', '2017', '61',  0),
    (640771, '929',  'I', '07/22/2019', 'WILLIAM J SMITH',    'SMITH',     'WILLIAM J', '2019', '77',  0),
    (640772, '930',  'I', '11/02/2019', 'ANGELICA SMITH',     'SMITH',     'ANGELICA',  '2019', '90',  0),
    (640773, '931',  'I', NULL,         'PENDING P SMITH',    'SMITH',     'PENDING P', '2024', '000', 1),
    (640774, '932',  'I', '04/18/2012', 'JOHN PHILL',         'PHILL',     'JOHN',      '2012', '66',  0),
    (640775, '933',  '#', '09/30/2015', 'MARY ANN PHILL',     'PHILL',     'MARY ANN',  '2015', '72',  0),
    (640776, '934',  'I', '05/14/2021', 'ROBERT KILLPATRICK', 'KILLPATRICK', 'ROBERT',  '2021', '58',  0),
    (640777, '935',  'I', '12/01/2022', 'DOREEN GREEN',       'GREEN',     'DOREEN',    '2022', '25',  0);
END
GO
