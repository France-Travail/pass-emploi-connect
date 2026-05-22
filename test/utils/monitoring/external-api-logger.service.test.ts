import axios, { AxiosError } from 'axios'
import sinon from 'sinon'
import { attachExternalApiLogger } from '../../../src/utils/monitoring/external-api-logger.service'

describe('attachExternalApiLogger', () => {
  it('émet un external_api_call success sur réponse 2xx', () => {
    // Given
    const instance = axios.create()
    const emit = sinon.spy()
    attachExternalApiLogger(instance, emit)
    const config = { method: 'get', url: 'https://idp.test/userinfo' }

    // When : on déclenche manuellement l'intercepteur de réponse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onFulfilled = (instance.interceptors.response as any).handlers[0]
      .fulfilled
    onFulfilled({ config, status: 200, data: { sub: 'x' } })

    // Then
    sinon.assert.calledOnce(emit)
    const [level, obj] = emit.firstCall.args
    expect(level).toEqual('info')
    expect(obj.event.action).toEqual('external_api_call')
    expect(obj.event.outcome).toEqual('success')
  })

  it('émet un external_api_call failure error sur erreur réseau', () => {
    // Given
    const instance = axios.create()
    const emit = sinon.spy()
    attachExternalApiLogger(instance, emit)
    const error = new AxiosError('Network Error')
    error.config = { method: 'post', url: 'https://idp.test/token' } as never

    // When
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onRejected = (instance.interceptors.response as any).handlers[0]
      .rejected
    return onRejected(error).catch(() => {
      // Then
      const [level, obj] = emit.firstCall.args
      expect(level).toEqual('error')
      expect(obj.event.outcome).toEqual('failure')
    })
  })
})
