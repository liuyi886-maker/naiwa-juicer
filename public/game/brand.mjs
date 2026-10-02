// Shared GPT-generated emblem from the peach-juice packaging.
export const PEACH_EMBLEM_URL='assets/brand/peach-emblem-v1.png';
let emblem;
export async function loadBrandArt(){
 const image=new Image();image.src=PEACH_EMBLEM_URL;
 await image.decode();emblem=image;
}
export function drawPeachHead(c,x,y,size){
 if(!emblem)return;
 c.drawImage(emblem,x-size/2,y-size/2,size,size);
}
