import { Found } from "./found.model";

export class State {
  constructor(
    public ID: number,
    public Name: string,
    public Abbrv: string,
    public Lat: number,
    public Lng: number,
    public Capital: string,
    public Bird: string,
    public Flower: string,
    public Nickname: string,
    public flagURL: string,
    public fnd: Found
  ) {}
}
