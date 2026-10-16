import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Response } from 'express'
import { HttpStatus } from '@nestjs/common'
import { createSandbox } from 'test/test-utils'
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

    // When
    redirectFailure(response, failure)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).toBe(HttpStatus.TEMPORARY_REDIRECT)
    expect(url.split('?').pop()).toBe('reason=Test+error')
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

    // When
    redirectFailure(response, failure)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).toBe(HttpStatus.TEMPORARY_REDIRECT)
    expect(url.split('?').pop()).toBe('reason=ERROR_CODE')
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

    // When
    redirectFailure(response, failure, User.Type.CONSEILLER)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).toBe(HttpStatus.TEMPORARY_REDIRECT)
    expect(url.split('?').pop()).toBe(
      `reason=ERROR_CODE&typeUtilisateur=${User.Type.CONSEILLER}`
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

    // When
    redirectFailure(response, failure, undefined, User.Structure.FRANCE_TRAVAIL)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).toBe(HttpStatus.TEMPORARY_REDIRECT)
    expect(url.split('?').pop()).toBe(
      `reason=ERROR_CODE&structureUtilisateur=FRANCE_TRAVAIL`
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

    // When
    redirectFailure(
      response,
      failure,
      User.Type.JEUNE,
      User.Structure.FRANCE_TRAVAIL
    )

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).toBe(HttpStatus.TEMPORARY_REDIRECT)
    expect(url.split('?').pop()).toBe(
      'reason=ERROR_CODE&typeUtilisateur=' +
        `${User.Type.JEUNE}&structureUtilisateur=FRANCE_TRAVAIL&email=test%40example.com` +
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

    // When
    redirectFailure(response, failure)

    // Then
    const [status, url] = response.redirect.getCall(0).args
    expect(status).toBe(HttpStatus.TEMPORARY_REDIRECT)
    expect(url.split('?').pop()).toBe('reason=')
  })

  it('ajoute la population encodée quand elle est présente', () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'UTILISATEUR_NON_TRAITABLE',
        reason: 'MIGRATION_PARCOURS_EMPLOI',
        population: 'POP PE&1',
        message: ''
      },
      _isSuccess: false
    }

    // When
    redirectFailure(response, failure, User.Type.JEUNE)

    // Then
    const [, url] = response.redirect.getCall(0).args
    expect(url.split('?').pop()).toBe(
      `reason=MIGRATION_PARCOURS_EMPLOI&typeUtilisateur=${User.Type.JEUNE}&population=POP+PE%261`
    )
  })

  it('encode la raison pour ne pas injecter de paramètres', () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'ERROR_CODE',
        reason: 'Erreur&typeUtilisateur=CONSEILLER#',
        message: ''
      },
      _isSuccess: false
    }

    // When
    redirectFailure(response, failure, User.Type.JEUNE)

    // Then
    const [, url] = response.redirect.getCall(0).args
    const params = new URL(url, 'https://web.test').searchParams
    expect(params.get('reason')).toBe('Erreur&typeUtilisateur=CONSEILLER#')
    expect(params.getAll('typeUtilisateur')).toEqual([User.Type.JEUNE])
  })

  it('encode email, nom et prénom pour ne pas perdre les paramètres suivants', () => {
    // Given
    const failure: Failure = {
      error: {
        code: 'UTILISATEUR_NON_TRAITABLE',
        reason: 'MIGRATION_PARCOURS_EMPLOI',
        email: 'a+b@example.com',
        nom: 'Doe #2',
        prenom: 'Jean&Paul',
        population: 'POP_PASS_EMPLOI',
        message: ''
      },
      _isSuccess: false
    }

    // When
    redirectFailure(response, failure)

    // Then
    const [, url] = response.redirect.getCall(0).args
    const params = new URL(url, 'https://web.test').searchParams
    expect(params.get('email')).toBe('a+b@example.com')
    expect(params.get('nom')).toBe('Doe #2')
    expect(params.get('prenom')).toBe('Jean&Paul')
    expect(params.get('population')).toBe('POP_PASS_EMPLOI')
  })
})
