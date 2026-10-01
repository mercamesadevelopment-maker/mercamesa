/** Un problema que se le puede decir tal cual a quien hizo la petición. */
export class PqrsInputError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PqrsInputError';
    this.status = status;
  }
}
