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
      { target: 'milo-jeune', operation: 'userinfo' },
      async () => ({ sub: 'abc' })
    )

    // Then
    expect(result).toEqual({ sub: 'abc' })
    sinon.assert.calledOnce(infoSpy)
    const [obj, msg] = infoSpy.firstCall.args
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
        { target: 'milo-jeune', operation: 'token' },
        async () => {
          throw boom
        }
      )
    ).rejects.toThrow('idp down')
    sinon.assert.calledOnce(errorSpy)
    const [obj] = errorSpy.firstCall.args
    expect(obj.event.outcome).toEqual('failure')
    expect(obj.error.message).toEqual('idp down')
  })
})
