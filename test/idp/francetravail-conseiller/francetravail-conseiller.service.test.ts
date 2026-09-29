import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client'
import { FrancetravailConseillerService } from '../../../src/idp/francetravail-conseiller/francetravail-conseiller.service'
import { OidcService } from '../../../src/oidc-provider/oidc.service'
import { TokenService } from '../../../src/token/token.service'
import { Profil } from '../../../src/domain/user'
import { AuthError } from '../../../src/utils/result/error'
import { failure, success } from '../../../src/utils/result/result'
import { createSandbox, StubbedClass, stubClass } from '../../test-utils'
import { testConfig } from '../../test-utils/module-for-testing'

describe('FrancetravailConseillerService', () => {
  let francetravailConseillerService: FrancetravailConseillerService
  const configService = testConfig()
  let tokenService: StubbedClass<TokenService>
  let passEmploiAPIClient: StubbedClass<PassEmploiAPIClient>
  let oidcService: StubbedClass<OidcService>

  beforeEach(() => {
    oidcService = stubClass(OidcService)
    tokenService = stubClass(TokenService)
    passEmploiAPIClient = stubClass(PassEmploiAPIClient)
    francetravailConseillerService = new FrancetravailConseillerService(
      configService,
      oidcService,
      tokenService,
      passEmploiAPIClient
    )
  })

  describe('getAuthorizationUrl', () => {
    it('renvoie success', () => {
      expect(
        francetravailConseillerService.getAuthorizationUrl('test')
      ).toEqual(
        success(
          'https://ft-conseiller.com/authorize?client_id=ft-conseiller&scope=&response_type=code&redirect_uri=&nonce=test&state=test&realm=agent'
        )
      )
    })
  })

  describe('profilDeConnexion', () => {
    const profilDeConnexion = (params: Record<string, unknown>): Profil =>
      (
        francetravailConseillerService as unknown as {
          profilDeConnexion: (p: Record<string, unknown>) => Profil
        }
      ).profilDeConnexion(params)

    it('reprend le dispositif choisi à la première visite', () => {
      expect(profilDeConnexion({ dispositif: 'BRSA' })).toEqual({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.BRSA
      })
    })

    it('reste sans dispositif pour le bouton unique', () => {
      expect(profilDeConnexion({})).toEqual({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: null
      })
    })

    it('ignore un dispositif qui n’est pas un accompagnement France Travail', () => {
      expect(profilDeConnexion({ dispositif: 'PACEA' })).toEqual({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: null
      })
      expect(profilDeConnexion({ dispositif: 'n’importe quoi' })).toEqual({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: null
      })
    })
  })

  describe('callback', () => {
    it('renvoie erreur', async () => {
      // Given
      const sandbox = createSandbox()
      const request: StubbedType<Request> = stubInterface(sandbox)
      const response: StubbedType<Response> = stubInterface(sandbox)

      // When
      const result = await francetravailConseillerService.callback(
        request,
        response
      )

      // Then
      expect(result).toEqual(failure(new AuthError('CallbackParams')))
    })
  })
})
