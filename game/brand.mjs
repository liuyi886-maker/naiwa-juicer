import {assets} from './asset-loader.mjs?v=mobile-load-13';
// Shared GPT-generated emblem from the peach-juice packaging.
export const PEACH_EMBLEM_URL='assets/brand/peach-emblem-v1.webp';
let emblem;
export async function loadBrandArt(){
 emblem=await assets.image(PEACH_EMBLEM_URL);
}
export function drawPeachHead(c,x,y,size){
 if(!emblem)return;
 c.drawImage(emblem,x-size/2,y-size/2,size,size);
}
