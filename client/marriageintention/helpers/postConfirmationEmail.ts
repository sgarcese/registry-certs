import axios from 'axios';
import qs from 'qs';
import getConfig from 'next/config';

import { API_KEY_CONFIG_KEY } from '@cityofboston/next-client-common';

async function PostConfirmationEmail(data: {
  email: string;
  from: string;
  subject: string;
  message: string;
  fullName: string;
}) {
  const { email, from, subject, message, fullName } = data;

  try {
    let dataObj = qs.stringify({
      'email[to_address]': email,
      'email[from_address]': from,
      'email[subject]': subject,
      'email[message]': message,
      'email[name]': fullName,
    });

    // The relay endpoint requires the web API key; sender and template id are
    // pinned server-side.
    const { publicRuntimeConfig } = getConfig() || { publicRuntimeConfig: {} };
    const apiKey =
      (publicRuntimeConfig && publicRuntimeConfig[API_KEY_CONFIG_KEY]) || '';

    let config: any = {
      method: 'post',
      url: '/marriageintention/fetchGraphql',
      headers: apiKey ? { 'X-API-KEY': apiKey } : {},
      data: dataObj,
    };

    return await axios(config)
      .then(response => {
        // eslint-disable-next-line no-console
        // console.error(JSON.stringify(response.data));
        return response.data;
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('RESPONSE 200 >', e);
    return e;
  }
}

export default PostConfirmationEmail;
