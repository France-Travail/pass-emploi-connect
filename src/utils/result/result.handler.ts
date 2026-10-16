import { HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Failure } from './result'
import { User } from '../../domain/user'

export function redirectFailure(
  response: Response,
  failure: Failure,
  typeUtilisateur?: User.Type,
  structureUtilisateur?: User.Structure
): void {
  // eslint-disable-next-line no-process-env
  const errorCallbackUrl = process.env.CLIENT_WEB_ERROR_CALLBACK!
  const params = new URLSearchParams({
    reason: failure.error.reason ?? failure.error.code
  })
  if (typeUtilisateur) params.set('typeUtilisateur', typeUtilisateur)
  if (structureUtilisateur) {
    params.set('structureUtilisateur', structureUtilisateur)
  }
  if (failure.error.email) params.set('email', failure.error.email)
  if (failure.error.nom) params.set('nom', failure.error.nom)
  if (failure.error.prenom) params.set('prenom', failure.error.prenom)
  if (failure.error.population) {
    params.set('population', failure.error.population)
  }
  response.redirect(
    HttpStatus.TEMPORARY_REDIRECT,
    `${errorCallbackUrl}?${params}`
  )
}
