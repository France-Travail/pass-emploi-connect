import sinon from 'sinon'
import { User } from '../../../src/domain/user'
import {
  createIdpClientConfig,
  createIdpIssuerConfig,
  generateNewGrantId,
  getIdpConfig
} from '../../../src/idp/service/helpers'
import { OidcService } from '../../../src/oidc-provider/oidc.service'
import { StubbedClass, stubClass } from '../../test-utils'
import { testConfig } from '../../test-utils/module-for-testing'

describe('Helpers', () => {
  const configService = testConfig()

  describe('getIdpConfigIdentifier', () => {
    it('renvoie miloJeune pour JEUNE MILO', () => {
      expect(
        getIdpConfig(configService, User.Type.JEUNE, User.Structure.MILO).issuer
      ).toBe('milo-jeune.com')
    })

    it('renvoie miloConseiller pour CONSEILLER MILO', () => {
      expect(
        getIdpConfig(configService, User.Type.CONSEILLER, User.Structure.MILO)
          .issuer
      ).toBe('https://sso-qlf.i-milo.fr/auth/realms/imilo-qualif')
    })

    it('renvoie conseillerDept pour CONSEILLER CONSEIL_DEPT', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.CONSEIL_DEPT
        ).issuer
      ).toBe('https://keycloak-cej.com')
    })

    it('renvoie francetravailConseiller pour CONSEILLER FRANCE_TRAVAIL', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.FRANCE_TRAVAIL
        ).issuer
      ).toBe('ft-conseiller.com')
    })

    it('renvoie francetravailConseillerpour CONSEILLER PE CEJ', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.POLE_EMPLOI_CEJ
        ).issuer
      ).toBe('ft-conseiller.com')
    })

    it('renvoie francetravailConseiller pour CONSEILLER BRSA', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.POLE_EMPLOI_BRSA
        ).issuer
      ).toBe('ft-conseiller.com')
    })

    it('renvoie francetravailConseiller pour CONSEILLER ACCOMPAGNEMENT INTENSIF', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.FT_ACCOMPAGNEMENT_INTENSIF
        ).issuer
      ).toBe('ft-conseiller.com')
    })

    it('renvoie francetravailConseiller pour CONSEILLER ACCOMPAGNEMENT GLOBAL', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.FT_ACCOMPAGNEMENT_GLOBAL
        ).issuer
      ).toBe('ft-conseiller.com')
    })

    it('renvoie francetravailConseiller pour CONSEILLER EQUIP’EMPLOI EQUIP’RECRUT', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.CONSEILLER,
          User.Structure.FT_EQUIP_EMPLOI_RECRUT
        ).issuer
      ).toBe('ft-conseiller.com')
    })

    it('renvoie francetravailJeune pour JEUNE FRANCE_TRAVAIL', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.JEUNE,
          User.Structure.FRANCE_TRAVAIL
        ).issuer
      ).toBe('ft-jeune.com')
    })

    it('renvoie francetravailJeune pour JEUNE CONSEIL_DEPT', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.JEUNE,
          User.Structure.CONSEIL_DEPT
        ).issuer
      ).toBe('ft-jeune.com')
    })

    it('renvoie francetravailJeune pour JEUNE PE CEJ', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.JEUNE,
          User.Structure.POLE_EMPLOI_CEJ
        ).issuer
      ).toBe('ft-jeune.com')
    })

    it('renvoie francetravailJeune pour JEUNE PE CEJ ', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.JEUNE,
          User.Structure.POLE_EMPLOI_CEJ
        ).issuer
      ).toBe('ft-jeune.com')
    })

    it('renvoie francetravailJeune pour JEUNE FRANCE_TRAVAIL', () => {
      expect(
        getIdpConfig(
          configService,
          User.Type.JEUNE,
          User.Structure.FRANCE_TRAVAIL
        ).issuer
      ).toBe('ft-jeune.com')
    })
  })

  describe('createIdpIssuerConfig', () => {
    const idp = getIdpConfig(
      configService,
      User.Type.CONSEILLER,
      User.Structure.MILO
    )
    const issuerConfig = {
      issuer: idp.issuer,
      authorization_endpoint: idp.authorizationUrl,
      token_endpoint: idp.tokenUrl,
      jwks_uri: idp.jwks,
      userinfo_endpoint: idp.userinfo
    }
    it('renvoie issuerConfig', () => {
      expect(createIdpIssuerConfig(idp)).toEqual(issuerConfig)
    })
  })

  describe('createIdpClientConfig', () => {
    const idp = getIdpConfig(
      configService,
      User.Type.CONSEILLER,
      User.Structure.MILO
    )
    const clientConfig = {
      client_id: idp.clientId,
      client_secret: idp.clientSecret,
      redirect_uris: [idp.redirectUri],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: idp.scopes,
      token_endpoint_auth_method: 'client_secret_post'
    }
    it('renvoie issuerConfig', () => {
      expect(createIdpClientConfig(idp)).toEqual(clientConfig)
    })
  })

  describe('generateNewGrantId', () => {
    const accountId = 'JEUNE|FRANCE_TRAVAIL|sub-ft'
    const clientId = 'app'
    let oidcService: StubbedClass<OidcService>

    const unGrant = (
      accountIdDuGrant: string,
      idSauvegarde: string
    ): {
      accountId: string
      addOIDCScope: sinon.SinonStub
      addResourceScope: sinon.SinonStub
      save: sinon.SinonStub
    } => ({
      accountId: accountIdDuGrant,
      addOIDCScope: sinon.stub(),
      addResourceScope: sinon.stub(),
      save: sinon.stub().resolves(idSauvegarde)
    })

    const commeGrant = (
      grant: ReturnType<typeof unGrant>
    ): ReturnType<OidcService['createGrant']> =>
      grant as unknown as ReturnType<OidcService['createGrant']>

    beforeEach(() => {
      oidcService = stubClass(OidcService)
    })

    it('réutilise le grant de la session quand il appartient au même compte', async () => {
      // Given
      oidcService.findGrant.resolves(
        commeGrant(unGrant(accountId, 'grant-session'))
      )

      // When
      const grantId = await generateNewGrantId(
        configService,
        oidcService,
        accountId,
        clientId,
        'grant-session'
      )

      // Then
      expect(grantId).toBe('grant-session')
      sinon.assert.notCalled(oidcService.createGrant)
    })

    it('crée un grant neuf quand celui de la session appartient à un autre compte', async () => {
      // Given
      oidcService.findGrant.resolves(
        commeGrant(unGrant('JEUNE|INVITE|sub-invite', 'grant-invite'))
      )
      oidcService.createGrant.returns(
        commeGrant(unGrant(accountId, 'grant-neuf'))
      )

      // When
      const grantId = await generateNewGrantId(
        configService,
        oidcService,
        accountId,
        clientId,
        'grant-invite'
      )

      // Then
      expect(grantId).toBe('grant-neuf')
      sinon.assert.calledOnceWithExactly(
        oidcService.createGrant,
        accountId,
        clientId
      )
    })

    it("n'altère pas le grant d'un autre compte", async () => {
      // Given
      const grantInvite = unGrant('JEUNE|INVITE|sub-invite', 'grant-invite')
      oidcService.findGrant.resolves(commeGrant(grantInvite))
      oidcService.createGrant.returns(
        commeGrant(unGrant(accountId, 'grant-neuf'))
      )

      // When
      await generateNewGrantId(
        configService,
        oidcService,
        accountId,
        clientId,
        'grant-invite'
      )

      // Then
      sinon.assert.notCalled(grantInvite.addOIDCScope)
      sinon.assert.notCalled(grantInvite.addResourceScope)
      sinon.assert.notCalled(grantInvite.save)
    })

    it('crée un grant neuf quand le grant de la session est introuvable', async () => {
      // Given
      oidcService.findGrant.resolves(undefined)
      oidcService.createGrant.returns(
        commeGrant(unGrant(accountId, 'grant-neuf'))
      )

      // When
      const grantId = await generateNewGrantId(
        configService,
        oidcService,
        accountId,
        clientId,
        'grant-expire'
      )

      // Then
      expect(grantId).toBe('grant-neuf')
    })

    it("crée un grant neuf quand la session n'en a pas", async () => {
      // Given
      oidcService.createGrant.returns(
        commeGrant(unGrant(accountId, 'grant-neuf'))
      )

      // When
      const grantId = await generateNewGrantId(
        configService,
        oidcService,
        accountId,
        clientId
      )

      // Then
      expect(grantId).toBe('grant-neuf')
      sinon.assert.notCalled(oidcService.findGrant)
    })
  })
})
