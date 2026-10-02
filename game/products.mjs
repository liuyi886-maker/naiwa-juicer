import {assets} from './asset-loader.mjs?v=mobile-load-13';
export const RECIPES=[
 {id:'peach',species:'basic',name:'黄桃原汁',ingredient:'普通型',cost:3,cups:10,seconds:30,price:5,color:'#efbb42',kind:'juice',machine:'原汁压榨'},
 {id:'soda',species:'hopper',name:'活力蜜桃汽水',ingredient:'长耳型',cost:2,cups:8,seconds:38,price:8,color:'#b4d65c',kind:'soda',machine:'气泡灌装'},
 {id:'shake',species:'bird',name:'云朵桃桃奶昔',ingredient:'圆鸟型',cost:2,cups:6,seconds:45,price:10,color:'#ffe3bd',kind:'shake',machine:'绵密搅拌'},
 {id:'jelly',species:'shell',name:'琥珀黄桃果冻',ingredient:'甲壳型',cost:2,cups:5,seconds:55,price:12,color:'#f29b3c',kind:'jelly',machine:'凝冻成型'},
 {id:'jam',species:'longbody',name:'浓缩黄桃果酱',ingredient:'长身型',cost:2,cups:6,seconds:48,price:11,color:'#d77532',kind:'jam',machine:'浓缩熬制'},
];
export const productFor=id=>RECIPES.find(r=>r.id===id)||RECIPES[0];
const productArt=new Map();
export const productImagePath=id=>`assets/products/${productFor(id).id}-v1.webp`;
export async function loadProductArt(){await Promise.all(RECIPES.map(async r=>{const im=await assets.image(productImagePath(r.id));productArt.set(r.id,im);}));}
export function drawProduct(c,r,x,y,s=1){
 const im=productArt.get(r.id);if(!im?.complete)return false;
 c.drawImage(im,x-24*s,y-46*s,48*s,48*s);return true;
}
