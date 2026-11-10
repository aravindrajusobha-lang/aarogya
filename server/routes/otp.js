import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const router = require('./otp.cjs');

export default router;
export const otpRouter = router;
