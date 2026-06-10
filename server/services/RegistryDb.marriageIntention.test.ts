import RegistryDb, {
  MarriageIntentionCertificateRequestArgs,
} from './RegistryDb';

/**
 * Regression tests for two confirmed defects fixed during the standalone-repo
 * migration (see analysis/registry-certs/ASSESSMENT.md in the monorepo):
 *
 *  1. B_ZipCode was populated from partner A's country for foreign residents.
 *  2. An empty recordset from the insert proc returned a fake success key
 *     (12345) instead of failing.
 */

function makeArgs(
  overrides: Partial<MarriageIntentionCertificateRequestArgs> = {}
): MarriageIntentionCertificateRequestArgs {
  const base: any = {};

  // Every field in the args interface is a string; fill them all with
  // plausible defaults.
  const fields = [
    'Email',
    'DayPhone',
    ...['A', 'B'].flatMap(p => [
      `${p}ApplicantFName`,
      `${p}ApplicantLName`,
      `${p}ApplicantMiddleName`,
      `${p}ApplicantSuffix`,
      `${p}PostmarriageSurname`,
      `${p}DOB`,
      `${p}CurrentAge`,
      `${p}Occupation`,
      `${p}FatherName`,
      `${p}MotherName`,
      `${p}FatherSurname`,
      `${p}MotherSurname`,
      `${p}StreetAddress`,
      `${p}City`,
      `${p}State`,
      `${p}ZIPCode`,
      `${p}ResidenceCountry`,
      `${p}MarriageNumber`,
      `${p}StatofLastMarriage`,
      `${p}PartnershipStatus`,
      `${p}DissolutionStatus`,
      `${p}PartnershipState`,
      `${p}ParentsMarried`,
      `${p}BloodRelative`,
      `${p}BloodDescr`,
      `${p}Birthplace`,
      `${p}BirthState`,
      `${p}BirthCountry`,
      `${p}SexNum`,
      `${p}Sex`,
      `${p}BirthHospital`,
    ]),
  ];

  for (const f of fields) {
    base[f] = 'X';
  }

  Object.assign(base, {
    Email: 'test@example.com',
    DayPhone: '555-555-5555',
    ADOB: '1990-01-01',
    BDOB: '1990-01-01',
    ACurrentAge: '30',
    BCurrentAge: '30',
    AMarriageNumber: '1|First',
    BMarriageNumber: '1|First',
    ASexNum: '1|MALE',
    BSexNum: '2|FEMALE',
    ASex: '1|MALE',
    BSex: '2|FEMALE',
    ABloodRelative: '0',
    BBloodRelative: '0',
    AParentsMarried: '1',
    BParentsMarried: '1',
    AZIPCode: '02118',
    BZIPCode: '02118',
    AResidenceCountry: 'USA',
    BResidenceCountry: 'USA',
    ABirthplace: 'BOSTON',
    BBirthplace: 'BOSTON',
    ABirthCountry: 'USA',
    BBirthCountry: 'USA',
  });

  return { ...base, ...overrides };
}

function makeDbWithCapturedInputs(recordset: any[] | undefined) {
  const inputs: { [name: string]: unknown } = {};

  const request: any = {
    input(name: string, value: unknown) {
      inputs[name] = value;
      return request;
    },
    execute: jest.fn().mockResolvedValue({ recordset }),
  };

  const pool: any = { request: () => request };

  return { db: new RegistryDb(pool), inputs };
}

describe('addMarriageIntentionCertificateRequest', () => {
  it("uses partner B's own country for B_ZipCode when B lives abroad", async () => {
    const { db, inputs } = makeDbWithCapturedInputs([{ Inserted_ID: 99 }]);

    await db.addMarriageIntentionCertificateRequest(
      makeArgs({
        AResidenceCountry: 'USA',
        AZIPCode: '02118',
        BResidenceCountry: 'FRA',
        BZIPCode: '',
      })
    );

    // The legacy bug copied A's country into B's zip field.
    expect(inputs['BZIPCode']).toEqual('FRA');
  });

  it("keeps B's real ZIP when B lives in the USA", async () => {
    const { db, inputs } = makeDbWithCapturedInputs([{ Inserted_ID: 99 }]);

    await db.addMarriageIntentionCertificateRequest(
      makeArgs({
        BResidenceCountry: 'USA',
        BZIPCode: '02144',
      })
    );

    expect(inputs['BZIPCode']).toEqual('02144');
  });

  it('throws on an empty recordset instead of returning a fake key', async () => {
    const { db } = makeDbWithCapturedInputs([]);

    await expect(
      db.addMarriageIntentionCertificateRequest(makeArgs())
    ).rejects.toThrow(/recordset.*came back empty/i);
  });
});
