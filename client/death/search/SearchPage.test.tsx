import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import Router from 'next/router';

import { GaSiteAnalytics } from '@cityofboston/next-client-common';

import { DeathCertificate, DeathCertificateSearchResults } from '../../types';
import DeathCertificatesDao from '../../dao/DeathCertificatesDao';

import DeathCertificateCart from '../../store/DeathCertificateCart';
import SearchPage from './SearchPage';

import {
  TYPICAL_CERTIFICATE,
  PENDING_CERTIFICATE,
  NO_DATE_CERTIFICATE,
} from '../../../fixtures/client/death-certificates';

jest.mock('next/router');
jest.mock('../../dao/DeathCertificatesDao');

const TEST_DEATH_CERTIFICATES: DeathCertificate[] = [
  TYPICAL_CERTIFICATE,
  PENDING_CERTIFICATE,
  NO_DATE_CERTIFICATE,
];

const TEST_SEARCH_RESULTS: DeathCertificateSearchResults = {
  results: TEST_DEATH_CERTIFICATES,
  resultCount: 50,
  page: 0,
  pageSize: 5,
  pageCount: 10,
};

describe('getInitialProps', () => {
  let deathCertificatesDao;

  beforeEach(() => {
    deathCertificatesDao = new DeathCertificatesDao(null as any);
  });

  it('works with no query', async () => {
    const initialProps = await SearchPage.getInitialProps(
      { query: {} },
      { deathCertificatesDao }
    );

    expect(initialProps).toMatchSnapshot();
  });

  it('searches when given a query', async () => {
    deathCertificatesDao.search.mockReturnValue(TEST_SEARCH_RESULTS);

    const initialProps = await SearchPage.getInitialProps(
      { query: { q: 'Monkey Joe' } },
      { deathCertificatesDao }
    );

    expect(initialProps).toMatchSnapshot();
    expect(deathCertificatesDao.search).toHaveBeenCalledWith('Monkey Joe', 1);
  });
});

describe('operations', () => {
  let component;

  beforeEach(() => {
    component = new SearchPage({
      page: 1,
      query: '',
      results: null,
      siteAnalytics: new GaSiteAnalytics(),
      deathCertificateCart: new DeathCertificateCart(),
    });
  });

  describe('submitSearch', () => {
    it('redirects to search for a query', () => {
      component.submitSearch('Monkey Joe');
      expect(Router.push).toHaveBeenCalledWith('/death?q=Monkey%20Joe');
    });

    it('trims the query', () => {
      component.submitSearch('Monkey Joe   ');
      expect(Router.push).toHaveBeenCalledWith('/death?q=Monkey%20Joe');
    });
  });
});

describe('content', () => {
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(
      <SearchPage
        query={'Jayn Doe'}
        page={1}
        results={null}
        siteAnalytics={new GaSiteAnalytics()}
        deathCertificateCart={new DeathCertificateCart()}
      />
    ));
  });

  it('defaults to the passed-in query', () => {
    const queryField = container.querySelector(
      'input[name="q"]'
    ) as HTMLInputElement;
    expect(queryField.value).toEqual('Jayn Doe');
  });

  it('changes query input and submits it', () => {
    const form = container.querySelector('form') as HTMLFormElement;
    const queryField = container.querySelector(
      'input[name="q"]'
    ) as HTMLInputElement;

    fireEvent.change(queryField, { target: { value: 'Monkey Joe' } });
    fireEvent.submit(form);

    expect(Router.push).toHaveBeenCalledWith('/death?q=Monkey%20Joe');
  });
});
