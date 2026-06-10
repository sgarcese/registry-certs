/* eslint no-console: 0 */

/**
 * Integration smoke test: exercises the stub stored procedures through the
 * real RegistryDb class (the same code path production uses). Run against
 * docker-compose locally or dev RDS from CodeBuild.
 *
 * Usage: env vars as in .env.sample, then:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/db-smoke.ts
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

import { makeRegistryDbFactory, OrderType } from '../server/services/RegistryDb';

dotenv.config();

async function main() {
  const rollbar: any = { error: (e: any) => console.error('rollbar:', e) };

  const factory = await makeRegistryDbFactory(rollbar, {
    username: process.env.REGISTRY_DATA_DB_USER!,
    password: process.env.REGISTRY_DATA_DB_PASSWORD!,
    server: process.env.REGISTRY_DATA_DB_SERVER!,
    database: process.env.REGISTRY_DATA_DB_DATABASE!,
  });

  const db = factory.registryDb();
  const failures: string[] = [];

  const check = (name: string, cond: boolean, detail?: unknown) => {
    console.log(`${cond ? 'ok ' : 'FAIL'}  ${name}`);
    if (!cond) {
      failures.push(name);
      if (detail !== undefined) console.log('      ', detail);
    }
  };

  try {
    // --- death search ---
    const results = await db.searchDeathCertificates('smith', 1, 5, null, null);
    check('sp_FindCertificatesWeb returns rows', results.length > 0);
    check(
      'search rows have ResultCount + CertificateID',
      results.length > 0 &&
        results[0].ResultCount > 0 &&
        !!results[0].CertificateID
    );

    const certId = results[0].CertificateID;
    const cert = await db.lookupDeathCertificate(String(certId));
    check('sp_GetCertificatesWeb finds by id', !!cert, cert);

    // --- death order: add order -> item -> payment -> find ---
    const orderId = `RG-DC202606-${1000000 + Math.floor(Math.random() * 8999999)}`;
    const idempotencyKey = crypto.randomBytes(16).toString('hex');

    const orderArgs = {
      orderID: orderId,
      orderDate: new Date(),
      contactName: 'Smoke Test',
      contactEmail: 'smoke@example.com',
      confirmContactEmail: 'smoke@example.com',
      contactPhone: '555-555-5555',
      shippingName: 'Smoke Test',
      shippingCompany: '',
      shippingAddr1: '1 City Hall Sq',
      shippingAddr2: '',
      shippingCity: 'Boston',
      shippingState: 'MA',
      shippingZIP: '02201',
      billingName: 'Smoke Test',
      billingAddr1: '1 City Hall Sq',
      billingAddr2: '',
      billingCity: 'Boston',
      billingState: 'MA',
      billingZIP: '02201',
      billingLast4: '4242',
      serviceFee: 0.86,
      idempotencyKey,
    };

    const orderKey = await db.addOrder(OrderType.DeathCertificate, false, orderArgs);
    check('sp_AddOrder returns OrderKey', orderKey > 0, orderKey);

    const orderKey2 = await db.addOrder(OrderType.DeathCertificate, false, orderArgs);
    check('sp_AddOrder is idempotent on idempotencyKey', orderKey2 === orderKey, {
      orderKey,
      orderKey2,
    });

    await db.addDeathCertificateItem(orderKey, certId, 'SMOKE TEST CERT', 2, 14);
    check('sp_AddOrderItem accepts a valid certificate', true);

    let badItemRejected = false;
    try {
      await db.addDeathCertificateItem(orderKey, 99999999, 'NOPE', 1, 14);
    } catch {
      badItemRejected = true;
    }
    check('sp_AddOrderItem rejects unknown certificate', badItemRejected);

    await db.addPayment(orderKey, new Date(), 'ch_smoke_123', 28.86);
    await db.addPayment(orderKey, new Date(), 'ch_smoke_123', 28.86);
    check('sp_AddPayment is idempotent per order', true);

    const found = await db.findOrder(orderId);
    check('sp_FindOrder returns the order', !!found && found.OrderKey === orderKey);
    check(
      'sp_FindOrder math: CertificateCost=28, TotalCost=28.86',
      !!found &&
        Number(found.CertificateCost) === 28 &&
        Number(found.TotalCost) === 28.86,
      found && {
        CertificateCost: found.CertificateCost,
        ServiceFee: found.ServiceFee,
        TotalCost: found.TotalCost,
      }
    );
    check('sp_FindOrder status is paid', !!found && found.OrderStatus === 'paid');

    // --- birth request + attachments ---
    const birthOrderId = `RG-BC202606-${1000000 + Math.floor(Math.random() * 8999999)}`;
    const birthOrderKey = await db.addOrder(OrderType.BirthCertificate, true, {
      ...orderArgs,
      orderID: birthOrderId,
      idempotencyKey: crypto.randomBytes(16).toString('hex'),
    });

    const sessionId = crypto.randomUUID();
    const attachmentKey = await db.uploadFileAttachment('BC', sessionId, 'ID front', {
      filename: 'id.jpg',
      headers: { 'content-type': 'image/jpeg' },
      payload: Buffer.from('not-really-a-jpeg'),
    });
    check('sp_AddBirthRequestAttachment returns key', !!attachmentKey, attachmentKey);

    const requestItemKey = await db.addBirthCertificateRequest(
      birthOrderKey,
      {
        certificateFirstName: 'Doreen',
        certificateLastName: 'Green',
        alternativeSpellings: '',
        dateOfBirth: new Date('1997-07-01T00:00:00Z'),
        parent1FirstName: 'Maureen',
        parent1LastName: 'Green',
        parent2FirstName: 'Dor',
        parent2LastName: 'Green',
        requestDetails: 'smoke test',
      },
      1,
      14
    );
    check('sp_AddBirthRequest returns RequestItemKey', requestItemKey > 0);

    await db.addUploadsToOrder('BC', requestItemKey, sessionId);
    check('sp_AssociateBirthAttachments succeeds', true);

    const birthDetails = await db.lookupBirthCertificateOrderDetails(birthOrderId);
    check(
      'sp_FindBirthCertificateRequest: TotalCost includes $5 tracking (14+5=19)',
      !!birthDetails && Number(birthDetails.TotalCost) === 19,
      birthDetails
    );

    const deleteError = await db.deleteFileAttachment('BC', sessionId, attachmentKey);
    check('sp_DeleteBirthRequestAttachment succeeds', deleteError === null, deleteError);

    const wrongSession = await db.deleteFileAttachment('BC', crypto.randomUUID(), attachmentKey);
    check('delete with wrong session is refused', typeof wrongSession === 'string');

    // --- marriage intention ---
    const intentionArgs: any = {};
    const partnerFields = (p: string) =>
      Object.assign(intentionArgs, {
        [`${p}ApplicantFName`]: 'Test',
        [`${p}ApplicantLName`]: 'Person',
        [`${p}ApplicantMiddleName`]: '',
        [`${p}ApplicantSuffix`]: '',
        [`${p}PostmarriageSurname`]: 'PERSON',
        [`${p}DOB`]: '1990-01-01',
        [`${p}CurrentAge`]: '36',
        [`${p}Occupation`]: 'Engineer',
        [`${p}StreetAddress`]: '1 Main St',
        [`${p}City`]: 'Boston',
        [`${p}State`]: 'MA',
        [`${p}ZIPCode`]: '02118',
        [`${p}ResidenceCountry`]: 'USA',
        [`${p}MarriageNumber`]: '1|First',
        [`${p}StatofLastMarriage`]: '',
        [`${p}PartnershipStatus`]: '',
        [`${p}DissolutionStatus`]: '',
        [`${p}PartnershipState`]: '',
        [`${p}ParentsMarried`]: '1',
        [`${p}BloodRelative`]: '0',
        [`${p}BloodDescr`]: '',
        [`${p}Birthplace`]: 'Boston',
        [`${p}BirthState`]: 'MA',
        [`${p}BirthCountry`]: 'USA',
        [`${p}SexNum`]: '1|MALE',
        [`${p}Sex`]: '1|MALE',
        [`${p}FatherName`]: 'F',
        [`${p}MotherName`]: 'M',
        [`${p}FatherSurname`]: 'FS',
        [`${p}MotherSurname`]: 'MS',
        [`${p}BirthHospital`]: '',
      });
    partnerFields('A');
    partnerFields('B');
    intentionArgs.Email = 'smoke@example.com';
    intentionArgs.DayPhone = '555-555-5555';

    const intentionKey = await db.addMarriageIntentionCertificateRequest(intentionArgs);
    check('sp_digital_insert_marriage_intention returns key', intentionKey > 0, intentionKey);
  } finally {
    await factory.cleanup();
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }

  console.log('\nAll DB smoke checks passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
