import { Amplify } from 'aws-amplify';

export function bootstrapAmplify() {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const appClientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;

  // Skip configuration if Cognito env vars are not set (demo mode)
  if (!userPoolId || !appClientId) return;

  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const redirectUrl = import.meta.env.VITE_COGNITO_REDIRECT || window.location.origin;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: appClientId,
        ...(domain
          ? {
              loginWith: {
                oauth: {
                  domain,
                  scopes: ['openid', 'email', 'profile'],
                  redirectSignIn: [redirectUrl],
                  redirectSignOut: [redirectUrl],
                  responseType: 'code',
                },
              },
            }
          : {}),
      },
    },
  });
}
