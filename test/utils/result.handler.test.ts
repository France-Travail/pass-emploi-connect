import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Response } from 'express'
import { HttpStatus } from '@nestjs/common'
import { createSandbox, expect } from 'test/test-utils'
import { redirectFailure } from '../../src/utils/result/result.handler'
import { Failure } from '../../src/utils/result/result'
import { User } from '../../src/domain/user'

describe('redirectFailure', () => {
  let response: StubbedType<Response>

  beforeEach(() => {
    const sandbox = createSandbox()
    response = stubInterface(sandbox)
  })

  it('retourne juste le code erreur', () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'ERROR_CODE',
        reason: 'Test error',
        message: ''
      },
      _isSuccess: false
    }

    // Mock environment variable
    // eslint-disable-next-line no-process-env
    process.env.CLIENT_WEB_ERROR_CALLBACK = 'http://example.com/error'

    // When
    redirectFailure(response, failure)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
    expect(url).to.equal('http://example.com/error?reason=Test error')
  })

  it('retourne le code quand il attend la raison', () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'ERROR_CODE',
        message: ''
      },
      _isSuccess: false
    }

    // eslint-disable-next-line no-process-env
    process.env.CLIENT_WEB_ERROR_CALLBACK = 'http://example.com/error'

    // When
    redirectFailure(response, failure)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
    expect(url).to.equal('http://example.com/error?reason=ERROR_CODE')
  })

  it("inclue le type de l'utilisateur si il est attendu", () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'ERROR_CODE',
        message: ''
      },
      _isSuccess: false
    }

    // eslint-disable-next-line no-process-env
    process.env.CLIENT_WEB_ERROR_CALLBACK = 'http://example.com/error'

    // When
    redirectFailure(response, failure, User.Type.CONSEILLER)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
    expect(url).to.equal(
      `http://example.com/error?reason=ERROR_CODE&typeUtilisateur=${User.Type.CONSEILLER}`
    )
  })

  it("inclu les données de la structure de l'utilisateur si elle attendu", () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'ERROR_CODE',
        message: ''
      },
      _isSuccess: false
    }

    // eslint-disable-next-line no-process-env
    process.env.CLIENT_WEB_ERROR_CALLBACK = 'http://example.com/error'

    // When
    redirectFailure(response, failure, undefined, User.Structure.FRANCE_TRAVAIL)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
    expect(url).to.equal(
      'http://example.com/error?reason=ERROR_CODE&structureUtilisateur=FRANCE_TRAVAIL'
    )
  })

  it("retourne toutes les donées de l'utilisateur si elle sont présente", () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'ERROR_CODE',
        email: 'test@example.com',
        nom: 'Doe',
        prenom: 'John',
        message: ''
      },
      _isSuccess: false
    }

    // eslint-disable-next-line no-process-env
    process.env.CLIENT_WEB_ERROR_CALLBACK = 'http://example.com/error'

    // When
    redirectFailure(
      response,
      failure,
      User.Type.JEUNE,
      User.Structure.FRANCE_TRAVAIL
    )

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
    expect(url).to.equal(
      'http://example.com/error?reason=ERROR_CODE&typeUtilisateur=' +
        `${User.Type.JEUNE}&structureUtilisateur=FRANCE_TRAVAIL&email=test@example.com` +
        `&nom=Doe&prenom=John`
    )
  })

  it('retourne une erreur vide', () => {
    // Given
    const failure: Failure = {
      error: {
        code: '',
        message: ''
      },
      _isSuccess: false
    }

    // eslint-disable-next-line no-process-env
    process.env.CLIENT_WEB_ERROR_CALLBACK = 'http://example.com/error'

    // When
    redirectFailure(response, failure)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
    expect(url).to.equal('http://example.com/error?reason=')
  })
})

afterEach(() => {
  // eslint-disable-next-line no-process-env
  delete process.env.CLIENT_WEB_ERROR_CALLBACK
})
