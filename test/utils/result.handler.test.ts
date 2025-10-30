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

  describe('with basic failure information', () => {
    it('should redirect with reason from error object', () => {
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

    it('should use code when reason is not provided', () => {
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
  })

  describe('with user information', () => {
    it('should include typeUtilisateur when provided', () => {
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

    it('should include structureUtilisateur when provided', () => {
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
      redirectFailure(
        response,
        failure,
        undefined,
        User.Structure.FRANCE_TRAVAIL
      )

      // Then
      const [status, url] = response.redirect.getCall(0).args
      expect(status).to.equal(HttpStatus.TEMPORARY_REDIRECT)
      expect(url).to.equal(
        'http://example.com/error?reason=ERROR_CODE&structureUtilisateur=FRANCE_TRAVAIL'
      )
    })

    it('should include all user information when provided', () => {
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
  })

  describe('with missing error properties', () => {
    it('should handle empty error object gracefully', () => {
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
})
