import crypto from 'crypto';

export function verifyTrackingToken(trackingToken: string, storedHash: string): boolean {
  if (!trackingToken || !storedHash) {
    return false;
  }

  const tokenHash = crypto.createHash('sha256').update(trackingToken.trim()).digest('hex');
  return (
    tokenHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(storedHash))
  );
}
