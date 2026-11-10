import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { IUser } from './userModel.js';

const RP_NAME = 'Aarogya Drishti Healthcare Portal';
export const getRpId = () => process.env.RP_ID || 'localhost';
export const getExpectedOrigin = () => process.env.EXPECTED_ORIGIN || 'http://localhost:5173';

export async function createWebAuthnRegistrationOptions(user: IUser) {
  const rpID = getRpId();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.username,
    userID: new TextEncoder().encode(user.userId),
    attestationType: 'none',
    excludeCredentials: user.webauthnCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports as any,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  return options;
}

export async function verifyWebAuthnRegistration(
  user: IUser,
  response: RegistrationResponseJSON,
  expectedChallenge: string
) {
  const rpID = getRpId();
  const expectedOrigin = getExpectedOrigin();

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID: rpID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;
    const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64');

    return {
      verified: true,
      credential: {
        credentialId: credential.id,
        publicKey: publicKeyBase64,
        counter: credential.counter,
        transports: credential.transports,
        createdAt: new Date(),
      },
    };
  }

  return { verified: false, credential: null };
}

export async function createWebAuthnAuthOptions(user: IUser) {
  const rpID = getRpId();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user.webauthnCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports as any,
    })),
    userVerification: 'preferred',
  });

  return options;
}

export async function verifyWebAuthnAuth(
  user: IUser,
  response: AuthenticationResponseJSON,
  expectedChallenge: string
) {
  const rpID = getRpId();
  const expectedOrigin = getExpectedOrigin();

  const credential = user.webauthnCredentials.find((c) => c.credentialId === response.id);
  if (!credential) {
    throw new Error('WebAuthn credential not recognized for this user');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID: rpID,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, 'base64'),
      counter: credential.counter,
      transports: credential.transports as any,
    },
  });

  if (verification.verified && verification.authenticationInfo) {
    // Update counter to prevent replay
    credential.counter = verification.authenticationInfo.newCounter;
    await user.save();
    return { verified: true, credentialId: credential.credentialId };
  }

  return { verified: false, credentialId: null };
}
