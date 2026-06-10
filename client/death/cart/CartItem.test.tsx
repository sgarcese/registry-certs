import React from 'react';
import { render } from '@testing-library/react';

import { GaSiteAnalytics } from '@cityofboston/next-client-common';

import DeathCertificateCart, {
  DeathCertificateCartEntry,
} from '../../store/DeathCertificateCart';

import CartItem from './CartItem';
import { TYPICAL_CERTIFICATE } from '../../../fixtures/client/death-certificates';

jest.mock('../../store/DeathCertificateCart');

describe('quantity field', () => {
  let entry: DeathCertificateCartEntry;
  let cart;
  let siteAnalytics;

  beforeEach(() => {
    entry = new DeathCertificateCartEntry();
    entry.id = TYPICAL_CERTIFICATE.id;
    entry.cert = TYPICAL_CERTIFICATE;
    entry.quantity = 4;

    cart = new DeathCertificateCart();
    siteAnalytics = new GaSiteAnalytics();
  });

  it('renders the cart item', () => {
    const { container } = render(
      <CartItem
        cart={cart}
        siteAnalytics={siteAnalytics}
        entry={entry}
        lastRow
      />
    );

    expect(container).toBeTruthy();
  });
});
