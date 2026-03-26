import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  AUTH_SERVICE_URL: Joi.string().uri().required(),
  NOTIFICATION_SERVICE_URL: Joi.string().uri().required(),
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  JWT_SECRET: Joi.string().required(),
  RATE_LIMIT_MAX: Joi.number().default(100),
  RATE_LIMIT_WINDOW: Joi.number().default(60000),
});
