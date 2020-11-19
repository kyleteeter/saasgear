import pkg from 'apollo-server-express';
import dayjs from 'dayjs';
import {
  findToken,
  changeTokenStatus,
  createToken,
} from '~/repository/user_token.repository';
import { activeUser } from '~/repository/user.repository';
import generateRandomKey from '~/helpers/genarateRandomkey';
import generateTemplateEmail from '~/helpers/generate-template-email';
import sendMail from '~/libs/mail';
import logger from '~/utils/logger';

const { ApolloError } = pkg;

function isValidDate(createdAt) {
  return dayjs(createdAt).add(15, 'minute').diff(dayjs()) > 0;
}

export async function verifyEmail(authToken) {
  try {
    const token = await findToken(authToken);

    if (!token || !token.is_active || token.type !== 'verify_email') {
      throw new ApolloError('Invalid token');
    }

    if (!isValidDate(token.created_at)) {
      throw new ApolloError('Token had expired');
    }

    await Promise.all([
      changeTokenStatus(token.id, token.type, false),
      activeUser(token.user_id),
    ]);

    return true;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export async function resendEmailAction(user, type) {
  try {
    let template;
    let subject;
    const token = await generateRandomKey();
    switch (type) {
      case 'verify_email':
        if (user.is_active === 1) {
          throw new ApolloError('Account verified');
        }
        subject = 'Resend confirm your email address';
        template = generateTemplateEmail({
          fileName: 'verifyEmail.mjml',
          data: {
            name: user.name,
            url: `${process.env.FRONTEND_URL}/verify-email?token=${token}`,
          },
        });
        break;

      case 'forgot_password':
        subject = 'Resend reset password';
        template = generateTemplateEmail({
          fileName: 'forgotPassword.mjml',
          data: {
            name: user.name,
            url: `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`,
          },
        });
        break;

      default:
        subject = 'Resend confirm your email address';
        template = generateTemplateEmail({
          fileName: 'verifyEmail.mjml',
          data: {
            name: user.name,
            url: `${process.env.FRONTEND_URL}/verify-email?token=${token}`,
          },
        });
        break;
    }

    await changeTokenStatus(null, type, false);
    await Promise.all([
      createToken(user.id, token, type),
      sendMail(user.email, subject, template),
    ]);

    return true;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}