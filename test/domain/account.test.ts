import { Account } from '../../src/domain/account'
import { unAccount } from '../test-utils/fixtures'

describe('Account', () => {
  describe('fromAccountToAccountId', () => {
    it('renvoie un accountId', () => {
      // Given
      const account = unAccount()

      // When
      const accountId = Account.fromAccountToAccountId(account)

      // Then
      expect(accountId).toEqual('CONSEILLER|MILO|un-sub')
    })
  })
  describe('fromAccountIdToAccount', () => {
    it('renvoie un accountId', () => {
      // Given
      const account = unAccount()
      const accountId = Account.fromAccountToAccountId(account)

      // When
      const foundAccount = Account.fromAccountIdToAccount(accountId)

      // Then
      expect(foundAccount).toEqual(account)
    })
  })
  describe('getStructureFromAccountId', () => {
    it('renvoie un account', () => {
      // Given
      const account = unAccount()
      const accountId = Account.fromAccountToAccountId(account)

      // When
      const structure = Account.getStructureFromAccountId(accountId)

      // Then
      expect(structure).toEqual(account.structure)
    })
  })
  describe('getSubFromAccountId', () => {
    it('renvoie le sub', () => {
      // Given
      const account = unAccount()
      const accountId = Account.fromAccountToAccountId(account)

      // When
      const sub = Account.getSubFromAccountId(accountId)

      // Then
      expect(sub).toEqual(account.sub)
    })
  })
  describe('getTypeFromAccountId', () => {
    it('renvoie le type', () => {
      // Given
      const account = unAccount()
      const accountId = Account.fromAccountToAccountId(account)

      // When
      const type = Account.getTypeFromAccountId(accountId)

      // Then
      expect(type).toEqual(account.type)
    })
  })
})
