import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import Order from '../../models/Order';
import Cart from '../../store/DeathCertificateCart';
import { OrderErrorCause } from '../../queries/graphql-types';
import { SubmissionError } from '../../dao/CheckoutDao';

import ReviewContent from './ReviewContent';

describe('submitting', () => {
  let order;
  let cart;
  let submit: jest.Mock;
  let container: HTMLElement;

  beforeEach(() => {
    cart = new Cart();
    order = new Order();
    submit = jest.fn();

    ({ container } = render(
      <ReviewContent
        order={order}
        certificateType="death"
        deathCertificateCart={cart}
        submit={submit}
        tracking={true}
      />
    ));
  });

  it('reuses the idempotency key for overlapping requests', async () => {
    const form = container.querySelector('form[method="post"]') as HTMLFormElement;

    submit.mockReturnValue(Promise.resolve());
    fireEvent.submit(form);
    await Promise.resolve();

    const idempotencyKey = order.idempotencyKey;

    submit.mockReturnValue(Promise.resolve());
    fireEvent.submit(form);
    await Promise.resolve();

    expect(order.idempotencyKey).toEqual(idempotencyKey);
  });

  it('generates a new idempotency key if the first request failed', async () => {
    const form = container.querySelector('form[method="post"]') as HTMLFormElement;

    submit.mockReturnValue(
      Promise.reject(
        new SubmissionError('Card processing failed', OrderErrorCause.INTERNAL)
      )
    );
    fireEvent.submit(form);
    await Promise.resolve();

    const idempotencyKey = order.idempotencyKey;

    submit.mockReturnValue(
      Promise.reject(
        new SubmissionError(
          'Card processing failed again',
          OrderErrorCause.INTERNAL
        )
      )
    );
    fireEvent.submit(form);
    await Promise.resolve();

    expect(order.idempotencyKey).not.toEqual(idempotencyKey);
  });
});
