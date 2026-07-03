export class FilterStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterStopError';
  }
}
