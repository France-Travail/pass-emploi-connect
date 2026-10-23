import { Request, Response } from 'express'
import sinon from 'sinon'
import { requestFilter } from '../../src/utils/request-filter.middleware'

const CALLBACK_CD =
  '/auth/realms/pass-emploi/broker/conseildepartemental-conseiller/endpoint'

function buildRequest({
  path = '/',
  query = {},
  ip = '203.0.113.1'
}: {
  path?: string
  query?: Record<string, string>
  ip?: string
}): Request {
  return { path, query, headers: { 'x-real-ip': ip } } as unknown as Request
}

type StubbedResponse = Response & {
  status: sinon.SinonStub
  end: sinon.SinonStub
}

function buildResponse(): StubbedResponse {
  const res = { status: sinon.stub(), end: sinon.stub() }
  res.status.returns(res)
  return res as unknown as StubbedResponse
}

describe('requestFilter', () => {
  it("renvoie 403 sans passer la main quand l'IP est bloquée", () => {
    // Given
    const filter = requestFilter(['198.51.100.7'])
    const res = buildResponse()
    const next = sinon.stub()

    // When
    filter(buildRequest({ ip: '198.51.100.7' }), res, next)

    // Then
    sinon.assert.calledOnceWithExactly(res.status, 403)
    sinon.assert.calledOnce(res.end)
    sinon.assert.notCalled(next)
  })

  it('renvoie 400 sur un callback broker en erreur sans state', () => {
    // Given
    const filter = requestFilter([])
    const res = buildResponse()
    const next = sinon.stub()

    // When
    filter(
      buildRequest({
        path: CALLBACK_CD,
        query: {
          error: 'invalid_request',
          error_description: 'Missing parameter: response_type'
        }
      }),
      res,
      next
    )

    // Then
    sinon.assert.calledOnceWithExactly(res.status, 400)
    sinon.assert.notCalled(next)
  })

  it('laisse passer un callback broker en erreur avec state', () => {
    // Given
    const filter = requestFilter([])
    const res = buildResponse()
    const next = sinon.stub()

    // When
    filter(
      buildRequest({
        path: CALLBACK_CD,
        query: { error: 'access_denied', state: 'interaction-id' }
      }),
      res,
      next
    )

    // Then
    sinon.assert.calledOnce(next)
    sinon.assert.notCalled(res.status)
  })

  it('laisse passer un callback broker nominal', () => {
    // Given
    const filter = requestFilter([])
    const res = buildResponse()
    const next = sinon.stub()

    // When
    filter(
      buildRequest({
        path: '/auth/realms/pass-emploi/broker/pe-jeune/endpoint',
        query: { code: 'un-code', state: 'interaction-id' }
      }),
      res,
      next
    )

    // Then
    sinon.assert.calledOnce(next)
  })

  it('laisse passer une requête hors callback avec un paramètre error', () => {
    // Given
    const filter = requestFilter(['198.51.100.7'])
    const res = buildResponse()
    const next = sinon.stub()

    // When
    filter(
      buildRequest({ path: '/autre-route', query: { error: 'x' } }),
      res,
      next
    )

    // Then
    sinon.assert.calledOnce(next)
  })
})
