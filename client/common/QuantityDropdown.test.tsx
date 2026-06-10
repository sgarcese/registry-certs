import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import QuantityDropdown from './QuantityDropdown';

describe('QuantityDropdown', () => {
  let container: HTMLElement;

  const getInput = () => container.querySelector('input') as HTMLInputElement;
  const getSelect = () =>
    container.querySelector('select') as HTMLSelectElement;

  beforeEach(() => {
    ({ container } = render(
      <QuantityDropdown quantity={1} handleQuantityChange={jest.fn()} />
    ));
  });

  it('Changes input field quantity when dropdown is used', () => {
    expect(getInput().value).toEqual('1');

    fireEvent.change(getSelect(), { target: { value: '5' } });

    expect(getSelect().value).toEqual('5');
  });

  it('Changes select value when user types a new value in the input field', () => {
    expect(getSelect().value).toBe('1');

    fireEvent.change(getInput(), { target: { value: '5' } });

    expect(getSelect().value).toEqual('5');
  });

  it('Changes select value to “other” if a value greater than 10 is typed in the field input', () => {
    expect(getSelect().value).toBe('1');

    fireEvent.change(getInput(), { target: { value: '13' } });

    expect(getSelect().value).toEqual('other');
  });

  it('Moves focus to field input and clear value when “other” is selected in dropdown', () => {
    const fieldName = getInput().getAttribute('name');

    fireEvent.change(getSelect(), { target: { value: 'other' } });

    expect(document.activeElement!.getAttribute('name')).toEqual(fieldName);
  });
});
