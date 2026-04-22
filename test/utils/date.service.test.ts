import { DateTime } from 'luxon'
import { DateService } from '../../src/utils/date.service'

describe('DateService', () => {
  describe('now', () => {
    it('renvoie now', () => {
      // Given
      const dateService = new DateService()

      // When
      const now = dateService.now()

      // Then
      expect(DateTime.now().toMillis() - now.toMillis()).toBeLessThan(10)
    })
  })
})
