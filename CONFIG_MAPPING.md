# Configuration Mapping

This document shows how `.env` variables map to the centralized `config` object.

## Central Config File

All configuration is centralized in `src/config/index.js`. Use `import { config } from '../config/index.js'` instead of `process.env` directly.

## Environment Variables Mapping

### Server Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `PORT` | `config.port` | `7000` | Server port |
| `NODE_ENV` or `production` | `config.nodeEnv` | `development` | Environment (if `production=prod` then `production`, else `development`) |
| `CORS_ORIGIN` | `config.cors.origins` | `['http://localhost:3000', 'http://localhost:5173', ...]` | Allowed CORS origins (comma-separated) |

### Database Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `MONGODB_URI` or `MONGODB_URI_TEST` | `config.mongoUri` | `''` | MongoDB connection string |
| `DB_NAME` | `config.dbName` | `scan2reward` | Database name |

### JWT Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `ACCESS_TOKEN_SECRET` | `config.jwt.accessSecret` | `'default-change-in-env'` | Access token secret |
| `REFRESH_TOKEN_SECRET` | `config.jwt.refreshSecret` | `'default-change-in-env'` | Refresh token secret |
| `ACCESS_TOKEN_EXPIRY` | `config.jwt.accessExpiry` | `'24h'` | Access token expiry |
| `REFRESH_TOKEN_EXPIRY` | `config.jwt.refreshExpiry` | `'7d'` | Refresh token expiry |

### OTP Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `OTP_EXPIRY_MINUTES` | `config.otp.expiryMinutes` | `10` | OTP expiry in minutes |
| `OTP_LENGTH` | `config.otp.length` | `6` | OTP length |

### Admin Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `ADMIN_NAME` | `config.admin.name` | `'admin'` | Default admin name |
| `ADMIN_EMAIL` | `config.admin.email` | `'admin@gmail.com'` | Default admin email |
| `ADMIN_PASSWORD` | `config.admin.password` | `'admin123'` | Default admin password |
| `ADMIN_PHONE` | `config.admin.phone` | `'1234567890'` | Default admin phone |

### AWS S3 Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `AWS_REGION` | `config.aws.region` | `'ap-south-1'` | AWS region |
| `AWS_S3_BUCKET` | `config.aws.s3Bucket` | `''` | S3 bucket name |
| `AWS_ACCESS_KEY` | `config.aws.accessKeyId` | `''` | AWS access key ID |
| `AWS_SECRET_KEY` | `config.aws.secretAccessKey` | `''` | AWS secret access key |

### Cloudinary Configuration
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | `config.cloudinary.cloudName` | `''` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | `config.cloudinary.apiKey` | `''` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `config.cloudinary.apiSecret` | `''` | Cloudinary API secret |

### SMS Configuration (DLT)
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `SMS_API_KEY` | `config.sms.apiKey` | `''` | SMS API key |
| `SENDER_ID` | `config.sms.senderId` | `''` | SMS sender ID |
| `TEMPLATE_ID` | `config.sms.templateId` | `''` | SMS template ID |
| `SMS_BASE_URL` | `config.sms.baseUrl` | `'https://smsapi.edumarcsms.com/api/v1/sendsms'` | SMS API base URL |
| `SMS_OTP_MESSAGE` | `config.sms.otpMessage` | `null` | Custom OTP message template |

### Email Configuration (Gmail/Nodemailer)
| .env Variable | Config Path | Default | Description |
|---------------|-------------|---------|-------------|
| `EMAIL_USER` | `config.email.user` | `''` | Gmail address |
| `EMAIL_APP_PASSWORD` | `config.email.appPassword` | `''` | Gmail app password |
| `SUPPORT_EMAIL` | `config.email.supportEmail` | `''` | Support email address |
| `FROM_EMAIL` | `config.email.fromEmail` | `EMAIL_USER` or `'noreply@scen2reward.com'` | From email address |
| `FROM_NAME` | `config.email.fromName` | `'Scen2Reward'` | From name |
| `SMTP_HOST` | `config.email.smtpHost` | `'smtp.gmail.com'` | SMTP host |
| `SMTP_PORT` | `config.email.smtpPort` | `587` | SMTP port |
| `SMTP_SECURE` | `config.email.smtpSecure` | `false` | Use secure connection |

## Usage Examples

### Instead of:
```javascript
const port = process.env.PORT || 8000;
const mongoUri = process.env.MONGODB_URI;
```

### Use:
```javascript
import { config } from '../config/index.js';

const port = config.port;
const mongoUri = config.mongoUri;
```

## Files Updated to Use Config

✅ `src/config/index.js` - Central config file (updated)
✅ `src/config/db.js` - Database connection (uses config)
✅ `src/seeders/seedAdmin.js` - Admin seeder (uses config.admin)
✅ `src/utils/Aws/s3-credentials.js` - S3 client (uses config.aws)
✅ `src/utils/Aws/putObject.js` - S3 upload (uses config.aws)
✅ `src/utils/Aws/getObject.js` - S3 get (uses config.aws)
✅ `src/utils/Aws/deletObject.js` - S3 delete (uses config.aws)
✅ `src/utils/smsUtils.js` - SMS utils (uses config.sms)
✅ `src/services/email.service.js` - Email service (uses config.email)
✅ `src/app.js` - Express app (uses config.cors)
✅ `server.js` - Server startup (uses config.port)

## Benefits

1. **Single source of truth** - All config in one place
2. **Type safety** - Consistent structure
3. **Default values** - Fallbacks defined once
4. **Easy testing** - Mock config object
5. **Documentation** - Clear mapping of env vars
