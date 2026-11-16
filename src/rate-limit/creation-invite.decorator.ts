import { CustomDecorator, SetMetadata } from '@nestjs/common'

export const CREATION_INVITE_KEY = 'rate-limit:creation-invite'

export const CreationInvite = (): CustomDecorator<string> =>
  SetMetadata(CREATION_INVITE_KEY, true)
