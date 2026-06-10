import { RefObject } from 'react';
import { FormikProps } from 'formik';

/**
 * Given a ref to a Formik component's bag (wired via Formik 2's innerRef),
 * runs its validator and automatically touches any fields that have both
 * errors and values.
 *
 * Useful to run Formik when it’s initialized with values that might not be
 * valid.
 */
export async function runInitialValidation<T>(ref: RefObject<FormikProps<T>>) {
  // This function is often run from componentDidMount. This "await" delays
  // our ref.current check by a tick so we don't act on an unmounted
  // component.
  await Promise.resolve('TICK');

  const errors = ref.current ? await ref.current.validateForm() : {};

  // We might have unmounted while awaiting the errors, so we have to check
  // again.
  if (ref.current) {
    const { setFieldTouched, values } = ref.current;
    Object.keys(errors).forEach(
      k => (values as any)[k] && setFieldTouched(k as any)
    );
  }
}
