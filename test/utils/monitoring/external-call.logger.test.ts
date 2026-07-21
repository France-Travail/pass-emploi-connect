import sinon from 'sinon'
import { logExternalCall } from '../../../src/utils/monitoring/external-call.logger'
import { rootLogger } from '../../../src/utils/monitoring/logger.module'

describe('logExternalCall', () => {
  afterEach(() => sinon.restore())

  it('émet un external_api_call success et renvoie le résultat', async () => {
    // Given
    const infoSpy = sinon.spy(rootLogger, 'info')

    // When
    const result = await logExternalCall(
      {
        target: 'milo-jeune',
        operation: 'userinfo',
        url: 'https://sso.i-milo.fr/userinfo',
        method: 'GET'
      },
      async () => ({ sub: 'abc' })
    )

    // Then
    expect(result).toEqual({ sub: 'abc' })
    sinon.assert.calledOnce(infoSpy)
    const [obj, msg] = infoSpy.firstCall.args as unknown as [
      { event: { action: string; outcome: string }; context: string },
      string
    ]
    expect(msg).toEqual('external_api_call')
    expect(obj.event.action).toEqual('external_api_call')
    expect(obj.event.outcome).toEqual('success')
    expect(obj.context).toEqual('milo-jeune')
  })

  it('émet un external_api_call failure error et relance l erreur', async () => {
    // Given
    const errorSpy = sinon.spy(rootLogger, 'error')
    const boom = new Error('idp down')

    // When / Then
    await expect(
      logExternalCall(
        {
          target: 'milo-jeune',
          operation: 'token',
          url: 'https://sso.i-milo.fr/token',
          method: 'POST'
        },
        async () => {
          throw boom
        }
      )
    ).rejects.toThrow('idp down')
    sinon.assert.calledOnce(errorSpy)
    const [obj] = errorSpy.firstCall.args as unknown as [
      { event: { outcome: string }; error: { message: string } }
    ]
    expect(obj.event.outcome).toEqual('failure')
    expect(obj.error.message).toEqual('idp down')
  })
})
