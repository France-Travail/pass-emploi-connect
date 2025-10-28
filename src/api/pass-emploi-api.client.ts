import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { firstValueFrom } from 'rxjs'
import { Account } from '../domain/account'
import { User } from '../domain/user'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { buildError } from '../utils/monitoring/logger.module'
import { NonTrouveError, UtilisateurNonTraitable } from '../utils/result/error'
import { Result, failure, success } from '../utils/result/result'

export interface PassEmploiUser {
  nom?: string
  prenom?: string
  email?: string
  type: User.Type
  structure: User.Structure
  username?: string
}

@Injectable()
export class PassEmploiAPIClient {
  private readonly logger: Logger
  private readonly apiUrl: string
  private readonly apiKey: string
  protected apmService: APM.Agent

  constructor(
    private readonly configService: ConfigService,
    private httpService: HttpService
  ) {
    this.logger = new Logger('PassEmploiAPIClient')
    this.apmService = getAPMInstance()
    this.apiUrl = this.configService.get('apis.passemploi.url')!
    this.apiKey = this.configService.get('apis.passemploi.key')!
  }

  async putUser(
    sub: string,
    passEmploiUser: PassEmploiUser
  ): Promise<Result<User>> {
    try {
      const apiUser = await firstValueFrom(
        this.httpService.put(
          `${this.apiUrl}/auth/users/${sub}`,
          passEmploiUser,
          {
            headers: {
              'X-API-KEY': this.apiKey
            }
          }
        )
      )

      const user: User = {
        userId: apiUser.data.id,
        userType: apiUser.data.type,
        userStructure: apiUser.data.structure,
        userRoles: apiUser.data.roles,
        given_name: apiUser.data.prenom,
        family_name: apiUser.data.nom,
        email: apiUser.data.email,
        preferred_username: apiUser.data.username
      }
      return success(user)
    } catch (e) {
      this.logger.error(buildError('Erreur PUT User', e))
      this.apmService.captureError(e)
      return failure(
        new UtilisateurNonTraitable(
          e.response?.data?.reason ?? e.response?.data?.code,
          e.response?.data?.email,
          passEmploiUser.nom,
          passEmploiUser.prenom
        )
      )
    }
  }

  async getUser(account: Account): Promise<Result<User>> {
    try {
      const apiUser = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/auth/users/${account.sub}`, {
          params: {
            typeUtilisateur: account.type,
            structureUtilisateur: account.structure
          },
          headers: {
            'X-API-KEY': this.apiKey
          }
        })
      )

      const user: User = {
        userId: apiUser.data.id,
        userType: account.type,
        userStructure: account.structure,
        userRoles: apiUser.data.roles,
        given_name: apiUser.data.prenom,
        family_name: apiUser.data.nom,
        email: apiUser.data.email,
        preferred_username: apiUser.data.username
      }
      return success(user)
    } catch (e) {
      this.logger.error(buildError('Erreur GET User', e))
      this.apmService.captureError(e)
      return failure(new NonTrouveError('Utilisateur', account.sub))
    }
  }
}
