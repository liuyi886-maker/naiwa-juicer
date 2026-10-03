import {assets} from './asset-loader.mjs?v=mobile-load-13';
import {loadSpeciesSprites} from './character-rigs.mjs?v=mobile-load-13';
import {loadBrandArt} from './brand.mjs?v=mobile-load-13';
import {loadProductArt} from './products.mjs?v=mobile-load-13';
export const HUNT_IMAGES={hunterRig:'characters/hunter/animations/motion-fullbody-v4',preyRig:'characters/basic/animations/run-fullbody-v3',dogRig:'characters/dog/animations/motion-fullbody-v4',tauntFrames:'characters/basic/animations/taunt-moving-v1',bg:'environment/swamp-v2',eat:'characters/basic/animations/eat-sheet',startle:'characters/basic/animations/startle-sheet'};
export const WORKSHOP_IMAGES={labBg:'environment/lab/room-v2',shopBg:'environment/shop/store-v2',shopCustomers:'environment/shop/customers-v1'};
export async function loadHunt(images,onProgress=()=>{}){
 let completed=0;const total=Object.keys(HUNT_IMAGES).length+11;
 onProgress(0,total);
 const done=()=>onProgress(++completed,total);
 await Promise.all([
  ...Object.entries(HUNT_IMAGES).map(async([key,path])=>{const [image,meta]=await Promise.all([assets.image(`assets/${path}.webp`),['hunterRig','preyRig','dogRig','tauntFrames'].includes(key)?assets.json(`assets/${path}.json`):null]);images[key]=image;if(meta){image.runAtlas=image;image.runMeta=meta;}done();}),
  loadSpeciesSprites(images,done),loadBrandArt().then(done),
  Promise.all([assets.image('assets/characters/shared/eat-fullbody-v1.webp'),assets.json('assets/characters/shared/eat-fullbody-v1.json')]).then(([atlas,meta])=>{images.eatingAtlas=atlas;images.eatingMeta=meta;done();})
 ]);
 Object.assign(images.preyRig,{speciesSprites:images.speciesSprites,tauntAtlas:images.tauntFrames,tauntMeta:images.tauntFrames.runMeta});
 const w=images.eat.width/(images.eat.assetScaleX||1)/4,h=images.eat.height/(images.eat.assetScaleY||1)/2;
 Object.assign(images.preyRig,{eatAtlas:images.eat,eatMeta:{height:h*.98,facing:-1,wholeBody:true,frames:Array.from({length:8},(_,i)=>({x:i%4*w,y:Math.floor(i/4)*h,w,h,anchorX:w*.54,baseline:h*.99}))},eatingAtlas:images.eatingAtlas,eatingMeta:images.eatingMeta});
}
let workshopReady;
export function loadWorkshop(images){
 if(!workshopReady)workshopReady=Promise.all([...Object.entries(WORKSHOP_IMAGES).map(async([key,path])=>{images[key]=await assets.image(`assets/${path}.webp`);}),loadProductArt()]).catch(error=>{workshopReady=null;throw error;});
 return workshopReady;
}
