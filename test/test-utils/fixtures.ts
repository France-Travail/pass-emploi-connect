import { JWTPayload } from 'jose'
import { Account } from '../../src/domain/account.js'
import { User } from '../../src/domain/user.js'
import { PassEmploiUser } from '../../src/api/pass-emploi-api.client.js'
import { TokenData } from '../../src/token/token.service.js'
import { DateTime } from 'luxon'

export const uneDatetime = (): DateTime =>
  DateTime.fromISO('2024-06-01T12:00:00.000Z')

export const unAccount = (args: Partial<Account> = {}): Account => {
  const defaults: Account = {
    sub: 'un-sub',
    type: User.Type.CONSEILLER,
    structure: User.Structure.MILO
  }

  return { ...defaults, ...args }
}

export const unUser = (args: Partial<User> = {}): User => {
  const defaults: User = {
    userId: 'un-id',
    userType: User.Type.CONSEILLER,
    userStructure: User.Structure.MILO,
    userRoles: [],
    given_name: 'Bruno',
    family_name: 'Dumont',
    email: 'zema@octo.com',
    preferred_username: 'b.dumont'
  }

  return { ...defaults, ...args }
}

export const unPassEmploiUser = (
  args: Partial<PassEmploiUser> = {}
): PassEmploiUser => {
  const defaults: PassEmploiUser = {
    type: User.Type.CONSEILLER,
    structure: User.Structure.MILO,
    prenom: 'Bruno',
    nom: 'Dumont',
    email: 'zema@octo.com',
    username: 'b.dumont'
  }

  return { ...defaults, ...args }
}

export const unTokenData = (args: Partial<TokenData> = {}): TokenData => {
  const defaults: TokenData = {
    token: 'un-token',
    expiresIn: 100,
    scope: ''
  }

  return { ...defaults, ...args }
}

export const unJwtPayloadValide = (): JWTPayload => ({
  userId: 'cc03c25e-950e-4434-8103-583b8d9c29b3',
  userRoles: ['SUPERVISEUR'],
  userStructure: 'MILO',
  userType: 'CONSEILLER',
  email: 'frep+bdumont@octo.com',
  family_name: 'Bernard',
  given_name: 'Dumond',
  preferred_username: 'b.dumont',
  jti: 'MDdMtmMtBtQtiu_5Dozwz',
  sub: 'CONSEILLER|MILO|df095ff0-23e9-48d3-8e26-358c3e614881',
  iat: 1717506399,
  exp: 1727874399,
  scope: 'openid email profile',
  client_id: 'pass-emploi-swagger',
  iss: 'https://id.pass-emploi.incubateur.net',
  aud: 'https://api.pass-emploi.incubateur.net'
})
