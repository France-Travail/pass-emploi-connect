import * as Joi from 'joi'

export const configurationSchema = Joi.object({
  environment: Joi.string().valid('prod', 'staging').required(),
  port: Joi.number(),
  publicAddress: Joi.string().required(),
  apis: Joi.object({
    passemploi: Joi.object({
      url: Joi.string().required(),
      key: Joi.string().required()
    }).required(),
    francetravail: Joi.object({
      url: Joi.string().required()
    }).required()
  }).required(),
  authorizedApiKeys: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required(),
  authorizedConseillersDept: Joi.array().items(Joi.string()).required(),
  cors: Joi.object({
    allowedOrigins: Joi.array().items(Joi.string())
  }),
  redis: Joi.object({
    url: Joi.string().required()
  }).required(),
  clients: Joi.object({
    web: Joi.object({
      id: Joi.string().required(),
      secret: Joi.string().required(),
      callbacks: Joi.array().items(Joi.string().required()).min(1).required(),
      errorCallback: Joi.string().required(),
      logoutCallbacks: Joi.array()
        .items(Joi.string().required())
        .min(1)
        .required()
    }).required(),
    app: Joi.object({
      id: Joi.string().required(),
      secret: Joi.string().required(),
      callbacks: Joi.array().items(Joi.string().required()).min(1).required()
    }).required(),
    api: Joi.object({
      id: Joi.string().required(),
      secret: Joi.string().required()
    }).required(),
    swagger: Joi.object({
      id: Joi.string().required(),
      secret: Joi.string().required(),
      callbacks: Joi.array().items(Joi.string().required()).min(1).required()
    }).required()
  }).required(),
  jwks: Joi.object({
    keys: Joi.array().items(Joi.object().required()).min(2).required()
  }),
  ressourceServer: Joi.object({
    url: Joi.string().required(),
    scopes: Joi.string().required()
  }),
  idps: Joi.object({
    francetravailBeneficiaire: Joi.object({
      issuer: Joi.string().required(),
      realm: Joi.string().required(),
      authorizationUrl: Joi.string().required(),
      tokenUrl: Joi.string().required(),
      jwks: Joi.string().required(),
      userinfo: Joi.string().required(),
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
      scopes: Joi.string().required(),
      redirectUri: Joi.string().required(),
      logout: Joi.string().required(),
      accessTokenMaxAge: Joi.number().required(),
      refreshTokenMaxAge: Joi.number().required()
    }),
    francetravailConseiller: Joi.object({
      issuer: Joi.string().required(),
      authorizationUrl: Joi.string().required(),
      tokenUrl: Joi.string().required(),
      jwks: Joi.string().required(),
      userinfo: Joi.string().required(),
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
      scopes: Joi.string().required(),
      redirectUri: Joi.string().required(),
      logout: Joi.string().required(),
      accessTokenMaxAge: Joi.number().required(),
      refreshTokenMaxAge: Joi.number().required()
    }),
    miloConseiller: Joi.object({
      issuer: Joi.string().required(),
      authorizationUrl: Joi.string().required(),
      tokenUrl: Joi.string().required(),
      jwks: Joi.string().required(),
      userinfo: Joi.string().required(),
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
      scopes: Joi.string().required(),
      redirectUri: Joi.string().required(),
      logout: Joi.string().required(),
      accessTokenMaxAge: Joi.number().required(),
      refreshTokenMaxAge: Joi.number().required()
    }),
    miloJeune: Joi.object({
      issuer: Joi.string().required(),
      authorizationUrl: Joi.string().required(),
      tokenUrl: Joi.string().required(),
      jwks: Joi.string().required(),
      userinfo: Joi.string().required(),
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
      scopes: Joi.string().required(),
      redirectUri: Joi.string().required(),
      logout: Joi.string().required(),
      accessTokenMaxAge: Joi.number().required(),
      refreshTokenMaxAge: Joi.number().required()
    }),
    conseillerDept: Joi.object({
      issuer: Joi.string().required(),
      authorizationUrl: Joi.string().required(),
      tokenUrl: Joi.string().required(),
      jwks: Joi.string().required(),
      userinfo: Joi.string().required(),
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
      scopes: Joi.string().required(),
      redirectUri: Joi.string().required(),
      logout: Joi.string().required(),
      accessTokenMaxAge: Joi.number().required(),
      refreshTokenMaxAge: Joi.number().required()
    })
  }).required(),
  oidc: Joi.object({
    acessTokenTtlSeconds: Joi.number().required()
  })
})
