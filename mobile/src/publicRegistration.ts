import * as WebBrowser from 'expo-web-browser';

const configuredWebAppUrl = (process.env.EXPO_PUBLIC_WEB_APP_URL || '').replace(/\/$/, '');

export async function openAadhaarRegistration(): Promise<void> {
  if (!configuredWebAppUrl) throw new Error('The secure web app address is not configured in this build.');

  let url: URL;
  try {
    url = new URL('/#/patient/register', configuredWebAppUrl);
  } catch {
    throw new Error('The secure web app address in this build is invalid.');
  }
  if (url.protocol !== 'https:') throw new Error('Aadhaar registration requires a secure HTTPS web address.');

  await WebBrowser.openBrowserAsync(url.toString());
}
