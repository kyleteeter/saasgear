import pkg from 'apollo-server-express';

import { comparePassword } from '~/helpers/hashing.helper';
import { sign } from '~/helpers/jwt.helper';
import { getUserByEmail } from '~/repository/user.repository';
import { loginValidation } from '~/utils/validations/authenticate.validation';

const { AuthenticationError, ValidationError } = pkg;

async function loginUser(email, password) {
  const validateResult = loginValidation({ email, password });
  if (validateResult.length) {
    throw new ValidationError(
      validateResult.map((it) => it.message).join(','),
      {
        invalidArgs: validateResult.map((it) => it.field).join(','),
      },
    );
  }

  const user = await getUserByEmail(email);
  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  const matchPassword = await comparePassword(password, user.password);
  if (!matchPassword) {
    throw new AuthenticationError('Invalid email or password');
  }

  return {
    token: sign({
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
    }),
  };
}

export { loginUser };