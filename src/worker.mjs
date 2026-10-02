import {handleApi} from './game-api.mjs';
export default {
 async fetch(request,env){
  if(new URL(request.url).pathname.startsWith('/api/')){
   if(!env.DB)return Response.json({error:'存档服务暂不可用，请稍后重试'},{status:503});
   return handleApi(request,env.DB,env);
  }
  return env.ASSETS.fetch(request);
 }
};
