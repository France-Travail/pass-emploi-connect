import { User } from './user.js'

const separator = '|'
const typeIndex = 0
const structureIndex = 1
const subIndex = 2

export interface Account {
  sub: string
  type: User.Type
  structure: User.Structure
}

export namespace Account {
  export function fromAccountToAccountId(account: Account): string {
    const accountIdArray = []
    accountIdArray[typeIndex] = account.type
    accountIdArray[structureIndex] = account.structure
    accountIdArray[subIndex] = account.sub
    return accountIdArray.join(separator)
  }
  export function fromAccountIdToAccount(accountId: string): Account {
    return {
      sub: getSubFromAccountId(accountId),
      type: getTypeFromAccountId(accountId),
      structure: getStructureFromAccountId(accountId)
    }
  }

  export function getSubFromAccountId(accountId: string): string {
    return accountId.split(separator)[subIndex]
  }
  export function getTypeFromAccountId(accountId: string): User.Type {
    return accountId.split(separator)[typeIndex] as User.Type
  }
  export function getStructureFromAccountId(accountId: string): User.Structure {
    return accountId.split(separator)[structureIndex] as User.Structure
  }
}
