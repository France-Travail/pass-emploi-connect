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
  let url = `${errorCallbackUrl}?reason=${
    failure.error.reason ?? failure.error.code
  }`
  if (typeUtilisateur) {
    url += `&typeUtilisateur=${typeUtilisateur}`
  }
  if (structureUtilisateur) {
    url += `&structureUtilisateur=${structureUtilisateur}`
  }
  if (failure.error.email) {
    url += `&email=${failure.error.email}`
  }
  if (failure.error.nom) {
    url += `&nom=${failure.error.nom}`
  }
  if (failure.error.prenom) {
    url += `&prenom=${failure.error.prenom}`
  }
  response.redirect(HttpStatus.TEMPORARY_REDIRECT, url)
}
