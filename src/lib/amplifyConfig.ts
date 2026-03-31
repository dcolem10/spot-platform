import { Amplify } from 'aws-amplify';

/**
 * Configure Amplify for a specific user pool.
 *
 * Spot Platform uses two separate Cognito user pools:
 *   - Creator pool  (VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_APP_CLIENT_ID)
 *   - Restaurant pool (VITE_COGNITO_RESTAURANT_USER_POOL_ID / VITE_COGNITO_RESTAURANT_APP_CLIENT_ID)
 *
 * Call bootstrapAmplify('creator') on app load (default).
 * Call bootstrapAmplify('restaurant') before authenticating restaurant/partner users.
 */
export function bootstrapAmplify(poolType: 'creator' | 'restaurant' = 'creator') {
  const isRestaurant = poolType === 'restaurant';

  const userPoolId = isRestaurant
    ? import.meta.env.VITE_COGNITO_RESTAURANT_USER_POOL_ID
    : import.meta.env.VITE_COGNITO_USER_POOL_ID;

  const appClientId = isRestaurant
    ? import.meta.env.VITE_COGNITO_RESTAURANT_APP_CLIENT_ID
    : import.meta.env.VITE_COGNITO_APP_CLIENT_ID;

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
