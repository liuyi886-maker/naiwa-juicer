import {assets} from './asset-loader.mjs?v=mobile-load-13';
import {loadSpeciesSprites} from './character-rigs.mjs?v=mobile-load-13';
import {loadBrandArt} from './brand.mjs?v=mobile-load-13';
import {loadProductArt} from './products.mjs?v=mobile-load-13';
export const HUNT_IMAGES={hunterRig:'characters/hunter/animations/motion-fullbody-v4',preyRig:'characters/basic/animations/run-fullbody-v3',dogRig:'characters/dog/animations/motion-fullbody-v4',tauntFrames:'characters/basic/animations/taunt-moving-v1',bg:'environment/swamp-v2',walk:'characters/basic/animations/walk-sheet',eat:'characters/basic/animations/eat-sheet',startle:'characters/basic/animations/startle-sheet'};
export const WORKSHOP_IMAGES={labBg:'environment/lab/room-v2',shopBg:'environment/shop/store-v2',shopCustomers:'environment/shop/customers-v1'};
export async function loadHunt(images,onProgress=()=>{}){
 let completed=0;const total=Object.keys(HUNT_IMAGES).length+10;
 onProgress(0,total);
 const done=()=>onProgress(++completed,total);
 await Promise.all([
  ...Object.entries(HUNT_IMAGES).map(async([key,path])=>{const [image,meta]=await Promise.all([assets.image(`assets/${path}.webp`),['hunterRig','preyRig','dogRig','tauntFrames'].includes(key)?assets.json(`assets/${path}.json`):null]);images[key]=image;if(meta){image.runAtlas=image;image.runMeta=meta;}done();}),
  loadSpeciesSprites(images,done),loadBrandArt().then(done)
 ]);
 Object.assign(images.preyRig,{speciesSprites:images.speciesSprites,tauntAtlas:images.tauntFrames,tauntMeta:images.tauntFrames.runMeta});
}
let workshopReady;
export function loadWorkshop(images){
 if(!workshopReady)workshopReady=Promise.all([...Object.entries(WORKSHOP_IMAGES).map(async([key,path])=>{images[key]=await assets.image(`assets/${path}.webp`);}),loadProductArt()]).catch(error=>{workshopReady=null;throw error;});
 return workshopReady;
}
