declare module "@a1motion/driveweb" {
  class DriveInterface {
    constructor(ip:string);
    getParameter(id: number): Promise<number>;
    getParameters(ids: number[]): Promise<number[]>;
    setParameter(id: number, value: number): Promise<number>;
    setParameters(IdsAndValues: {
      [id:number]: number
    }): Promise<number[]>;
  }
  export = DriveInterface;
}