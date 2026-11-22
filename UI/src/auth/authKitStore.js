import createStore from 'react-auth-kit/createStore';

export const authKitStore = createStore({
  authName: '_atr_auth',
  authType: 'cookie',
  cookieDomain: window.location.hostname,
  cookieSecure: window.location.protocol === 'https:',
});

