import {createHandler} from '../server/account-handler.mjs';
import {proxyMembership} from '../server/remote-membership.mjs';
export {createHandler};
const local=createHandler();
export default function handler(req,res){
  if(process.env.DATABASE_URL || process.env.LOCAL_MEMBERSHIP==='1') return local(req,res);
  return proxyMembership(req,res);
}
