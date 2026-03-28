export class Found {
  constructor(
    public lat: number,
    public lng: number,
    public distance: number,
    public stateFound: boolean,
    public questionsCorrect: number
  ) { }
}
