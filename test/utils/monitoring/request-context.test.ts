import {
  ContextKey,
  RequestContext,
  getContextValue
} from '../../../src/utils/monitoring/request-context'

describe('RequestContext', () => {
  let context: RequestContext

  beforeEach(() => {
    context = new RequestContext()
  })

  it('retourne undefined hors de tout contexte', () => {
    // When / Then
    expect(getContextValue(ContextKey.INTERACTION_ID)).toBeUndefined()
  })

  it('stocke et relit une valeur dans le contexte courant', () => {
    // Given
    context.start()

    // When
    context.set(ContextKey.INTERACTION_ID, 'uid-123')

    // Then
    expect(context.get(ContextKey.INTERACTION_ID)).toEqual('uid-123')
    expect(getContextValue(ContextKey.INTERACTION_ID)).toEqual('uid-123')
  })

  it('isole les valeurs entre deux contextes', async () => {
    // Given / When
    const lire = (valeur: string): string | undefined => {
      context.start()
      context.set(ContextKey.INTERACTION_ID, valeur)
      return context.get(ContextKey.INTERACTION_ID)
    }

    // Then
    expect(lire('a')).toEqual('a')
    expect(lire('b')).toEqual('b')
  })
})
