export default class DriveInterface {
  constructor(ip:string);
  getParameter(id: number): PromiseLike<number>;
  getParameters(ids: number[]): PromiseLike<number[]>;
  getFloatParameter(id: number): PromiseLike<number>;
  setParameter(id: number, value: number): PromiseLike<number>;
  setParameters(IdsAndValues: {
    [id:number]: number
  }): PromiseLike<number[]>;
}
