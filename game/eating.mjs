// The food and its animation share one clock, including across a saved round.
export const EAT_SECONDS=5;
export const EAT_CYCLE=1.6;
export const eatingReach=z=>({basic:32,hopper:36,bird:40,shell:46,longbody:62}[z.species]||32);
export function eatingFrame(timer,count=4){
 const sequence=count===8?[0,1,2,3,4,5,6,7]:[0,1,2,2,3,0,1,2];
 return sequence[Math.floor(Math.max(0,timer||0)/EAT_CYCLE*sequence.length)%sequence.length];
}
export function currentEater(bait,prey){
 return bait.life>0?prey.find(z=>z.id===bait.eaterId&&z.state==='eat'):undefined;
}
