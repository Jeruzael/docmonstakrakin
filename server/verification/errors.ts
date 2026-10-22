export class VerificationError extends Error {
  constructor(public status:number,message:string){super(message);}
}
