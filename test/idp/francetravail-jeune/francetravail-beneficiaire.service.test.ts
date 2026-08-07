import { UserinfoResponse } from 'openid-client'
import { FrancetravailAPIClient } from '../../../src/api/francetravail-api.client'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client'
import { User } from '../../../src/domain/user'
import { FrancetravailBeneficiaireService } from '../../../src/idp/francetravail-jeune/francetravail-beneficiaire.service'
import { OidcService } from '../../../src/oidc-provider/oidc.service'
import { TokenService } from '../../../src/token/token.service'
import { NonTrouveError } from '../../../src/utils/result/error'
import { failure, success } from '../../../src/utils/result/result'
import { StubbedClass, stubClass } from '../../test-utils'
import { testConfig } from '../../test-utils/module-for-testing'

describe('FrancetravailBeneficiaireService', () => {
  let service: FrancetravailBeneficiaireService
  let francetravailAPIClient: StubbedClass<FrancetravailAPIClient>

  const resoudreStructureNonAccompagne = (): Promise<
    User.Structure | undefined
  > =>
    (
      service as unknown as {
        resoudreStructureNonAccompagne: (
          u: UserinfoResponse,
          t: string
        ) => Promise<User.Structure | undefined>
      }
    ).resoudreStructureNonAccompagne({} as UserinfoResponse, 'tok')

  beforeEach(() => {
    francetravailAPIClient = stubClass(FrancetravailAPIClient)
    service = new FrancetravailBeneficiaireService(
      testConfig(),
      stubClass(OidcService),
      stubClass(TokenService),
      stubClass(PassEmploiAPIClient),
      francetravailAPIClient
    )
  })

  describe('resoudreStructureNonAccompagne', () => {
    it('renvoie FT_DEMANDEUR_D_EMPLOI quand le statut est demandeur', async () => {
      // Given
      francetravailAPIClient.getStatut.resolves(
        success({ estDemandeurEmploi: true })
      )

      // When / Then
      expect(await resoudreStructureNonAccompagne()).toEqual(
        User.Structure.FT_DEMANDEUR_D_EMPLOI
      )
    })

    it('renvoie FT_ESPACE_CANDIDAT quand le statut est non demandeur', async () => {
      // Given
      francetravailAPIClient.getStatut.resolves(
        success({ estDemandeurEmploi: false })
      )

      // When / Then
      expect(await resoudreStructureNonAccompagne()).toEqual(
        User.Structure.FT_ESPACE_CANDIDAT
      )
    })

    it('renvoie FT_ESPACE_CANDIDAT quand le statut est indisponible', async () => {
      // Given
      francetravailAPIClient.getStatut.resolves(
        failure(new NonTrouveError('Statut FT'))
      )

      // When / Then
      expect(await resoudreStructureNonAccompagne()).toEqual(
        User.Structure.FT_ESPACE_CANDIDAT
      )
    })
  })
})
