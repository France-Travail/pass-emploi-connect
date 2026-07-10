import { Request } from 'express'
import { ensureResumeCookie } from '../../src/oidc-provider/resume-cookie'

function buildRequest(url: string, cookie?: string): Request {
  return { url, headers: cookie ? { cookie } : {} } as Request
}

const UID = 'yX8HRTeTx7-tFaOY26neM4XkxWaX16CcH7tOD2zY86y'

describe('ensureResumeCookie', () => {
  it("synthétise _interaction_resume depuis l'uid du path quand aucun cookie n'est envoyé", () => {
    const req = buildRequest(`/protocol/openid-connect/auth/${UID}`)

    ensureResumeCookie(req)

    expect(req.headers.cookie).toEqual(`_interaction_resume=${UID}`)
  })

  it('ajoute _interaction_resume aux cookies existants sans les écraser', () => {
    const req = buildRequest(
      `/protocol/openid-connect/auth/${UID}`,
      '_session=abc'
    )

    ensureResumeCookie(req)

    expect(req.headers.cookie).toEqual(
      `_session=abc; _interaction_resume=${UID}`
    )
  })

  it('ne touche à rien quand _interaction_resume est déjà envoyé par le navigateur', () => {
    const cookie = `_session=abc; _interaction_resume=${UID}`
    const req = buildRequest(`/protocol/openid-connect/auth/${UID}`, cookie)

    ensureResumeCookie(req)

    expect(req.headers.cookie).toEqual(cookie)
  })

  it('gère une query string sur la route de reprise', () => {
    const req = buildRequest(`/protocol/openid-connect/auth/${UID}?foo=bar`)

    ensureResumeCookie(req)

    expect(req.headers.cookie).toEqual(`_interaction_resume=${UID}`)
  })

  it("ne fait rien sur la route d'authorization sans uid", () => {
    const req = buildRequest(
      '/protocol/openid-connect/auth?client_id=web&response_type=code'
    )

    ensureResumeCookie(req)

    expect(req.headers.cookie).toBeUndefined()
  })

  it('ne fait rien sur les autres routes', () => {
    const req = buildRequest('/protocol/openid-connect/token')

    ensureResumeCookie(req)

    expect(req.headers.cookie).toBeUndefined()
  })

  it("ne fait rien quand l'uid du path a un format invalide", () => {
    const req = buildRequest('/protocol/openid-connect/auth/trop-court')

    ensureResumeCookie(req)

    expect(req.headers.cookie).toBeUndefined()
  })
})
